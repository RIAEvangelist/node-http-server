#!/usr/bin/env node
'use strict';

const assert=require('node:assert/strict'),
    path=require('node:path');

let server;
let started=false;
let closing;
let failed=false;
let hookCount=0;
let afterServeCount=0;

process.on('message',function(message){
    if(!message || typeof message!='object'){
        return;
    }
    if(message.type=='start'){
        start(message).catch(fail);
        return;
    }
    if(message.type=='close'){
        close(true).catch(fail);
    }
});

process.once('disconnect',function(){
    close(false).catch(function(){
        process.exitCode=1;
    });
});
process.once('SIGINT',function(){
    close(false).catch(function(){
        process.exitCode=1;
    });
});
process.once('SIGTERM',function(){
    close(false).catch(function(){
        process.exitCode=1;
    });
});
process.once('uncaughtException',fail);
process.once('unhandledRejection',fail);

async function start(message){
    if(started){
        throw new Error('Core benchmark server received more than one start message.');
    }
    started=true;

    const moduleDirectory=path.resolve(String(message.moduleDirectory || '')),
        serverModule=require(path.join(moduleDirectory,'Server.js')),
        Server=serverModule.Server,
        scenario=String(message.scenario || ''),
        config=message.config;

    if(typeof Server!='function' || !config || typeof config!='object'){
        throw new Error('Core benchmark server received an invalid startup contract.');
    }

    server=new Server(config);
    configureScenario(server,scenario,message.options || {});
    server.deploy(function(instance,nodeServer){
        const address=nodeServer.address();

        send({type:'ready',port:address.port});
    });
    server.server?.once('error',fail);
}

function configureScenario(instance,scenario,options){
    if(scenario=='query-repeat'){
        instance.onRequest=function(request,response,serve){
            const values=request.uri.query.a;

            assert.equal(Array.isArray(values),true);
            assert.equal(values.length,options.queryValues);
            assert.equal(values[0],'0');
            assert.equal(values[values.length-1],String(options.queryValues-1));
            response.setHeader('X-Query-Count',values.length);
            response.setHeader('X-Query-First',values[0]);
            response.setHeader('X-Query-Last',values[values.length-1]);
            return serve(request,response,'query-ok').then(()=>true);
        };
        return;
    }

    if(scenario=='bodyless-hook'){
        instance.onRequest=function(request,response,serve){
            assert.equal(request.body,'');
            assert.equal(Buffer.isBuffer(request.bodyBuffer),true);
            assert.equal(request.bodyBuffer.length,0);
            assert.equal(request.uri.pathname,'/hook');
            response.setHeader('X-Body-Bytes',request.bodyBuffer.length);
            return serve(request,response,'hook-ok').then(()=>true);
        };
        return;
    }

    if(scenario=='range-before-serve'){
        instance.beforeServe=function(request,response,body){
            hookCount++;
            assert.equal(Buffer.isBuffer(body.value),true);
            assert.equal(body.value.length,options.rangeBytes);
            response.setHeader('X-Hook-Bytes',body.value.length);
            body.value=Buffer.concat([body.value,Buffer.from('!')]);
        };
        instance.afterServe=function(){
            afterServeCount++;
        };
        return;
    }

    if(scenario=='head-before-serve'){
        instance.beforeServe=function(request,response,body){
            hookCount++;
            assert.equal(request.method,'HEAD');
            assert.equal(Buffer.isBuffer(body.value),true);
            assert.equal(body.value.length,options.largeBytes);
            response.setHeader('X-Hook-Bytes',body.value.length);
        };
        instance.afterServe=function(){
            afterServeCount++;
        };
    }
}

function close(report){
    if(closing){
        return closing;
    }

    closing=Promise.resolve(server && server.close()).then(function(){
        if(report){
            send({
                type:'closed',
                diagnostics:{
                    hookCount:hookCount,
                    afterServeCount:afterServeCount
                }
            });
        }
        if(process.connected){
            process.disconnect();
        }
    });

    return closing;
}

function send(message){
    if(process.connected){
        process.send(message);
    }
}

function fail(error){
    if(failed){
        return;
    }
    failed=true;

    send({
        type:'error',
        message:error && error.stack || error && error.message || String(error)
    });

    Promise.resolve(server && server.close()).catch(function(){}).finally(function(){
        process.exitCode=1;
        if(process.connected){
            process.disconnect();
        }
    });
}
