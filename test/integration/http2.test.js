'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http2 = require('node:http2');
const https = require('node:https');
const path = require('node:path');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const test = require('node:test');
const zlib = require('node:zlib');
const { request, temporaryDirectory, writeFiles } = require('../helpers.js');
const { Server } = require(process.env.NODE_HTTP_SERVER_TEST_PACKAGE || '../../server/Server.js');

// X.509 framing is confined to this disposable TLS fixture. No real credentials are used.
function der(tag, ...parts){
    const content = Buffer.concat(parts);
    const length = [];

    if(content.length < 128){
        length.push(content.length);
    }else{
        for(let remaining = content.length; remaining; remaining >>>= 8){
            length.unshift(remaining & 255);
        }
        length.unshift(128 | length.length);
    }

    return Buffer.concat([Buffer.from([tag, ...length]), content]);
}

function createCredentials(t){
    const directory = temporaryDirectory(t, 'node-http-server-http2-tls-');
    const { privateKey, publicKey } = crypto.generateKeyPairSync('rsa', {modulusLength:2048});
    const algorithm = der(0x30, der(0x06, Buffer.from('2a864886f70d01010b', 'hex')), der(0x05));
    const name = der(0x30, der(0x31, der(0x30,
        der(0x06, Buffer.from('550403', 'hex')),
        der(0x0c, Buffer.from('localhost'))
    )));
    const time = function(date){
        return der(0x18, Buffer.from(date.toISOString().replace(/[-:T]/g, '').replace('.000', '')));
    };
    const now = new Date();
    now.setMilliseconds(0);
    const certificateBody = der(0x30,
        der(0x02, Buffer.from([1])),
        algorithm,
        name,
        der(0x30, time(new Date(now.getTime() - 86400000)), time(new Date(now.getTime() + 86400000))),
        name,
        publicKey.export({type:'spki', format:'der'})
    );
    const certificate = der(0x30,
        certificateBody,
        algorithm,
        der(0x03, Buffer.from([0]), crypto.sign('sha256', certificateBody, privateKey))
    );
    const privateKeyPath = path.join(directory, 'localhost.key');
    const certificatePath = path.join(directory, 'localhost.cert');

    fs.writeFileSync(privateKeyPath, privateKey.export({type:'pkcs8', format:'pem'}));
    fs.writeFileSync(certificatePath,
        '-----BEGIN CERTIFICATE-----\n' +
        certificate.toString('base64').match(/.{1,64}/g).join('\n') +
        '\n-----END CERTIFICATE-----\n'
    );

    return {privateKey:privateKeyPath, certificate:certificatePath};
}

async function startSecure(t, credentials, config, decorate){
    const server = new Server({
        port:0,
        host:'127.0.0.1',
        https:{
            privateKey:credentials.privateKey,
            certificate:credentials.certificate,
            port:0,
            only:true
        }
    });
    const sessions = new Set();

    server.config.merge(config);
    if(decorate){
        decorate(server);
    }
    t.after(async function(){
        for(const session of sessions){
            session.destroy();
        }
        await server.close();
    });
    server.deploy();
    await Promise.all([server.server, server.secureServer].filter(Boolean).map(async function(listener){
        if(!listener.listening){
            await once(listener, 'listening');
        }
    }));

    return {
        server,
        connect:async function(){
            const session = http2.connect('https://127.0.0.1:' + server.secureServer.address().port, {
                servername:'localhost',
                rejectUnauthorized:false
            });
            sessions.add(session);
            session.once('close', ()=>sessions.delete(session));
            await once(session, 'connect');
            return session;
        }
    };
}

function h2Request(session, headers = {}, body){
    return new Promise(function(resolve, reject){
        const stream = session.request({':path':'/', ...headers}, {endStream:body === undefined});
        const chunks = [];
        let responseHeaders;

        stream.once('response', headers=>responseHeaders = headers);
        stream.on('data', chunk=>chunks.push(chunk));
        stream.once('error', reject);
        stream.once('aborted', ()=>reject(new Error('HTTP/2 request aborted')));
        stream.once('end', function(){
            const responseBody = Buffer.concat(chunks);
            resolve({headers:responseHeaders, body:responseBody, text:responseBody.toString()});
        });
        if(body !== undefined){
            stream.end(body);
        }
    });
}

function h1Request(server){
    return new Promise(function(resolve, reject){
        const client = https.get({
            hostname:'127.0.0.1',
            servername:'localhost',
            port:server.secureServer.address().port,
            rejectUnauthorized:false,
            agent:false,
            ALPNProtocols:['http/1.1']
        }, function(response){
            const chunks = [];
            const alpnProtocol = response.socket.alpnProtocol;

            response.on('data', chunk=>chunks.push(chunk));
            response.once('error', reject);
            response.once('end', function(){
                resolve({
                    alpnProtocol,
                    httpVersion:response.httpVersion,
                    text:Buffer.concat(chunks).toString()
                });
            });
        });
        client.once('error', reject);
    });
}

test('Integration | HTTP/2 over TLS', {timeout:30000}, async function(t){
    const credentials = createCredentials(t);

    await t.test('defaults to h2 with HTTP/1.1 TLS fallback and a plain HTTP listener', async function(t){
        const root = temporaryDirectory(t);
        writeFiles(root, {'index.html':'shared content'});
        const {server, connect} = await startSecure(t, credentials, {root, https:{only:false}});
        const session = await connect();
        const [h2, h1, plain] = await Promise.all([
            h2Request(session),
            h1Request(server),
            request(server)
        ]);

        assert.equal(session.alpnProtocol, 'h2');
        assert.equal(h2.headers[':status'], 200);
        assert.equal(h2.text, 'shared content');
        assert.equal(h1.alpnProtocol, 'http/1.1');
        assert.equal(h1.httpVersion, '1.1');
        assert.equal(h1.text, h2.text);
        assert.equal(plain.text, h2.text);
    });

    await t.test('explicit opt-out keeps the original HTTPS listener', async function(t){
        const root = temporaryDirectory(t);
        writeFiles(root, {'index.html':'HTTP/1.1 only'});
        const {server} = await startSecure(t, credentials, {root, https:{http2:false}});
        const response = await h1Request(server);

        assert.equal(server.secureServer instanceof https.Server, true);
        assert.equal(response.httpVersion, '1.1');
        assert.equal(response.text, 'HTTP/1.1 only');
    });

    await t.test('routes authority hosts and preserves static response semantics', async function(t){
        const root = temporaryDirectory(t);
        const otherRoot = temporaryDirectory(t);
        const content = 'shared static content '.repeat(100);
        writeFiles(root, {'index.html':'main'});
        writeFiles(otherRoot, {'index.html':content});
        const {connect} = await startSecure(t, credentials, {
            root,
            domain:'main.example',
            domains:{'other.example':otherRoot},
            server:{compression:true, compressionThreshold:0}
        });
        const session = await connect();
        const headers = {':authority':'other.example'};
        const initial = await h2Request(session, headers);
        const [head, range, cached, compressed, wrongHost] = await Promise.all([
            h2Request(session, {...headers, ':method':'HEAD'}),
            h2Request(session, {...headers, range:'bytes=0-5'}),
            h2Request(session, {...headers, 'if-none-match':initial.headers.etag}),
            h2Request(session, {...headers, 'accept-encoding':'gzip'}),
            h2Request(session, {':authority':'unknown.example'})
        ]);

        assert.equal(initial.headers[':status'], 200);
        assert.equal(initial.text, content);
        assert.equal(head.headers[':status'], 200);
        assert.equal(head.text, '');
        assert.equal(head.headers['content-type'], initial.headers['content-type']);
        assert.equal(range.headers[':status'], 206);
        assert.equal(range.text, 'shared');
        assert.equal(cached.headers[':status'], 304);
        assert.equal(cached.text, '');
        assert.equal(compressed.headers['content-encoding'], 'gzip');
        assert.equal(zlib.gunzipSync(compressed.body).toString(), content);
        assert.equal(wrongHost.headers[':status'], 421);
    });

    await t.test('collects bodies without Content-Length or Transfer-Encoding before hooks', async function(t){
        const root = temporaryDirectory(t);
        const observed = [];
        const {connect} = await startSecure(t, credentials, {root}, function(server){
            server.onRequest = function(request, response, serve){
                observed.push({
                    method:request.method,
                    body:request.body,
                    path:request.headers[':path'],
                    originalUrl:request.originalUrl,
                    url:request.url,
                    names:request.uri.query.name,
                    contentLength:request.headers['content-length'],
                    transferEncoding:request.headers['transfer-encoding']
                });
                serve(request, response, request.bodyBuffer);
                return true;
            };
        });
        const session = await connect();
        const payload = 'Full request: é\nsecond line';
        const requestPath = '/echo%20payload?name=%C3%A9&name=two';

        for(const method of ['POST', 'GET']){
            const response = await h2Request(session, {':method':method, ':path':requestPath}, payload);
            assert.equal(response.headers[':status'], 200);
            assert.equal(response.text, payload);
        }
        assert.deepEqual(observed, ['POST', 'GET'].map(method=>({
            method,
            body:payload,
            path:requestPath,
            originalUrl:requestPath,
            url:'/echo payload',
            names:['é', 'two'],
            contentLength:undefined,
            transferEncoding:undefined
        })));
    });

    await t.test('independent streams reach asynchronous hooks concurrently', async function(t){
        const root = temporaryDirectory(t);
        const reached = new Set();
        let release;
        const allReached = new Promise(resolve=>release = resolve);
        const {connect} = await startSecure(t, credentials, {root}, function(server){
            server.onRequest = async function(request, response, serve){
                reached.add(request.url);
                if(reached.size === 3){
                    release();
                }
                await allReached;
                await serve(request, response, request.url);
                return true;
            };
        });
        const session = await connect();
        const responses = await Promise.all(['/first', '/second', '/third'].map(function(url){
            return h2Request(session, {':path':url});
        }));

        assert.deepEqual(responses.map(response=>response.text), ['/first', '/second', '/third']);
    });

    await t.test('close drains active streams and idle sessions, then permits redeployment', async function(t){
        const root = temporaryDirectory(t);
        writeFiles(root, {'index.html':'redeployed'});
        let started;
        let release;
        const active = new Promise(resolve=>started = resolve);
        const continueResponse = new Promise(resolve=>release = resolve);
        const {server, connect} = await startSecure(t, credentials, {root}, function(server){
            server.onRequest = async function(request, response, serve){
                if(request.url === '/active'){
                    started();
                    await continueResponse;
                    await serve(request, response, 'completed before close');
                    return true;
                }
            };
        });
        const [activeSession, idleSession] = await Promise.all([connect(), connect()]);
        const response = h2Request(activeSession, {':path':'/active'});
        await active;
        const idleClosed = once(idleSession, 'close');
        const activeClosed = once(activeSession, 'close');
        let closed = false;
        const closing = server.close().then(()=>closed = true);
        await idleClosed;
        assert.equal(closed, false);
        release();
        assert.equal((await response).text, 'completed before close');
        await Promise.all([closing, activeClosed]);

        server.deploy();
        if(!server.secureServer.listening){
            await once(server.secureServer, 'listening');
        }
        const nextSession = await connect();
        assert.equal((await h2Request(nextSession)).text, 'redeployed');
    });

    await t.test('cancelling one file stream closes its source and preserves sibling requests', async function(t){
        const root = temporaryDirectory(t);
        writeFiles(root, {'cancel.txt':'streamed content', 'index.html':'still available'});
        const completed = [];
        const {connect} = await startSecure(t, credentials, {root}, function(server){
            server.afterServe = function(request){
                completed.push(request.originalUrl);
            };
        });
        const session = await connect();
        const originalCreateReadStream = fs.createReadStream;
        let sourceClosed;
        const destroyed = new Promise(resolve=>sourceClosed = resolve);

        fs.createReadStream = function(filename, options){
            if(path.basename(filename) !== 'cancel.txt'){
                return originalCreateReadStream.call(fs, filename, options);
            }
            let sent = false;
            return new Readable({
                read:function(){
                    if(!sent){
                        sent = true;
                        this.push('first');
                    }
                },
                destroy:function(error, callback){
                    sourceClosed();
                    callback(error);
                }
            });
        };

        try{
            const stream = session.request({':path':'/cancel.txt'});
            const streamClosed = once(stream, 'close');
            await once(stream, 'data');
            stream.close(http2.constants.NGHTTP2_CANCEL);
            await Promise.all([streamClosed, destroyed]);
            assert.equal(completed.includes('/cancel.txt'), false);
            assert.equal((await h2Request(session)).text, 'still available');
        }finally{
            fs.createReadStream = originalCreateReadStream;
        }
    });
});
