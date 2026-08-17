'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { once } = require('node:events');
const { Readable } = require('node:stream');
const test = require('node:test');
const zlib = require('node:zlib');
const serverModule = require('../../server/Server.js');
const {
    rawRequest,
    request,
    start,
    temporaryDirectory,
    waitFor,
    writeFiles
} = require('../helpers.js');

const Server = serverModule.Server;

test('Integration | simultaneous instances isolate roots and ephemeral ports', async function(t){
    const firstRoot = temporaryDirectory(t, 'node-http-server-first-');
    const secondRoot = temporaryDirectory(t, 'node-http-server-second-');

    writeFiles(firstRoot, {'index.html':'first'});
    writeFiles(secondRoot, {'index.html':'second'});

    const first = await start(t, Server, {root:firstRoot, port:0});
    const second = await start(t, Server, {root:secondRoot, port:0});

    assert.notEqual(first.server.server.address().port, second.server.server.address().port);
    assert.equal((await request(first.server)).text, 'first');
    assert.equal((await request(second.server)).text, 'second');
});

test('Integration | HTTPS-only deploy wires credentials and exposes only secureServer', async function(t){
    const root = temporaryDirectory(t);
    const key = path.join(root, 'temporary.key');
    const certificate = path.join(root, 'temporary.cert');

    writeFiles(root, {
        'index.html':'secure',
        'temporary.key':'test key bytes',
        'temporary.cert':'test certificate bytes'
    });

    const logs = [];
    const originalLog = console.log;
    const originalCreateServer = https.createServer;
    let optionsSeen;
    const server = new Server({
        root,
        port:0,
        verbose:true,
        https:{
            ca:certificate,
            privateKey:key,
            certificate,
            passphrase:'temporary passphrase',
            port:0,
            only:true
        }
    });

    console.log = function(){
        logs.push(Array.from(arguments));
    };
    https.createServer = function(options, handler){
        optionsSeen = options;
        return http.createServer(handler);
    };

    try{
        server.deploy();
        https.createServer = originalCreateServer;

        if(!server.secureServer.listening){
            await once(server.secureServer, 'listening');
        }

        assert.equal(server.server, null);
        assert.deepEqual(server.address(), server.secureServer.address());
        assert.equal((await request({server:server.secureServer})).text, 'secure');
        assert.deepEqual(optionsSeen.key, Buffer.from('test key bytes'));
        assert.deepEqual(optionsSeen.cert, Buffer.from('test certificate bytes'));
        assert.deepEqual(optionsSeen.ca, Buffer.from('test certificate bytes'));
        assert.equal(optionsSeen.passphrase, 'temporary passphrase');
        assert.ok(logs.length >= 2);
    }finally{
        https.createServer = originalCreateServer;
        console.log = originalLog;
        await server.close();
    }
});

test('Integration | a large binary response preserves bytes and content-length', async function(t){
    const root = temporaryDirectory(t);
    const large = crypto.randomBytes(1024 * 1024);

    writeFiles(root, {'large.bin':large});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/large.bin'});

    assert.equal(response.statusCode, 200);
    assert.equal(Number(response.headers['content-length']), large.length);
    assert.deepEqual(response.body, large);
});

test('Integration | malformed raw socket input receives HTTP 400 and records the client error', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});
    const response = await rawRequest(server, 'BROKEN REQUEST\r\n\r\n');

    assert.match(response, /^HTTP\/1\.1 400 Bad Request/);
    await waitFor(()=>server.lastError);
    assert.equal(server.lastError instanceof Error, true);
});

test('Integration | compressed SPA fallback preserves Vary and exact response content', async function(t){
    const root = temporaryDirectory(t);
    const index = '<main>' + 'compressible '.repeat(200) + '</main>';

    writeFiles(root, {'index.html':index});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{
            spaFallback:true,
            compression:true,
            compressionThreshold:0
        }
    }, function(server){
        server.onRequest = function(request, response){
            response.setHeader('Vary', 'Origin');
        };
    });
    const response = await request(server, {
        path:'/dashboard/settings',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.match(response.headers.vary, /Accept-Encoding/i);
    assert.match(response.headers.vary, /Origin/i);
    assert.equal(zlib.gunzipSync(response.body).toString(), index);
});

test('Integration | aborting a client destroys its source stream', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'abort.bin':Buffer.alloc(1024 * 1024)});

    const {server} = await start(t, Server, {root, port:0});
    const originalCreateReadStream = fs.createReadStream;
    let destroyed = false;
    let timer;

    fs.createReadStream = function(filename, options){
        if(path.basename(filename) !== 'abort.bin'){
            return originalCreateReadStream.call(fs, filename, options);
        }

        return new Readable({
            read:function(){
                if(timer){
                    return;
                }

                timer = setInterval(()=>this.push(Buffer.alloc(16384)), 5);
            },
            destroy:function(error, callback){
                clearInterval(timer);
                destroyed = true;
                callback(error);
            }
        });
    };

    try{
        await new Promise(function(resolve, reject){
            const client = http.get(
                {
                    hostname:'127.0.0.1',
                    port:server.server.address().port,
                    path:'/abort.bin'
                },
                function(response){
                    response.once('data', function(){
                        response.on('error', function(){});
                        response.destroy();
                        resolve();
                    });
                }
            );

            client.on('error', reject);
        });

        await waitFor(()=>destroyed);
        assert.equal(destroyed, true);
    }finally{
        clearInterval(timer);
        fs.createReadStream = originalCreateReadStream;
    }
});

test('Integration | default file logging writes one parseable credential-redacted NDJSON record', async function(t){
    const root = temporaryDirectory(t);
    const log = path.join(root, 'requests.ndjson');
    const secret = 'top-secret-token';

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0, log});
    const response = await request(server, {
        headers:{
            Authorization:'Bearer ' + secret,
            Cookie:'session=' + secret
        }
    });

    assert.equal(response.statusCode, 200);

    const data = await waitFor(function(){
        if(!fs.existsSync(log)){
            return;
        }

        const value = fs.readFileSync(log, 'utf8');
        return value.endsWith('\n') && value;
    });
    const lines = data.trim().split('\n');

    assert.equal(lines.length, 1);
    assert.doesNotMatch(data, new RegExp(secret));

    const entry = JSON.parse(lines[0]);

    assert.equal(entry.method, 'GET');
    assert.equal(entry.url, '/');
    assert.equal(typeof entry.timestamp, 'number');
});
