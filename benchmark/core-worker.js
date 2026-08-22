#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict'),
    path=require('node:path');

main().catch(function(error){
    process.stderr.write((error.stack || error.message) + '\n');
    process.exitCode=1;
});

async function main(){
    const options=parseArguments(process.argv.slice(2)),
        moduleDirectory=path.resolve(options.module),
        action=options.action,
        count=integerValue(options.count,'count');
    let output;

    if(action.startsWith('config-')){
        const Config=require(path.join(moduleDirectory,'Config.js'));

        output=configAction(Config,action,count);
    }else if(action=='immediate-close'){
        const serverModule=require(path.join(moduleDirectory,'Server.js'));

        output=await immediateClose(serverModule.Server,count,path.resolve(options.root));
    }else{
        throw new Error('Unknown core worker action '+JSON.stringify(action)+'.');
    }

    process.stdout.write(JSON.stringify(output) + '\n');
}

function parseArguments(input){
    const output={};

    for(let index=0;index<input.length;index+=2){
        const name=input[index];

        if(!name || !name.startsWith('--') || input[index+1]===undefined){
            throw new Error('Core worker options require --name value pairs.');
        }
        output[name.slice(2)]=input[index+1];
    }

    for(const required of ['module','action','count']){
        if(!output[required]){
            throw new Error('Core worker is missing --'+required+'.');
        }
    }

    return output;
}

function integerValue(value,name){
    const output=Number(value);

    if(!Number.isSafeInteger(output) || output<1){
        throw new TypeError(name+' must be a positive integer.');
    }

    return output;
}

function configAction(Config,action,count){
    if(action=='config-construct'){
        return constructConfigs(Config,count);
    }
    if(action=='config-retained'){
        return retainConfigs(Config,count);
    }
    if(action=='config-overlay-retained'){
        return retainConfigs(Config,count,{contentType:{thing:'application/x-thing'}});
    }
    if(action=='config-materialized-retained'){
        return retainConfigs(Config,count,undefined,true);
    }

    throw new Error('Unknown Config action '+JSON.stringify(action)+'.');
}

function constructConfigs(Config,count){
    const ring=new Array(64);
    let checksum=0;

    warmConfig(Config);
    global.gc?.();
    const started=process.hrtime.bigint();

    for(let index=0;index<count;index++){
        const config=new Config;

        ring[index%ring.length]=config;
        checksum+=config.port;
    }

    const durationNanoseconds=Number(process.hrtime.bigint()-started);

    assert.equal(checksum,8080*count);
    assert.equal(
        ring.filter(Boolean).length,
        Math.min(count,ring.length)
    );

    return {
        action:'config-construct',
        count:count,
        durationMilliseconds:durationNanoseconds/1e6,
        nanosecondsPerInstance:durationNanoseconds/count,
        instancesPerSecond:count/(durationNanoseconds/1e9),
        checksum:checksum
    };
}

function retainConfigs(Config,count,values,materialize=false){
    if(typeof global.gc!='function'){
        throw new Error('Retained-memory benchmarks require node --expose-gc.');
    }

    warmConfig(Config,values,materialize);
    const configs=new Array(count);
    global.gc();
    const before=process.memoryUsage(),
        started=process.hrtime.bigint();
    let checksum=0;

    for(let index=0;index<count;index++){
        const config=new Config(values);

        configs[index]=config;
        checksum+=config.port;
        if(materialize){
            checksum+=config.contentType.html.length;
        }
    }

    const durationNanoseconds=Number(process.hrtime.bigint()-started);

    global.gc();
    const after=process.memoryUsage(),
        heapBytes=after.heapUsed-before.heapUsed,
        rssBytes=after.rss-before.rss;

    assert.equal(configs.length,count);
    assert.equal(checksum>=8080*count,true);
    semanticConfigCheck(Config);

    return {
        action:materialize
            ? 'config-materialized-retained'
            : values
                ? 'config-overlay-retained'
                : 'config-retained',
        count:count,
        durationMilliseconds:durationNanoseconds/1e6,
        heapBytes:heapBytes,
        heapBytesPerInstance:heapBytes/count,
        rssBytes:rssBytes,
        checksum:checksum
    };
}

function warmConfig(Config,values,materialize){
    for(let index=0;index<128;index++){
        const config=new Config(values);

        if(materialize){
            assert.equal(typeof config.contentType.html,'string');
        }
    }
}

function semanticConfigCheck(Config){
    const first=new Config,
        second=new Config,
        firstMap=first.contentType,
        secondMap=second.contentType,
        keys=Object.keys(firstMap),
        originalHtml=secondMap.html;

    assert.notEqual(firstMap,secondMap);
    assert.equal(Object.hasOwn(firstMap,'html'),true);
    assert.equal(keys.length,Object.keys(secondMap).length);
    assert.deepEqual(keys,Object.keys(secondMap));

    firstMap.html='application/x-first-only';
    assert.equal(secondMap.html,originalHtml);

    const restored=new Config({contentType:false});
    restored.merge({contentType:{thing:'application/x-thing'}});
    assert.equal(restored.contentType.thing,'application/x-thing');
    assert.equal(restored.contentType.html,originalHtml);
}

async function immediateClose(Server,count,root){
    let leakedListeners=0;
    let readyCallbacks=0;
    let durationNanoseconds=0;

    for(let index=0;index<count;index++){
        const server=new Server({root:root,port:0}),
            started=process.hrtime.bigint();

        server.deploy(function(){
            readyCallbacks++;
        });
        await server.close();
        await new Promise(function(resolve){
            setImmediate(resolve);
        });
        durationNanoseconds+=Number(process.hrtime.bigint()-started);

        const nodeServers=[server.server,server.secureServer].filter(Boolean);
        if(nodeServers.some(nodeServer=>nodeServer.listening || nodeServer.address())){
            leakedListeners++;
        }

        for(const nodeServer of nodeServers){
            if(nodeServer.listening || nodeServer.address()){
                await new Promise(function(resolve){
                    nodeServer.close(function(){resolve();});
                });
            }
        }
    }

    return {
        action:'immediate-close',
        count:count,
        durationMilliseconds:durationNanoseconds/1e6,
        cyclesPerSecond:count/(durationNanoseconds/1e9),
        leakedListeners:leakedListeners,
        readyCallbacks:readyCallbacks
    };
}
