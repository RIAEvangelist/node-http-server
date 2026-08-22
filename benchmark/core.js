#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict'),
    childProcess=require('node:child_process'),
    crypto=require('node:crypto'),
    fs=require('node:fs'),
    http=require('node:http'),
    os=require('node:os'),
    path=require('node:path'),
    zlib=require('node:zlib'),
    packageData=require('../package.json');

const projectRoot=path.resolve(__dirname,'..'),
    standardDefaults=Object.freeze({
        samples:9,
        concurrency:10,
        requests:400,
        queryRequests:40,
        largeRequests:8,
        brotliRequests:2,
        configConstructions:100000,
        configRetained:10000,
        lifecycleCycles:20,
        queryValues:1000,
        domains:1000,
        largeBytes:8*1024*1024,
        rangeBytes:16,
        brotliBytes:2621440
    }),
    smokeDefaults=Object.freeze({
        samples:3,
        concurrency:2,
        requests:12,
        queryRequests:3,
        largeRequests:1,
        brotliRequests:1,
        configConstructions:1000,
        configRetained:200,
        lifecycleCycles:3,
        queryValues:25,
        domains:5,
        largeBytes:65536,
        rangeBytes:16,
        brotliBytes:131072
    }),
    numericOptions=Object.freeze({
        samples:'samples',
        concurrency:'concurrency',
        requests:'requests',
        'query-requests':'queryRequests',
        'large-requests':'largeRequests',
        'brotli-requests':'brotliRequests',
        'config-constructions':'configConstructions',
        'config-retained':'configRetained',
        'lifecycle-cycles':'lifecycleCycles',
        'query-values':'queryValues',
        domains:'domains',
        'large-bytes':'largeBytes',
        'range-bytes':'rangeBytes',
        'brotli-bytes':'brotliBytes'
    }),
    help=`node-http-server core comparison

Usage:
  node --expose-gc benchmark/core.js [options]

Options:
  --baseline <ref>               Baseline Git ref (default: 9.0.2)
  --samples <count>              Alternating samples (default: 9)
  --concurrency <count>          Concurrent HTTP clients (default: 10)
  --requests <count>             Small HTTP requests/sample (default: 400)
  --query-requests <count>       Repeated-query requests/sample (default: 40)
  --large-requests <count>       8 MiB range/HEAD requests/sample (default: 8)
  --brotli-requests <count>      2.5 MiB Brotli requests/sample (default: 2)
  --config-constructions <count> Config constructions/sample (default: 100000)
  --config-retained <count>      Retained Config instances/sample (default: 10000)
  --lifecycle-cycles <count>     Immediate-close cycles/sample (default: 20)
  --query-values <count>         Repeated values/request (default: 1000)
  --domains <count>              Configured virtual hosts (default: 1000)
  --large-bytes <count>          Large fixture bytes (default: 8388608)
  --range-bytes <count>          Selected range bytes (default: 16)
  --brotli-bytes <count>         Compressible fixture bytes (default: 2621440)
  --only <id>                    Run one scenario; may be repeated
  --smoke                        Use the short verification profile
  --json                         Emit raw JSON to stdout
  --output <file>                Write raw JSON to a file inside site/benchmarks
  -h, --help                     Show this help
`;

main().catch(function(error){
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode=1;
});

async function main(){
    const options=parseArguments(process.argv.slice(2));

    if(options.help){
        process.stdout.write(help);
        return;
    }

    const outputPath=options.output ? outputFilename(options.output) : '';
    const result=await compare(options);

    if(outputPath){
        result.output=path.relative(projectRoot,outputPath).replace(/\\/g,'/');
        fs.mkdirSync(path.dirname(outputPath),{recursive:true});
        fs.writeFileSync(outputPath,JSON.stringify(result,null,2) + '\n');
    }

    if(options.json){
        process.stdout.write(JSON.stringify(result,null,2) + '\n');
        return;
    }

    process.stdout.write(formatOutput(result));
    if(result.output){
        process.stdout.write('Raw JSON: '+result.output+'\n');
    }
}

function parseArguments(input){
    const values={};
    const only=[];
    let baseline='9.0.2';
    let output='';
    let smoke=false;
    let json=false;
    let showHelp=false;

    for(let index=0;index<input.length;index++){
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

        const match=argument.match(/^--([a-z-]+)(?:=(.*))?$/);
        if(!match){
            throw new Error('Unknown core benchmark option: '+argument);
        }

        const name=match[1];
        let value=match[2];
        if(value===undefined){
            value=input[++index];
        }
        if(value===undefined || value.startsWith('--')){
            throw new Error('Missing value for --'+name+'.');
        }

        if(name=='baseline'){
            baseline=value;
        }else if(name=='output'){
            output=value;
        }else if(name=='only'){
            only.push(value);
        }else if(Object.hasOwn(numericOptions,name)){
            values[numericOptions[name]]=positiveInteger(value,name);
        }else{
            throw new Error('Unknown core benchmark option: --'+name);
        }
    }

    const defaults=smoke ? smokeDefaults : standardDefaults,
        configuration=Object.assign({},defaults,values);

    if(configuration.concurrency>configuration.requests){
        throw new Error('--concurrency must be less than or equal to --requests.');
    }
    if(configuration.rangeBytes>configuration.largeBytes){
        throw new Error('--range-bytes must be less than or equal to --large-bytes.');
    }
    if(configuration.samples<3){
        throw new Error('--samples must be at least 3.');
    }

    return Object.assign(configuration,{
        baseline:baseline,
        output:output,
        only:only,
        smoke:smoke,
        json:json,
        help:showHelp
    });
}

function positiveInteger(value,name){
    const output=Number(value);

    if(!Number.isSafeInteger(output) || output<1){
        throw new TypeError('--'+name+' must be a positive integer.');
    }

    return output;
}

function outputFilename(value){
    const root=path.join(projectRoot,'site','benchmarks'),
        filename=path.resolve(projectRoot,value);

    if(filename!==root && !filename.startsWith(root+path.sep)){
        throw new Error('--output must stay inside site/benchmarks.');
    }
    if(path.extname(filename).toLowerCase()!='.json'){
        throw new Error('--output must use a .json filename.');
    }

    return filename;
}

async function compare(options){
    const workspace=fs.mkdtempSync(path.join(os.tmpdir(),'node-http-server-core-'));

    try{
        const baseline=exportBaseline(options.baseline,workspace),
            candidate=workingSource(workspace),
            harness=snapshotHarness(workspace),
            fixtures=createFixtures(workspace,options),
            definitions=createDefinitions(options,fixtures),
            selected=selectDefinitions(definitions,options.only),
            scenarios=[];

        for(const definition of selected){
            process.stderr.write('Core benchmark: '+definition.label+'\n');
            if(definition.kind=='http'){
                scenarios.push(await compareHttpScenario(definition,baseline,candidate,options,harness));
            }else{
                scenarios.push(compareWorkerScenario(definition,baseline,candidate,options,fixtures,harness));
            }
        }

        return {
            benchmark:'node-http-server-core-comparison',
            schemaVersion:1,
            generatedAt:new Date().toISOString(),
            harness:{
                sha256:harness.hashes
            },
            source:{baseline:publicSource(baseline),candidate:publicSource(candidate)},
            environment:environment(),
            methodology:{
                order:'Baseline and candidate order alternates for every recorded sample.',
                aggregation:'Median, minimum, maximum, and every raw sample retained.',
                isolation:'HTTP variants run in separate server processes. Config memory and lifecycle samples run in fresh --expose-gc worker processes.',
                validation:'Every HTTP response is checked. Config workers verify map shape and mutation isolation. Immediate-close workers count live listeners.',
                timing:'Fixture creation, server startup, correctness preflight, warmup, worker startup, and cleanup are outside recorded action time.'
            },
            configuration:publicConfiguration(options),
            scenarios:scenarios
        };
    }finally{
        fs.rmSync(workspace,{recursive:true,force:true});
    }
}

function exportBaseline(ref,workspace){
    if(!/^[A-Za-z0-9._/-]+$/.test(ref)){
        throw new Error('--baseline contains unsupported characters.');
    }

    const moduleDirectory=path.join(workspace,'baseline','server'),
        files=['Server.js','Config.js','MimeTypes.js'];

    fs.mkdirSync(moduleDirectory,{recursive:true});
    for(const filename of files){
        fs.writeFileSync(
            path.join(moduleDirectory,filename),
            git(['show',ref+':server/'+filename])
        );
    }

    const manifest=JSON.parse(git(['show',ref+':package.json']));

    return {
        id:'baseline',
        label:manifest.version,
        version:manifest.version,
        ref:ref,
        commit:git(['rev-parse',ref+'^{commit}']).trim(),
        moduleDirectory:moduleDirectory,
        workingTree:false,
        hashes:fileHashes(moduleDirectory,files)
    };
}

function workingSource(workspace){
    const liveDirectory=path.join(projectRoot,'server'),
        moduleDirectory=path.join(workspace,'candidate','server'),
        files=['Server.js','Config.js','MimeTypes.js'],
        status=git(['status','--porcelain','--'].concat(
            files.map(filename=>'server/'+filename)
        )).trim();

    fs.mkdirSync(moduleDirectory,{recursive:true});
    for(const filename of files){
        fs.copyFileSync(
            path.join(liveDirectory,filename),
            path.join(moduleDirectory,filename)
        );
    }

    return {
        id:'candidate',
        label:packageData.version+' working tree',
        version:packageData.version,
        ref:'working-tree',
        commit:git(['rev-parse','HEAD']).trim(),
        moduleDirectory:moduleDirectory,
        workingTree:Boolean(status),
        hashes:fileHashes(moduleDirectory,files)
    };
}

function snapshotHarness(workspace){
    const directory=path.join(workspace,'harness'),
        files=['core.js','core-server.js','core-worker.js'];

    fs.mkdirSync(directory,{recursive:true});
    for(const filename of files){
        fs.copyFileSync(
            path.join(__dirname,filename),
            path.join(directory,filename)
        );
    }

    return {
        directory:directory,
        hashes:fileHashes(directory,files)
    };
}

function git(args){
    return childProcess.execFileSync('git',args,{
        cwd:projectRoot,
        encoding:'utf8',
        maxBuffer:10*1024*1024,
        windowsHide:true
    });
}

function fileHashes(directory,files){
    const output={};

    for(const filename of files){
        output[filename]=crypto.createHash('sha256')
            .update(fs.readFileSync(path.join(directory,filename)))
            .digest('hex');
    }

    return output;
}

function publicSource(source){
    return {
        label:source.label,
        version:source.version,
        ref:source.ref,
        commit:source.commit,
        workingTree:source.workingTree,
        sha256:source.hashes
    };
}

function environment(){
    const cpus=os.cpus();

    return {
        node:process.version,
        v8:process.versions.v8,
        platform:process.platform,
        release:os.release(),
        architecture:process.arch,
        processor:cpus[0] && cpus[0].model || 'unknown',
        logicalCores:cpus.length,
        totalMemoryBytes:os.totalmem()
    };
}

function publicConfiguration(options){
    const output={};

    for(const key of Object.keys(standardDefaults)){
        output[key]=options[key];
    }
    output.smoke=options.smoke;
    output.selectedScenarios=options.only.length ? options.only : 'all';

    return output;
}

function createFixtures(workspace,options){
    const root=path.join(workspace,'fixtures'),
        smallBody=Buffer.from('node-http-server core benchmark\n'),
        largeBody=patternBuffer(options.largeBytes,'0123456789abcdef'),
        brotliBody=structuredBrotliBuffer(options.brotliBytes);

    fs.mkdirSync(root,{recursive:true});
    fs.writeFileSync(path.join(root,'small.txt'),smallBody);
    fs.writeFileSync(path.join(root,'large.bin'),largeBody);
    fs.writeFileSync(path.join(root,'brotli.txt'),brotliBody);

    return {
        root:root,
        smallBody:smallBody,
        largeBody:largeBody,
        brotliBody:brotliBody,
        rangeStart:Math.floor((options.largeBytes-options.rangeBytes)/2),
        rangeEnd:Math.floor((options.largeBytes-options.rangeBytes)/2)+options.rangeBytes-1
    };
}

function structuredBrotliBuffer(size){
    const output=Buffer.allocUnsafe(size),
        statuses=[200,200,200,206,304,404],
        methods=['GET','GET','GET','HEAD'];
    let offset=0;
    let state=0x6d2b79f5;
    let index=0;

    while(offset<size){
        state=(Math.imul(state,1664525)+1013904223)>>>0;
        const requestId=state.toString(36).padStart(7,'0');
        state=(Math.imul(state,1664525)+1013904223)>>>0;
        const traceId=state.toString(16).padStart(8,'0');
        const line=Buffer.from(JSON.stringify({
            sequence:index,
            timestamp:'2026-08-21T21:'+String(index%60).padStart(2,'0')+':00.000Z',
            method:methods[index%methods.length],
            route:'/assets/chunk-'+index%257+'.js',
            status:statuses[index%statuses.length],
            requestId:requestId,
            traceId:traceId,
            cache:index%5 ? 'hit' : 'miss',
            durationMicroseconds:state%5000,
            message:'node-http-server deterministic compression record '+index%97
        })+'\n');
        const length=Math.min(line.length,size-offset);

        line.copy(output,offset,0,length);
        offset+=length;
        index++;
    }

    return output;
}

function patternBuffer(size,patternText){
    const output=Buffer.allocUnsafe(size),
        pattern=Buffer.from(patternText);

    for(let offset=0;offset<size;offset+=pattern.length){
        pattern.copy(output,offset,0,Math.min(pattern.length,size-offset));
    }

    return output;
}

function createDefinitions(options,fixtures){
    const domains={};
    for(let index=0;index<options.domains;index++){
        domains[(index%2 ? 'Mixed' : 'mixed')+index+'.Example.TEST']=fixtures.root;
    }

    const common={
            root:fixtures.root,
            host:'127.0.0.1',
            port:0,
            server:{timeout:false,requestTimeout:false}
        },
        query='/query?'+Array.from(
            {length:options.queryValues},
            function(value,index){
                return 'a='+index;
            }
        ).join('&'),
        range=`bytes=${fixtures.rangeStart}-${fixtures.rangeEnd}`;

    return [
        {
            id:'default-static-get',
            label:'Default-hook static GET',
            kind:'http',
            requests:options.requests,
            config:common,
            request:{path:'/small.txt'},
            expected:{status:200,body:fixtures.smallBody}
        },
        {
            id:'bodyless-static-head',
            label:'Bodyless static HEAD',
            kind:'http',
            requests:options.requests,
            config:common,
            request:{path:'/small.txt',method:'HEAD'},
            expected:{status:200,body:Buffer.alloc(0),contentLength:fixtures.smallBody.length}
        },
        {
            id:'bodyless-request-hook',
            label:'Bodyless request hook',
            kind:'http',
            requests:options.requests,
            scenario:'bodyless-hook',
            config:common,
            request:{path:'/hook'},
            expected:{status:200,body:Buffer.from('hook-ok'),headers:{'x-body-bytes':'0'}}
        },
        {
            id:'repeated-query-hook',
            label:options.queryValues+' repeated query values',
            kind:'http',
            requests:options.queryRequests,
            scenario:'query-repeat',
            options:{queryValues:options.queryValues},
            config:common,
            request:{path:query},
            expected:{
                status:200,
                body:Buffer.from('query-ok'),
                headers:{
                    'x-query-count':String(options.queryValues),
                    'x-query-first':'0',
                    'x-query-last':String(options.queryValues-1)
                }
            }
        },
        {
            id:'virtual-host-miss',
            label:options.domains+'-domain virtual-host miss',
            kind:'http',
            requests:options.requests,
            config:Object.assign({},common,{domain:'primary.test',domains:domains}),
            request:{path:'/small.txt',headers:{Host:'missing.example.test'}},
            expected:{status:421}
        },
        {
            id:'virtual-host-hit',
            label:options.domains+'-domain virtual-host hit',
            kind:'http',
            requests:options.requests,
            config:Object.assign({},common,{domain:'primary.test',domains:domains}),
            request:{path:'/small.txt',headers:{Host:'MIXED'+(options.domains-1)+'.example.test'}},
            expected:{status:200,body:fixtures.smallBody}
        },
        {
            id:'range-custom-before-serve',
            label:options.rangeBytes+'-byte range from '+byteLabel(options.largeBytes)+' custom beforeServe',
            kind:'http',
            requests:options.largeRequests,
            scenario:'range-before-serve',
            options:{rangeBytes:options.rangeBytes},
            config:common,
            request:{path:'/large.bin',headers:{Range:range}},
            expected:{
                status:206,
                body:Buffer.concat([
                    fixtures.largeBody.subarray(fixtures.rangeStart,fixtures.rangeEnd+1),
                    Buffer.from('!')
                ]),
                headers:{
                    'content-range':`bytes ${fixtures.rangeStart}-${fixtures.rangeEnd}/${fixtures.largeBody.length}`,
                    'x-hook-bytes':String(options.rangeBytes)
                }
            }
        },
        {
            id:'head-default-hook-control',
            label:'Default-hook '+byteLabel(options.largeBytes)+' HEAD control',
            kind:'http',
            requests:options.largeRequests,
            config:common,
            request:{path:'/large.bin',method:'HEAD'},
            expected:{
                status:200,
                body:Buffer.alloc(0),
                contentLength:options.largeBytes
            }
        },
        {
            id:'head-custom-before-serve-control',
            label:'Custom beforeServe HEAD compatibility control',
            kind:'http',
            requests:options.largeRequests,
            scenario:'head-before-serve',
            options:{largeBytes:options.largeBytes},
            config:common,
            request:{path:'/large.bin',method:'HEAD'},
            expected:{
                status:200,
                body:Buffer.alloc(0),
                contentLength:options.largeBytes,
                headers:{'x-hook-bytes':String(options.largeBytes)}
            }
        },
        {
            id:'brotli-static-default',
            label:'Default Brotli '+byteLabel(options.brotliBytes)+' static response',
            kind:'http',
            requests:options.brotliRequests,
            config:Object.assign({},common,{
                server:Object.assign({},common.server,{compression:true,compressionThreshold:0})
            }),
            request:{path:'/brotli.txt',headers:{'Accept-Encoding':'br'}},
            expected:{status:200,brotliBody:fixtures.brotliBody,headers:{'content-encoding':'br'}}
        },
        {
            id:'brotli-static-quality-11-control',
            label:'Brotli quality 11 compatibility control',
            kind:'http',
            requests:options.brotliRequests,
            config:Object.assign({},common,{
                server:Object.assign({},common.server,{
                    compression:true,
                    compressionThreshold:0,
                    brotliQuality:11
                })
            }),
            request:{path:'/brotli.txt',headers:{'Accept-Encoding':'br'}},
            expected:{status:200,brotliBody:fixtures.brotliBody,headers:{'content-encoding':'br'}}
        },
        {
            id:'config-construction',
            label:'Config construction without MIME read',
            kind:'worker',
            action:'config-construct',
            count:options.configConstructions,
            metric:'instancesPerSecond',
            unit:'instances/second',
            direction:'higher'
        },
        {
            id:'config-retained-cold',
            label:'Retained Config memory without MIME read',
            kind:'worker',
            action:'config-retained',
            count:options.configRetained,
            metric:'heapBytesPerInstance',
            unit:'heap bytes/instance',
            direction:'lower'
        },
        {
            id:'config-overlay-retained-cold',
            label:'Retained one-key MIME overlay memory',
            kind:'worker',
            action:'config-overlay-retained',
            count:options.configRetained,
            metric:'heapBytesPerInstance',
            unit:'heap bytes/instance',
            direction:'lower'
        },
        {
            id:'config-materialized-control',
            label:'Retained materialized MIME-map control',
            kind:'worker',
            action:'config-materialized-retained',
            count:options.configRetained,
            metric:'heapBytesPerInstance',
            unit:'heap bytes/instance',
            direction:'lower'
        },
        {
            id:'immediate-close-correctness',
            label:'Deploy plus immediate close correctness',
            kind:'worker',
            action:'immediate-close',
            count:options.lifecycleCycles,
            metric:'cyclesPerSecond',
            unit:'cycles/second',
            direction:'higher',
            correctness:'leakedListeners'
        }
    ];
}

function selectDefinitions(definitions,only){
    if(!only.length){
        return definitions;
    }

    const known=new Set(definitions.map(definition=>definition.id));
    for(const id of only){
        if(!known.has(id)){
            throw new Error('Unknown core benchmark scenario '+JSON.stringify(id)+'.');
        }
    }

    return definitions.filter(definition=>only.includes(definition.id));
}

async function compareHttpScenario(definition,baseline,candidate,options,harness){
    const variants={},
        samples={baseline:[],candidate:[]},
        warmupRequests=Math.max(1,Math.min(20,Math.ceil(definition.requests/10)));
    let diagnostics;
    let failure;

    try{
        variants.baseline=await startCoreServer(baseline,definition,options.concurrency,harness);
        variants.candidate=await startCoreServer(candidate,definition,options.concurrency,harness);

        for(const id of ['baseline','candidate']){
            const variant=variants[id],
                preflight=await executeRequest(variant,definition);

            validateResponse(definition,preflight,true);
            const warmups=await executeBatch(
                variant,
                definition,
                warmupRequests,
                Math.min(options.concurrency,warmupRequests)
            );
            for(const response of warmups){
                validateResponse(definition,response,true);
            }
        }

        for(let sample=0;sample<options.samples;sample++){
            const order=sample%2 ? ['candidate','baseline'] : ['baseline','candidate'];

            for(const id of order){
                samples[id].push(
                    await measureHttp(
                        variants[id],
                        definition,
                        Math.min(options.concurrency,definition.requests)
                    )
                );
            }
        }
    }catch(error){
        failure=error;
    }finally{
        const ids=Object.keys(variants),
            stopped=await Promise.allSettled(ids.map(id=>stopCoreServer(variants[id])));

        diagnostics={};
        ids.forEach(function(id,index){
            const outcome=stopped[index];

            if(outcome.status=='fulfilled'){
                diagnostics[id]=outcome.value;
            }else if(!failure){
                failure=outcome.reason;
            }
        });
    }

    if(failure){
        throw failure;
    }

    if(definition.scenario=='range-before-serve' || definition.scenario=='head-before-serve'){
        for(const id of ['baseline','candidate']){
            assert.equal(diagnostics[id].hookCount>0,true,id+' custom beforeServe did not run.');
            assert.equal(
                diagnostics[id].afterServeCount,
                diagnostics[id].hookCount,
                id+' afterServe count did not match beforeServe.'
            );
        }
    }

    return comparisonResult(
        definition,
        samples,
        'requestsPerSecond',
        'requests/second',
        'higher',
        {
            warmupRequests:warmupRequests,
            diagnostics:diagnostics,
            responseBytesPerRequest:{
                baseline:samples.baseline[0].responseBytes/definition.requests,
                candidate:samples.candidate[0].responseBytes/definition.requests
            }
        }
    );
}

async function measureHttp(variant,definition,concurrency){
    const started=process.hrtime.bigint(),
        responses=await executeBatch(variant,definition,definition.requests,concurrency),
        durationMilliseconds=Number(process.hrtime.bigint()-started)/1e6;
    let responseBytes=0;
    let checksum=0;

    for(const response of responses){
        validateResponse(definition,response,true);
        responseBytes+=response.body.length;
        checksum+=response.statusCode+response.body.length;
    }

    return {
        durationMilliseconds:rounded(durationMilliseconds,6),
        requestsPerSecond:rounded(definition.requests/(durationMilliseconds/1000),3),
        requests:definition.requests,
        responseBytes:responseBytes,
        checksum:checksum
    };
}

async function executeBatch(variant,definition,count,concurrency){
    const output=new Array(count);
    let next=0;

    async function worker(){
        while(next<count){
            const index=next++;
            output[index]=await executeRequest(variant,definition);
        }
    }

    await Promise.all(Array.from({length:concurrency},worker));
    return output;
}

function executeRequest(variant,definition){
    const requestOptions={
        hostname:'127.0.0.1',
        port:variant.port,
        path:definition.request.path,
        method:definition.request.method || 'GET',
        headers:definition.request.headers || {},
        agent:variant.agent
    };

    return new Promise(function(resolve,reject){
        const request=http.request(requestOptions,function(response){
            const chunks=[];

            response.on('data',function(chunk){
                chunks.push(chunk);
            });
            response.on('error',reject);
            response.on('end',function(){
                resolve({
                    statusCode:response.statusCode,
                    headers:response.headers,
                    body:Buffer.concat(chunks)
                });
            });
        });

        request.setTimeout(30000,function(){
            request.destroy(new Error(definition.id+' request exceeded 30 seconds.'));
        });
        request.on('error',reject);
        request.end();
    });
}

function validateResponse(definition,response,preflight){
    const expected=definition.expected;

    assert.equal(response.statusCode,expected.status,definition.id+' status');
    if(expected.contentLength!==undefined){
        assert.equal(Number(response.headers['content-length']),expected.contentLength);
    }
    for(const name of Object.keys(expected.headers || {})){
        assert.equal(response.headers[name],expected.headers[name],definition.id+' '+name);
    }

    if(expected.body){
        assert.deepEqual(response.body,expected.body,definition.id+' body');
    }
    if(expected.brotliBody){
        assert.equal(response.body.length>0,true);
        if(preflight){
            assert.deepEqual(zlib.brotliDecompressSync(response.body),expected.brotliBody);
        }
    }
}

function startCoreServer(source,definition,concurrency,harness){
    const script=path.join(harness.directory,'core-server.js'),
        child=childProcess.fork(script,[],{
            cwd:projectRoot,
            stdio:['ignore','ignore','pipe','ipc'],
            windowsHide:true
        }),
        agent=new http.Agent({keepAlive:true,maxSockets:concurrency});
    let stderr='';

    const output={child:child,agent:agent,port:0,stderr:function(){return stderr;}};
    output.ready=new Promise(function(resolve,reject){
        let settled=false;
        let shutdownError;
        let forceTimer;
        let hardTimer;
        const timer=setTimeout(function(){
            abort(new Error(source.id+' '+definition.id+' server readiness exceeded 15 seconds.'));
        },15000);

        child.stderr.setEncoding('utf8');
        child.stderr.on('data',function(chunk){
            stderr+=chunk;
        });

        function cleanup(){
            clearTimeout(timer);
            clearTimeout(forceTimer);
            clearTimeout(hardTimer);
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

        function abort(error){
            if(settled){
                return;
            }
            shutdownError=shutdownError || error;

            if(child.exitCode!==null){
                finish(reject,shutdownError);
                return;
            }

            child.kill('SIGTERM');
            forceTimer=forceTimer || setTimeout(function(){
                if(child.exitCode===null){
                    child.kill('SIGKILL');
                }
            },500);
            hardTimer=hardTimer || setTimeout(function(){
                finish(reject,shutdownError);
            },2000);
        }

        function onError(error){
            abort(error);
        }

        function onExit(code,signal){
            if(shutdownError){
                finish(reject,shutdownError);
                return;
            }
            finish(
                reject,
                new Error(
                    source.id+' '+definition.id+' server exited before readiness ('+(signal || code)+').' +
                    (stderr.trim() ? '\n'+stderr.trim() : '')
                )
            );
        }

        function onMessage(message){
            if(message && message.type=='error'){
                abort(new Error(message.message));
                return;
            }
            if(!message || message.type!='ready'){
                return;
            }
            if(!Number.isSafeInteger(message.port) || message.port<1 || message.port>65535){
                abort(new Error(source.id+' returned an invalid benchmark port.'));
                return;
            }

            output.port=message.port;
            finish(resolve,output);
        }

        child.once('error',onError);
        child.once('exit',onExit);
        child.on('message',onMessage);
        child.send({
            type:'start',
            moduleDirectory:source.moduleDirectory,
            scenario:definition.scenario || '',
            config:definition.config,
            options:definition.options || {}
        },function(error){
            if(error){
                abort(error);
            }
        });
    });

    return output.ready;
}

function stopCoreServer(server){
    if(!server){
        return Promise.resolve({hookCount:0,afterServeCount:0});
    }
    server.agent.destroy();
    if(server.child.exitCode!==null){
        return Promise.reject(
            new Error('Core benchmark server exited early.'+(server.stderr().trim() ? '\n'+server.stderr().trim() : ''))
        );
    }

    return new Promise(function(resolve,reject){
        let diagnostics;
        let settled=false;
        let shutdownError;
        let forceTimer;
        let hardTimer;
        const timer=setTimeout(function(){
            terminate(new Error('Core benchmark server shutdown exceeded 10 seconds.'));
        },10000);

        function cleanup(){
            clearTimeout(timer);
            clearTimeout(forceTimer);
            clearTimeout(hardTimer);
            server.child.removeListener('error',onError);
            server.child.removeListener('exit',onExit);
            server.child.removeListener('message',onMessage);
        }

        function finish(callback,value){
            if(settled){
                return;
            }
            settled=true;
            cleanup();
            callback(value);
        }

        function terminate(error){
            if(settled){
                return;
            }
            shutdownError=shutdownError || error;

            if(server.child.exitCode!==null){
                finish(reject,shutdownError);
                return;
            }

            server.child.kill('SIGTERM');
            forceTimer=forceTimer || setTimeout(function(){
                if(server.child.exitCode===null){
                    server.child.kill('SIGKILL');
                }
            },500);
            hardTimer=hardTimer || setTimeout(function(){
                finish(reject,shutdownError);
            },2000);
        }

        function onError(error){
            terminate(error);
        }

        function onMessage(message){
            if(message && message.type=='closed'){
                diagnostics=message.diagnostics;
            }
            if(message && message.type=='error'){
                terminate(new Error(message.message));
            }
        }

        function onExit(code,signal){
            if(shutdownError){
                finish(reject,shutdownError);
                return;
            }
            if(code!==0 || !diagnostics){
                finish(
                    reject,
                    new Error(
                        'Core benchmark server stopped unexpectedly ('+(signal || code)+').' +
                        (server.stderr().trim() ? '\n'+server.stderr().trim() : '')
                    )
                );
                return;
            }
            finish(resolve,diagnostics);
        }

        server.child.once('error',onError);
        server.child.once('exit',onExit);
        server.child.on('message',onMessage);
        server.child.send({type:'close'},function(error){
            if(error){
                terminate(error);
            }
        });
    });
}

function compareWorkerScenario(definition,baseline,candidate,options,fixtures,harness){
    const samples={baseline:[],candidate:[]};

    for(let sample=0;sample<options.samples;sample++){
        const order=sample%2 ? [candidate,baseline] : [baseline,candidate];

        for(const source of order){
            samples[source.id].push(runWorker(source,definition,fixtures,harness));
        }
    }

    const extra={};
    if(definition.correctness){
        extra.correctness={
            field:definition.correctness,
            baselineTotal:samples.baseline.reduce(
                (total,sample)=>total+sample[definition.correctness],
                0
            ),
            candidateTotal:samples.candidate.reduce(
                (total,sample)=>total+sample[definition.correctness],
                0
            )
        };
    }

    return comparisonResult(
        definition,
        samples,
        definition.metric,
        definition.unit,
        definition.direction,
        extra
    );
}

function runWorker(source,definition,fixtures,harness){
    const worker=path.join(harness.directory,'core-worker.js'),
        args=[
            '--expose-gc',
            worker,
            '--module',source.moduleDirectory,
            '--action',definition.action,
            '--count',String(definition.count)
        ];

    if(definition.action=='immediate-close'){
        args.push('--root',fixtures.root);
    }

    const result=childProcess.spawnSync(process.execPath,args,{
        cwd:projectRoot,
        encoding:'utf8',
        shell:false,
        timeout:180000,
        windowsHide:true,
        maxBuffer:10*1024*1024
    });

    if(result.error){
        throw result.error;
    }
    if(result.status!==0){
        throw new Error(
            source.id+' '+definition.id+' worker failed.' +
            (result.stderr ? '\n'+result.stderr.trim() : '') +
            (result.stdout ? '\n'+result.stdout.trim() : '')
        );
    }

    try{
        return JSON.parse(result.stdout);
    }catch(error){
        throw new Error(source.id+' '+definition.id+' worker returned invalid JSON.',{cause:error});
    }
}

function comparisonResult(definition,samples,metric,unit,direction,extra={}){
    const baselineValues=samples.baseline.map(sample=>sample[metric]),
        candidateValues=samples.candidate.map(sample=>sample[metric]),
        baselineSummary=sampleSummary(baselineValues),
        candidateSummary=sampleSummary(candidateValues),
        improvementRatio=direction=='higher'
            ? candidateSummary.median/baselineSummary.median
            : baselineSummary.median/candidateSummary.median,
        percent=direction=='higher'
            ? (candidateSummary.median/baselineSummary.median-1)*100
            : (1-candidateSummary.median/baselineSummary.median)*100,
        improved=improvementRatio>=1,
        ratio=improved ? improvementRatio : 1/improvementRatio;

    return Object.assign({
        id:definition.id,
        label:definition.label,
        kind:definition.kind,
        profile:scenarioProfile(definition),
        metric:metric,
        unit:unit,
        direction:direction,
        baseline:{summary:baselineSummary,samples:samples.baseline},
        candidate:{summary:candidateSummary,samples:samples.candidate},
        comparison:{
            ratio:rounded(ratio,3),
            candidateToBaseline:rounded(
                candidateSummary.median/baselineSummary.median,
                3
            ),
            percent:rounded(percent,1),
            label:improved
                ? direction=='higher' ? 'speedup' : 'reduction factor'
                : direction=='higher' ? 'slowdown' : 'increase'
        }
    },extra);
}

function scenarioProfile(definition){
    if(definition.kind=='worker'){
        return {action:definition.action,count:definition.count};
    }

    return {
        requestsPerSample:definition.requests,
        method:definition.request.method || 'GET',
        path:definition.request.path.split('?',1)[0],
        scenario:definition.scenario || 'default static path'
    };
}

function sampleSummary(values){
    assert.equal(values.length>0,true);
    assert.equal(values.every(Number.isFinite),true);

    const ordered=values.slice().sort((first,second)=>first-second),
        midpoint=Math.floor(ordered.length/2),
        median=ordered.length%2
            ? ordered[midpoint]
            : (ordered[midpoint-1]+ordered[midpoint])/2;

    return {
        median:rounded(median,3),
        minimum:rounded(ordered[0],3),
        maximum:rounded(ordered[ordered.length-1],3)
    };
}

function rounded(value,places=3){
    return Number(value.toFixed(places));
}

function byteLabel(value){
    if(value>=1024*1024 && value%(1024*1024)==0){
        return value/(1024*1024)+' MiB';
    }
    if(value>=1024){
        return rounded(value/1024,1)+' KiB';
    }
    return value+' B';
}

function formatOutput(output){
    const headings=[
            'Scenario',
            output.source.baseline.label+' median',
            'Candidate median',
            'Result'
        ],
        rows=output.scenarios.map(function(scenario){
            const baseline=formatMetric(scenario.baseline.summary.median,scenario.unit),
                candidate=formatMetric(scenario.candidate.summary.median,scenario.unit);
            let result=scenario.comparison.ratio.toFixed(2)+'x '+scenario.comparison.label;

            if(scenario.correctness){
                result=scenario.correctness.baselineTotal+' → '+
                    scenario.correctness.candidateTotal+' leaked listeners';
            }

            return [scenario.label,baseline,candidate,result];
        }),
        widths=headings.map(function(heading,index){
            return Math.max(heading.length,...rows.map(row=>row[index].length));
        }),
        line=function(row){
            return row.map((value,index)=>value.padEnd(widths[index])).join('  ').trimEnd()+'\n';
        };

    return [
        'node-http-server core comparison\n',
        output.source.baseline.label+' → '+output.source.candidate.label+'\n',
        output.environment.node+' | '+output.environment.platform+' '+output.environment.architecture+' | '+output.environment.processor+'\n',
        output.configuration.samples+' alternating samples; medians shown; raw samples retained\n\n',
        line(headings),
        line(widths.map(width=>'-'.repeat(width))),
        rows.map(line).join('')
    ].join('');
}

function formatMetric(value,unit){
    if(unit=='heap bytes/instance'){
        return byteLabel(Math.max(0,Math.round(value)));
    }
    if(unit.endsWith('/second')){
        return Math.round(value).toLocaleString('en-US')+' '+unit;
    }
    return rounded(value,3)+' '+unit;
}
