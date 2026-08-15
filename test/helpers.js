'use strict';

const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const net = require('node:net');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

function temporaryDirectory(t, name = 'node-http-server-test-'){
    const directory = fs.mkdtempSync(path.join(os.tmpdir(), name));

    t.after(function(){
        fs.rmSync(directory, {recursive:true, force:true});
    });

    return directory;
}

function writeFiles(root, files){
    for(const filename of Object.keys(files)){
        const fullPath = path.join(root, filename);

        fs.mkdirSync(path.dirname(fullPath), {recursive:true});
        fs.writeFileSync(fullPath, files[filename]);
    }
}

async function start(t, Server, config, decorate){
    const server = new Server(config);

    if(decorate){
        decorate(server);
    }

    const deployed = server.deploy();

    if(!server.server.listening){
        await once(server.server, 'listening');
    }

    t.after(async function(){
        await server.close();
    });

    return {server, deployed};
}

function request(server, options = {}){
    const address = server.server.address();
    const requestOptions = {
        hostname:'127.0.0.1',
        port:address.port,
        path:options.path || '/',
        method:options.method || 'GET',
        headers:options.headers || {}
    };

    if(options.setHost !== undefined){
        requestOptions.setHost = options.setHost;
    }

    return new Promise(function(resolve, reject){
        const request = http.request(
            requestOptions,
            function(response){
                const chunks = [];

                response.on('data', function(chunk){
                    chunks.push(chunk);
                });

                response.on('end', function(){
                    const body = Buffer.concat(chunks);

                    resolve({
                        statusCode:response.statusCode,
                        headers:response.headers,
                        body,
                        text:body.toString('utf8')
                    });
                });
            }
        );

        request.on('error', reject);

        if(Array.isArray(options.body)){
            for(const chunk of options.body){
                request.write(chunk);
            }
        }else if(options.body !== undefined){
            request.write(options.body);
        }

        request.end();
    });
}

function secureRequest(server, options = {}){
    const address = server.secureServer.address();

    return new Promise(function(resolve, reject){
        const request = https.request(
            {
                hostname:'127.0.0.1',
                port:address.port,
                path:options.path || '/',
                method:options.method || 'GET',
                headers:options.headers || {},
                rejectUnauthorized:false
            },
            function(response){
                const chunks = [];

                response.on('data', function(chunk){
                    chunks.push(chunk);
                });

                response.on('end', function(){
                    const body = Buffer.concat(chunks);

                    resolve({
                        statusCode:response.statusCode,
                        headers:response.headers,
                        body,
                        text:body.toString('utf8')
                    });
                });
            }
        );

        request.on('error', reject);
        request.end(options.body);
    });
}

function rawRequest(server, payload){
    const address = server.server.address();

    return new Promise(function(resolve, reject){
        const chunks = [];
        const socket = net.createConnection(address.port, '127.0.0.1');

        socket.on('connect', function(){
            socket.end(payload);
        });
        socket.on('data', function(chunk){
            chunks.push(chunk);
        });
        socket.on('end', function(){
            resolve(Buffer.concat(chunks).toString('latin1'));
        });
        socket.on('error', reject);
    });
}

async function waitFor(check, timeout = 2000){
    const started = Date.now();

    while(Date.now() - started < timeout){
        const value = check();

        if(value){
            return value;
        }

        await new Promise(function(resolve){
            setTimeout(resolve, 20);
        });
    }

    throw new Error('Timed out waiting for condition');
}

module.exports = {
    rawRequest,
    request,
    secureRequest,
    start,
    temporaryDirectory,
    waitFor,
    writeFiles
};
