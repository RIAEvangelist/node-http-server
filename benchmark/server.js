#!/usr/bin/env node
'use strict';

const serverModule=require('../server/Server.js');

const Server=serverModule.Server;
let server;
let started=false;
let closing;
let failed=false;

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
        throw new Error('Benchmark server received more than one start message');
    }
    started=true;

    if(!message.config || typeof message.config!='object' ||
        message.config.host!='127.0.0.1' || message.config.port!==0 ||
        typeof message.config.root!='string' || !message.config.root){
        throw new Error('Benchmark server received an invalid configuration');
    }
    if(typeof message.dynamicBody!='string'){
        throw new Error('Benchmark server received an invalid dynamic body');
    }

    const dynamicBody=Buffer.from(message.dynamicBody,'base64');
    server=new Server(message.config);
    server.onRequest=function(request,response,serve){
        if(request.url!='/dynamic'){
            return;
        }

        response.setHeader('Content-Type','application/json; charset=utf-8');
        return serve(request,response,dynamicBody).then(()=>true);
    };
    server.deploy(function(instance,nodeServer){
        const address=nodeServer.address();

        send({type:'ready',port:address.port});
    });
    server.server.once('error',fail);
}

function close(report){
    if(closing){
        return closing;
    }

    closing=Promise.resolve(server && server.close()).then(function(){
        if(report){
            send({type:'closed'});
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
        message:error && error.message || String(error)
    });

    Promise.resolve(server && server.close()).catch(function(){}).finally(function(){
        process.exitCode=1;
        if(process.connected){
            process.disconnect();
        }
    });
}
