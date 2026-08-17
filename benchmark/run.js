#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict'),
    childProcess=require('node:child_process'),
    fs=require('node:fs'),
    http=require('node:http'),
    os=require('node:os'),
    path=require('node:path'),
    zlib=require('node:zlib'),
    packageData=require('../package.json');

const standardDefaults=Object.freeze({
        requests:250,
        warmup:25,
        concurrency:10
    }),
    smokeDefaults=Object.freeze({
        requests:8,
        warmup:2,
        concurrency:2
    }),
    help=`node-http-server benchmark

Usage:
  node benchmark/run.js [options]

Options:
  --requests <count>     Measured requests per scenario (default: 250)
  --warmup <count>       Warmup requests per scenario (default: 25)
  --concurrency <count>  Concurrent clients (default: 10)
  --json                 Emit machine-readable JSON
  --smoke                Use 8 requests, 2 warmups, and 2 clients
  -h, --help             Show this help
`;

main().catch(function(error){
    if(error && error.signal){
        process.stderr.write(`Benchmark interrupted by ${error.signal}.\n`);
        process.exitCode=128+os.constants.signals[error.signal];
        return;
    }

    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode=1;
});

async function main(){
    const options=parseArguments(process.argv.slice(2));

    if(options.help){
        process.stdout.write(help);
        return;
    }

    const output=await benchmark(options);

    if(options.json){
        process.stdout.write(JSON.stringify(output,null,2) + '\n');
        return;
    }

    process.stdout.write(formatOutput(output));
}

function parseArguments(input){
    const values={};
    let smoke=false;
    let json=false;
    let showHelp=false;

    for(let index=0; index<input.length; index++){
        const argument=input[index];

        if(argument=='--smoke'){
            smoke=true;
            continue;
        }
        if(argument=='--json'){
            json=true;
            continue;
        }
        if(argument=='--help' || argument=='-h'){
            showHelp=true;
            continue;
        }

        const match=argument.match(/^--(requests|warmup|concurrency)(?:=(.*))?$/);
        if(!match){
            throw new Error(`Unknown benchmark option: ${argument}`);
        }

        const key=match[1];
        let value=match[2];

        if(value===undefined){
            value=input[++index];
        }
        if(value===undefined || value.startsWith('--')){
            throw new Error(`Missing value for --${key}`);
        }

        values[key]=integerValue(value,key,key!='warmup');
    }

    const defaults=smoke ? smokeDefaults : standardDefaults;
    const output={
        requests:values.requests ?? defaults.requests,
        warmup:values.warmup ?? defaults.warmup,
        concurrency:values.concurrency ?? defaults.concurrency,
        json:json,
        smoke:smoke,
        help:showHelp
    };

    if(output.concurrency>output.requests){
        throw new Error('--concurrency must be less than or equal to --requests');
    }

    return output;
}

function integerValue(value,name,positive){
    const output=Number(value);

    if(!Number.isSafeInteger(output) || output<0 || positive && output==0){
        const range=positive ? 'a positive integer' : 'a non-negative integer';
        throw new Error(`--${name} must be ${range}`);
    }

    return output;
}

async function benchmark(options){
    const interruption=interruptionControl();
    let workspace;
    let agent;
    let server;
    let primaryError;

    try{
        workspace=fs.mkdtempSync(path.join(os.tmpdir(),'node-http-server-benchmark-'));
        const fixtures=createFixtures(workspace);
        agent=new http.Agent({
            keepAlive:true,
            maxSockets:options.concurrency
        });

        server=startBenchmarkServer(workspace,fixtures.dynamicBody);
        return await Promise.race([
            measure(options,fixtures,agent,server),
            interruption.promise
        ]);
    }catch(error){
        primaryError=error;
        throw error;
    }finally{
        if(agent){
            agent.destroy();
        }

        let cleanupError;
        try{
            if(server && server.child.exitCode===null){
                await stopBenchmarkServer(server);
            }
        }catch(error){
            cleanupError=error;
        }

        try{
            if(workspace){
                fs.rmSync(workspace,{recursive:true,force:true});
            }
        }catch(error){
            cleanupError=cleanupError || error;
        }

        const interruptionError=interruption.error();
        interruption.dispose();

        if(interruptionError){
            throw interruptionError;
        }
        if(cleanupError && !primaryError){
            throw cleanupError;
        }
    }
}

async function measure(options,fixtures,agent,server){
    await server.ready;

    const port=server.port,
        scenarios=createScenarios(fixtures),
        results=[];

    for(const scenario of scenarios){
        if(options.warmup){
            await executeRequests(
                port,
                agent,
                scenario,
                options.warmup,
                Math.min(options.concurrency,options.warmup)
            );
        }

        const started=process.hrtime.bigint(),
            latencies=await executeRequests(
                port,
                agent,
                scenario,
                options.requests,
                options.concurrency
            ),
            durationMilliseconds=Number(process.hrtime.bigint()-started)/1e6;

        results.push(summarize(scenario,latencies,durationMilliseconds));
    }

    return {
        benchmark:'node-http-server',
        version:packageData.version,
        generatedAt:new Date().toISOString(),
        environment:{
            node:process.version,
            platform:process.platform,
            architecture:process.arch
        },
        configuration:{
            requestsPerScenario:options.requests,
            warmupRequestsPerScenario:options.warmup,
            concurrency:options.concurrency
        },
        scenarios:results
    };
}

function interruptionControl(){
    const handlers={};
    let rejectPromise;
    let interruptionError;

    const promise=new Promise(function(resolve,reject){
        rejectPromise=reject;
    });

    for(const signal of ['SIGINT','SIGTERM']){
        handlers[signal]=function(){
            if(interruptionError){
                return;
            }

            interruptionError=new Error(`Benchmark interrupted by ${signal}`);
            interruptionError.signal=signal;
            rejectPromise(interruptionError);
        };
        process.on(signal,handlers[signal]);
    }

    return {
        promise:promise,
        error:function(){
            return interruptionError;
        },
        dispose:function(){
            for(const signal of Object.keys(handlers)){
                process.removeListener(signal,handlers[signal]);
            }
        }
    };
}

function startBenchmarkServer(root,dynamicBody){
    const script=path.join(__dirname,'server.js'),
        child=childProcess.fork(
            script,
            [],
            {
                cwd:path.resolve(__dirname,'..'),
                stdio:['ignore','ignore','pipe','ipc'],
                windowsHide:true
            }
        );
    let stderr='';

    const server={
        child:child,
        port:0,
        stderr:function(){
            return stderr;
        }
    };

    server.ready=new Promise(function(resolve,reject){
        let failure;
        let settled=false;

        child.stderr.setEncoding('utf8');
        child.stderr.on('data',function(chunk){
            stderr+=chunk;
        });

        const timer=setTimeout(function(){
            failure=new Error('Benchmark server readiness exceeded 10 seconds');
            child.kill('SIGKILL');
        },10000);

        function cleanup(){
            clearTimeout(timer);
            child.removeListener('error',onError);
            child.removeListener('exit',onExit);
            child.removeListener('message',onMessage);
        }

        function finish(callback,value){
            if(settled){
                return;
            }
            settled=true;
            cleanup();
            callback(value);
        }

        function onError(error){
            finish(reject,error);
        }

        function onExit(code,signal){
            const detail=stderr.trim();
            finish(
                reject,
                failure || new Error(
                    `Benchmark server exited before readiness (${signal || code})` +
                    (detail ? `: ${detail}` : '')
                )
            );
        }

        function onMessage(message){
            if(!message || typeof message!='object'){
                return;
            }
            if(message.type=='error'){
                failure=new Error(`Benchmark server: ${message.message}`);
                return;
            }
            if(message.type!='ready'){
                return;
            }
            if(!Number.isSafeInteger(message.port) || message.port<1 || message.port>65535){
                failure=new Error('Benchmark server sent an invalid port');
                child.kill('SIGKILL');
                return;
            }
            if(failure){
                child.kill('SIGKILL');
                return;
            }

            server.port=message.port;
            finish(resolve,server);
        }

        child.once('error',onError);
        child.once('exit',onExit);
        child.on('message',onMessage);
        child.send(
            {
                type:'start',
                config:{
                    host:'127.0.0.1',
                    port:0,
                    root:root,
                    server:{
                        compression:true,
                        compressionThreshold:0,
                        spaFallback:true
                    }
                },
                dynamicBody:dynamicBody.toString('base64')
            },
            function(error){
                if(error){
                    finish(reject,error);
                }
            }
        );
    });

    return server;
}

function stopBenchmarkServer(server){
    const child=server.child;

    if(child.exitCode!==null){
        if(child.exitCode===0){
            return Promise.resolve();
        }
        return Promise.reject(new Error(`Benchmark server exited with code ${child.exitCode}`));
    }

    return new Promise(function(resolve,reject){
        let closed=false;
        let timedOut=false;
        let forceTimer;

        const timer=setTimeout(function(){
            timedOut=true;
            child.kill('SIGTERM');
            forceTimer=setTimeout(function(){
                if(child.exitCode===null){
                    child.kill('SIGKILL');
                }
            },500);
        },5000);

        function cleanup(){
            clearTimeout(timer);
            clearTimeout(forceTimer);
            child.removeListener('error',onError);
            child.removeListener('exit',onExit);
            child.removeListener('message',onMessage);
        }

        function onError(error){
            cleanup();
            reject(error);
        }

        function onExit(code,signal){
            cleanup();

            if(timedOut){
                reject(new Error('Benchmark server shutdown exceeded 5 seconds'));
                return;
            }
            if(code!==0 || !closed){
                const detail=server.stderr().trim();
                reject(new Error(
                    `Benchmark server stopped unexpectedly (${signal || code})` +
                    (detail ? `: ${detail}` : '')
                ));
                return;
            }
            resolve();
        }

        function onMessage(message){
            if(message && message.type=='closed'){
                closed=true;
            }
            if(message && message.type=='error'){
                child.kill('SIGTERM');
            }
        }

        child.once('error',onError);
        child.once('exit',onExit);
        child.on('message',onMessage);
        child.send({type:'close'},function(error){
            if(error){
                onError(error);
            }
        });
    });
}

function createFixtures(root){
    const smallBody=Buffer.from('node-http-server benchmark\n'),
        largeBody=Buffer.from('0123456789abcdef'.repeat(65536)),
        spaBody=Buffer.from('<main>' + 'node-http-server benchmark '.repeat(256) + '</main>'),
        dynamicBody=Buffer.from(JSON.stringify({service:'node-http-server',status:'ready'})),
        rangeStart=131072,
        rangeEnd=196607;

    fs.writeFileSync(path.join(root,'small.txt'),smallBody);
    fs.writeFileSync(path.join(root,'large.bin'),largeBody);
    fs.writeFileSync(path.join(root,'index.html'),spaBody);

    return {
        smallBody,
        largeBody,
        spaBody,
        dynamicBody,
        rangeStart,
        rangeEnd,
        rangeBody:largeBody.subarray(rangeStart,rangeEnd+1)
    };
}

function createScenarios(fixtures){
    return [
        {
            id:'static-get-small',
            label:'Small static GET',
            method:'GET',
            path:'/small.txt',
            headers:{},
            validate:function(response){
                assert.equal(response.statusCode,200);
                assert.equal(Number(response.headers['content-length']),fixtures.smallBody.length);
                assert.deepEqual(response.body,fixtures.smallBody);
            }
        },
        {
            id:'static-head-small',
            label:'Small static HEAD',
            method:'HEAD',
            path:'/small.txt',
            headers:{},
            validate:function(response){
                assert.equal(response.statusCode,200);
                assert.equal(Number(response.headers['content-length']),fixtures.smallBody.length);
                assert.equal(response.body.length,0);
            }
        },
        {
            id:'static-range-large',
            label:'Large file byte range',
            method:'GET',
            path:'/large.bin',
            headers:{
                Range:`bytes=${fixtures.rangeStart}-${fixtures.rangeEnd}`
            },
            validate:function(response){
                assert.equal(response.statusCode,206);
                assert.equal(
                    response.headers['content-range'],
                    `bytes ${fixtures.rangeStart}-${fixtures.rangeEnd}/${fixtures.largeBody.length}`
                );
                assert.deepEqual(response.body,fixtures.rangeBody);
            }
        },
        {
            id:'spa-fallback-gzip',
            label:'Gzip SPA fallback',
            method:'GET',
            path:'/dashboard/settings',
            headers:{
                Accept:'text/html',
                'Accept-Encoding':'gzip'
            },
            validate:function(response){
                assert.equal(response.statusCode,200);
                assert.equal(response.headers['content-encoding'],'gzip');
                assert.match(response.headers.vary,/Accept-Encoding/i);
                assert.deepEqual(zlib.gunzipSync(response.body),fixtures.spaBody);
            }
        },
        {
            id:'dynamic-hook',
            label:'Dynamic request hook',
            method:'GET',
            path:'/dynamic',
            headers:{},
            validate:function(response){
                assert.equal(response.statusCode,200);
                assert.equal(response.headers['content-type'],'application/json; charset=utf-8');
                assert.deepEqual(response.body,fixtures.dynamicBody);
            }
        }
    ];
}

async function executeRequests(port,agent,scenario,count,concurrency){
    const latencies=new Array(count);
    let next=0;

    async function worker(){
        while(next<count){
            const index=next++;
            latencies[index]=await executeRequest(port,agent,scenario,index);
        }
    }

    await Promise.all(Array.from({length:concurrency},worker));
    return latencies;
}

function executeRequest(port,agent,scenario,index){
    const started=process.hrtime.bigint();

    return new Promise(function(resolve,reject){
        const request=http.request(
            {
                hostname:'127.0.0.1',
                port:port,
                path:scenario.path,
                method:scenario.method,
                headers:scenario.headers,
                agent:agent
            },
            function(response){
                const chunks=[];

                response.on('data',function(chunk){
                    chunks.push(chunk);
                });
                response.on('error',reject);
                response.on('end',function(){
                    try{
                        scenario.validate({
                            statusCode:response.statusCode,
                            headers:response.headers,
                            body:Buffer.concat(chunks)
                        });
                    }catch(error){
                        error.message=`${scenario.id} request ${index+1}: ${error.message}`;
                        reject(error);
                        return;
                    }

                    resolve(Number(process.hrtime.bigint()-started)/1e6);
                });
            }
        );

        request.setTimeout(10000,function(){
            request.destroy(new Error(`${scenario.id} request ${index+1} timed out`));
        });
        request.on('error',reject);
        request.end();
    });
}

function summarize(scenario,latencies,durationMilliseconds){
    const sorted=latencies.slice().sort((first,second)=>first-second);

    return {
        id:scenario.id,
        label:scenario.label,
        method:scenario.method,
        path:scenario.path,
        requests:latencies.length,
        durationMilliseconds:rounded(durationMilliseconds),
        requestsPerSecond:rounded(latencies.length/(durationMilliseconds/1000)),
        latencyMilliseconds:{
            p50:rounded(percentile(sorted,50)),
            p95:rounded(percentile(sorted,95)),
            p99:rounded(percentile(sorted,99))
        }
    };
}

function percentile(sorted,percent){
    return sorted[Math.max(0,Math.ceil(percent/100*sorted.length)-1)];
}

function rounded(value){
    return Number(value.toFixed(3));
}

function formatOutput(output){
    const rows=output.scenarios.map(function(scenario){
        return [
            scenario.label,
            String(scenario.requests),
            scenario.requestsPerSecond.toFixed(1),
            scenario.latencyMilliseconds.p50.toFixed(3),
            scenario.latencyMilliseconds.p95.toFixed(3),
            scenario.latencyMilliseconds.p99.toFixed(3)
        ];
    }),
        headings=['Scenario','Requests','Requests/sec','p50 ms','p95 ms','p99 ms'],
        widths=headings.map(function(heading,index){
            return Math.max(heading.length,...rows.map(row=>row[index].length));
        }),
        line=function(row){
            return row.map((value,index)=>value.padEnd(widths[index])).join('  ').trimEnd() + '\n';
        },
        configuration=output.configuration;

    return [
        `node-http-server ${output.version} benchmark\n`,
        `${output.environment.node} | ${output.environment.platform} ${output.environment.architecture}\n`,
        `${configuration.requestsPerScenario} requests/scenario | ` +
            `${configuration.warmupRequestsPerScenario} warmups/scenario | ` +
            `${configuration.concurrency} concurrent clients\n\n`,
        line(headings),
        line(widths.map(width=>'-'.repeat(width))),
        rows.map(line).join('')
    ].join('');
}
