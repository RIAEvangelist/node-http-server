'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');
const { PassThrough, Readable } = require('node:stream');
const test = require('node:test');
const zlib = require('node:zlib');
const serverModule = require('../server/Server.js');
const {
    rawRequest,
    request,
    start,
    temporaryDirectory,
    waitFor,
    writeFiles
} = require('./helpers.js');

const Server = serverModule.Server;

test('deploy returns its instance, supports simultaneous servers, close, and redeploy', async function(t){
    const firstRoot = temporaryDirectory(t, 'node-http-server-first-');
    const secondRoot = temporaryDirectory(t, 'node-http-server-second-');

    writeFiles(firstRoot, {'index.html':'first'});
    writeFiles(secondRoot, {'index.html':'second'});

    const firstResult = await start(t, Server, {root:firstRoot, port:0});
    const secondResult = await start(t, Server, {root:secondRoot, port:0});

    assert.equal(firstResult.deployed, firstResult.server);
    assert.equal(secondResult.deployed, secondResult.server);
    assert.notEqual(firstResult.server.server.address().port, secondResult.server.server.address().port);
    assert.equal(firstResult.server.server.address().address, '127.0.0.1');
    assert.deepEqual(firstResult.server.address(), firstResult.server.server.address());
    assert.equal(firstResult.server.secureServer == null, true);
    assert.equal((await request(firstResult.server)).text, 'first');
    assert.equal((await request(secondResult.server)).text, 'second');

    const closing = firstResult.server.close();

    assert.equal(closing instanceof Promise, true);
    await closing;
    assert.equal(firstResult.server.server.listening, false);

    let callbackServer;
    const deployed = firstResult.server.deploy({port:0}, function(instance){
        callbackServer = instance;
    });

    assert.equal(deployed, firstResult.server);

    if(!firstResult.server.server.listening){
        await new Promise(function(resolve, reject){
            firstResult.server.server.once('listening', resolve);
            firstResult.server.server.once('error', reject);
        });
    }

    assert.equal(callbackServer, firstResult.server);
    assert.equal((await request(firstResult.server)).text, 'first');
});

test('deploy rejects invalid configuration and duplicate deployment', async function(t){
    const root = temporaryDirectory(t);
    const rootFile = path.join(root, 'not-a-directory');

    writeFiles(root, {
        'index.html':'ok',
        'not-a-directory':'file'
    });

    assert.throws(()=>new Server({root, port:-1}).deploy(), /port must be an integer/);
    assert.throws(()=>new Server({root, port:65536}).deploy(), /port must be an integer/);
    assert.throws(()=>new Server({root, port:1.5}).deploy(), /port must be an integer/);
    assert.throws(()=>new Server({root, host:''}).deploy(), /host must be a non-empty string/);
    assert.throws(()=>new Server({root:rootFile}).deploy(), /root must be a directory/);
    assert.throws(
        ()=>new Server({root, domains:{'invalid.test':rootFile}}).deploy(),
        /domains\.invalid\.test must be a directory/
    );
    assert.throws(
        ()=>new Server({root, server:{timeout:-1}}).deploy(),
        /server\.timeout must be a non-negative number/
    );
    assert.throws(
        ()=>new Server({root, server:{requestTimeout:Infinity}}).deploy(),
        /server\.requestTimeout must be a non-negative number/
    );
    assert.throws(
        ()=>new Server({root, server:{maxRequestBodyBytes:-1}}).deploy(),
        /maxRequestBodyBytes must be a non-negative number or false/
    );
    assert.throws(
        ()=>new Server({root, server:{compressionThreshold:-1}}).deploy(),
        /compressionThreshold must be a non-negative number/
    );
    assert.throws(
        ()=>new Server({root, https:{port:'invalid'}}).deploy(),
        /https\.port must be an integer/
    );
    assert.throws(
        ()=>new Server({root, https:{certificate:'missing'}}).deploy(),
        function(error){
            return error.code === 'ERR_HTTPS_CONFIGURATION';
        }
    );
    assert.throws(
        ()=>new Server({root, https:{only:true}}).deploy(),
        function(error){
            return error.code === 'ERR_HTTPS_CONFIGURATION';
        }
    );

    writeFiles(root, {
        'invalid.key':'not a private key',
        'invalid.cert':'not a certificate'
    });
    const atomic = new Server({
        root,
        port:0,
        https:{
            privateKey:path.join(root, 'invalid.key'),
            certificate:path.join(root, 'invalid.cert'),
            port:0
        }
    });

    assert.throws(()=>atomic.deploy());
    assert.equal(atomic.server, null);
    assert.equal(atomic.secureServer, null);
    assert.equal(atomic._deployed, false);
    assert.throws(()=>new Server({root}).deploy(null, 'invalid'), /readyCallback must be a function/);

    let callbackServer;
    const active = new Server({root, port:0});

    active.deploy(function(instance){
        callbackServer = instance;
    });
    t.after(()=>active.close());

    if(!active.server.listening){
        await new Promise(function(resolve, reject){
            active.server.once('listening', resolve);
            active.server.once('error', reject);
        });
    }

    assert.equal(callbackServer, active);
    assert.throws(
        ()=>active.deploy(),
        function(error){
            return error.code === 'ERR_SERVER_ALREADY_DEPLOYED';
        }
    );
});

test('close supports callbacks, repeated calls, idle servers, and close errors', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});
    let callbacks = 0;
    const firstClose = server.close(function(){
        callbacks++;
    });
    const secondClose = server.close(function(){
        callbacks++;
    });

    await Promise.all([firstClose, secondClose]);
    assert.equal(callbacks, 2);
    assert.equal(server.address(), null);

    await server.close(function(){
        callbacks++;
    });
    assert.equal(callbacks, 3);
    await assert.rejects(server.close('invalid'), /callback must be a function/);

    const closeError = new Error('close failed');
    const failed = new Server({root});
    let idleClosed = false;
    let callbackError;

    failed._deployed = true;
    failed.server = {
        listening:true,
        closeIdleConnections:function(){
            idleClosed = true;
        },
        close:function(callback){
            callback(closeError);
        }
    };

    await assert.rejects(
        failed.close(function(error){
            callbackError = error;
        }),
        /close failed/
    );
    assert.equal(idleClosed, true);
    assert.equal(callbackError, closeError);
});

test('HTTPS-only deployment configures secureServer without repository key fixtures', async function(t){
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
            await new Promise(function(resolve, reject){
                server.secureServer.once('listening', resolve);
                server.secureServer.once('error', reject);
            });
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

test('static files support GET, HEAD, indexes, modern MIME, fallback MIME, and restrictions', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'home',
        'nested/index.html':'nested',
        'image.webp':Buffer.from([1, 2, 3]),
        'module.wasm':Buffer.from([0, 97, 115, 109]),
        'unknown.future':'future',
        'safe.toString':'safe',
        'safe.constructor':'safe',
        'blocked.key':'private',
        'unsupported.deny':'unsupported'
    });

    const {server} = await start(t, Server, {
        root,
        port:0,
        restrictedType:{key:true},
        contentType:{deny:false}
    });

    const index = await request(server);
    const nested = await request(server, {path:'/nested/'});
    const head = await request(server, {path:'/index.html', method:'HEAD'});
    const webp = await request(server, {path:'/image.webp'});
    const wasm = await request(server, {path:'/module.wasm'});
    const unknown = await request(server, {path:'/unknown.future'});
    const inheritedMime = await request(server, {path:'/safe.constructor'});
    const inheritedRestriction = await request(server, {path:'/safe.toString'});
    const blocked = await request(server, {path:'/blocked.key'});
    const unsupported = await request(server, {path:'/unsupported.deny'});
    const method = await request(server, {path:'/index.html', method:'POST'});

    assert.equal(index.statusCode, 200);
    assert.equal(index.text, 'home');
    assert.equal(nested.text, 'nested');
    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers['content-length']), Buffer.byteLength('home'));
    assert.equal(webp.headers['content-type'], 'image/webp');
    assert.equal(wasm.headers['content-type'], 'application/wasm');
    assert.equal(unknown.headers['content-type'], 'application/octet-stream');
    assert.equal(inheritedMime.headers['content-type'], 'application/octet-stream');
    assert.equal(inheritedRestriction.statusCode, 200);
    assert.equal(blocked.statusCode, 403);
    assert.equal(unsupported.statusCode, 415);
    assert.equal(method.statusCode, 405);
    assert.match(method.headers.allow, /GET/);
    assert.match(method.headers.allow, /HEAD/);
});

test('contentType false removes automatic MIME selection without preventing files', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'plain'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        contentType:false
    });
    const response = await request(server);

    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-type'], 'application/octet-stream');
    assert.equal(response.text, 'plain');
});

test('files are streamed with byte ranges and conditional ETags', async function(t){
    const root = temporaryDirectory(t);
    const large = crypto.randomBytes(1024 * 1024);

    writeFiles(root, {
        'bytes.txt':'0123456789',
        'empty.txt':'',
        'large.bin':large
    });

    const {server} = await start(t, Server, {root, port:0});
    const normal = await request(server, {path:'/bytes.txt'});
    const partial = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=2-5'}
    });
    const invalid = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=50-60'}
    });
    const cached = await request(server, {
        path:'/bytes.txt',
        headers:{'If-None-Match':normal.headers.etag}
    });
    const wildcardCached = await request(server, {
        path:'/bytes.txt',
        headers:{'If-None-Match':'*'}
    });
    const modifiedSince = await request(server, {
        path:'/bytes.txt',
        headers:{'If-Modified-Since':normal.headers['last-modified']}
    });
    const invalidModifiedSince = await request(server, {
        path:'/bytes.txt',
        headers:{'If-Modified-Since':'not-a-date'}
    });
    const suffix = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=-3'}
    });
    const openEnded = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=7-'}
    });
    const clamped = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=8-99'}
    });
    const matchingIfRange = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':normal.headers.etag}
    });
    const staleIfRange = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':'W/"stale"'}
    });
    const dateIfRange = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':normal.headers['last-modified']}
    });
    const headRange = await request(server, {
        path:'/bytes.txt',
        method:'HEAD',
        headers:{Range:'bytes=0-1'}
    });
    const ignoredRanges = await Promise.all([
        request(server, {path:'/bytes.txt', headers:{Range:'items=0-1'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=0-1,3-4'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=--'}})
    ]);
    const unsatisfiedRanges = await Promise.all([
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=-0'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=5-2'}}),
        request(server, {path:'/empty.txt', headers:{Range:'bytes=0-1'}})
    ]);
    const empty = await request(server, {path:'/empty.txt'});
    const emptyHead = await request(server, {path:'/empty.txt', method:'HEAD'});
    const streamed = await request(server, {path:'/large.bin'});

    assert.equal(normal.statusCode, 200);
    assert.ok(normal.headers.etag);
    assert.equal(normal.headers['accept-ranges'], 'bytes');
    assert.equal(partial.statusCode, 206);
    assert.equal(partial.text, '2345');
    assert.equal(partial.headers['content-range'], 'bytes 2-5/10');
    assert.equal(Number(partial.headers['content-length']), 4);
    assert.equal(invalid.statusCode, 416);
    assert.equal(invalid.headers['content-range'], 'bytes */10');
    assert.equal(cached.statusCode, 304);
    assert.equal(cached.body.length, 0);
    assert.equal(wildcardCached.statusCode, 304);
    assert.equal(modifiedSince.statusCode, 304);
    assert.equal(invalidModifiedSince.statusCode, 200);
    assert.equal(suffix.text, '789');
    assert.equal(openEnded.text, '789');
    assert.equal(clamped.text, '89');
    assert.equal(matchingIfRange.statusCode, 200);
    assert.equal(matchingIfRange.text, '0123456789');
    assert.equal(dateIfRange.statusCode, 206);
    assert.equal(staleIfRange.statusCode, 200);
    assert.equal(staleIfRange.text, '0123456789');
    assert.equal(headRange.statusCode, 200);
    assert.equal(headRange.body.length, 0);
    assert.equal(Number(headRange.headers['content-length']), 10);
    assert.equal(ignoredRanges.every(response=>response.statusCode === 200), true);
    assert.equal(unsatisfiedRanges.every(response=>response.statusCode === 416), true);
    assert.equal(empty.statusCode, 200);
    assert.equal(empty.body.length, 0);
    assert.equal(Number(empty.headers['content-length']), 0);
    assert.equal(emptyHead.statusCode, 200);
    assert.equal(emptyHead.body.length, 0);
    assert.equal(Number(streamed.headers['content-length']), large.length);
    assert.deepEqual(streamed.body, large);
});

test('decoded paths stay inside their selected roots and malformed paths are rejected', async function(t){
    const workspace = temporaryDirectory(t);
    const root = path.join(workspace, 'public');

    writeFiles(workspace, {
        'public/index.html':'inside',
        'secret.txt':'outside'
    });

    const {server} = await start(t, Server, {root, port:0});
    const traversal = await request(server, {path:'/..%2fsecret.txt'});
    const windowsTraversal = await request(server, {path:'/..%5csecret.txt'});
    const malformed = await request(server, {path:'/%E0%A4%A'});
    const nullByte = await request(server, {path:'/%00'});
    const noHost = await request(server, {setHost:false});
    const invalidHost = await request(server, {headers:{Host:'['}});

    assert.equal(traversal.statusCode, 403);
    assert.equal(windowsTraversal.statusCode, 403);
    assert.equal(malformed.statusCode, 400);
    assert.equal(nullByte.statusCode, 400);
    assert.equal(noHost.statusCode, 400);
    assert.equal(invalidHost.statusCode, 400);
    assert.doesNotMatch(traversal.text, /outside/);
});

test('Windows alternate data streams cannot be served', {
    skip:process.platform!='win32'
}, async function(t){
    const root = temporaryDirectory(t);
    const filename = path.join(root, 'visible.txt');

    writeFiles(root, {'visible.txt':'visible'});
    fs.writeFileSync(filename + ':hidden', 'hidden stream');

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/visible.txt:hidden'});

    assert.equal(response.statusCode, 403);
    assert.doesNotMatch(response.text, /hidden stream/);
});

test('requests expose parsed URI/query data and malformed wire requests get 400', async function(t){
    const root = temporaryDirectory(t);
    let uri;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            if(request.url !== '/inspect'){
                return;
            }

            uri = request.uri;
            serve(request, response, 'inspected');
            return true;
        };
    });
    const inspected = await request(server, {
        path:'/inspect?a=1&a=2&b=3',
        headers:{Host:'[::1]:1234'}
    });
    const malformedWire = await rawRequest(server, 'BROKEN REQUEST\r\n\r\n');
    const absoluteTarget = await request(server, {
        path:'http://example.test/index.html',
        headers:{Host:'example.test'}
    });

    assert.equal(inspected.text, 'inspected');
    assert.deepEqual(uri.query.a, ['1', '2']);
    assert.equal(uri.query.b, '3');
    assert.equal(uri.hostname, '::1');
    assert.equal(uri.port, 1234);
    assert.match(malformedWire, /^HTTP\/1\.1 400 Bad Request/);
    assert.equal(absoluteTarget.statusCode, 200);
    assert.ok(server.lastError instanceof Error);
});

test('domain routing selects roots and rejects unknown hosts', async function(t){
    const baseRoot = temporaryDirectory(t, 'node-http-server-domain-');
    const alternateRoot = temporaryDirectory(t, 'node-http-server-alt-domain-');

    writeFiles(baseRoot, {'index.html':'primary'});
    writeFiles(alternateRoot, {'index.html':'alternate'});

    const {server} = await start(t, Server, {
        root:baseRoot,
        port:0,
        domain:'primary.test',
        domains:{'Alternate.TEST':alternateRoot}
    });
    const primary = await request(server, {headers:{Host:'primary.test'}});
    const alternate = await request(server, {headers:{Host:'alternate.test'}});
    const unknown = await request(server, {headers:{Host:'unknown.test'}});

    assert.equal(primary.text, 'primary');
    assert.equal(alternate.text, 'alternate');
    assert.equal(unknown.statusCode, 421);
});

test('SPA fallback and compression remain opt-in and configurable', async function(t){
    const root = temporaryDirectory(t);
    const index = '<main>' + 'compressible '.repeat(200) + '</main>';

    writeFiles(root, {
        'index.html':index,
        'app.html':'custom fallback',
        'small.txt':'small',
        'binary.bin':Buffer.alloc(2048)
    });

    const disabledResult = await start(t, Server, {root, port:0});
    const missing = await request(disabledResult.server, {path:'/dashboard/settings'});

    assert.equal(missing.statusCode, 404);

    const enabledResult = await start(t, Server, {
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
    const compressed = await request(enabledResult.server, {
        path:'/dashboard/settings',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(compressed.statusCode, 200);
    assert.equal(compressed.headers['content-encoding'], 'gzip');
    assert.match(compressed.headers.vary, /Accept-Encoding/i);
    assert.match(compressed.headers.vary, /Origin/i);
    assert.equal(zlib.gunzipSync(compressed.body).toString(), index);

    const brotli = await request(enabledResult.server, {
        headers:{'Accept-Encoding':'br, gzip;q=0.5'}
    });
    const noAcceptedEncoding = await request(enabledResult.server, {
        headers:{'Accept-Encoding':'br;q=0, gzip;q=0, identity'}
    });
    const ranged = await request(enabledResult.server, {
        headers:{Range:'bytes=0-9', 'Accept-Encoding':'gzip'}
    });
    const binary = await request(enabledResult.server, {
        path:'/binary.bin',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(brotli.headers['content-encoding'], 'br');
    assert.equal(zlib.brotliDecompressSync(brotli.body).toString(), index);
    assert.equal(noAcceptedEncoding.headers['content-encoding'], undefined);
    assert.equal(ranged.headers['content-encoding'], undefined);
    assert.equal(binary.headers['content-encoding'], undefined);

    const customFallback = await start(t, Server, {
        root,
        port:0,
        server:{spaFallback:'app.html'}
    });
    const custom = await request(customFallback.server, {
        path:'/custom/route',
        headers:{Accept:'text/html'}
    });
    const rejectsJson = await request(customFallback.server, {
        path:'/api/route',
        headers:{Accept:'application/json'}
    });
    const rejectsExtension = await request(customFallback.server, {
        path:'/missing.js',
        headers:{Accept:'text/html'}
    });

    assert.equal(custom.text, 'custom fallback');
    assert.equal(rejectsJson.statusCode, 404);
    assert.equal(rejectsExtension.statusCode, 404);

    const thresholdResult = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:100}
    });
    const small = await request(thresholdResult.server, {
        path:'/small.txt',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(small.headers['content-encoding'], undefined);
});

test('request bodies expose string and Buffer forms and enforce an optional byte limit', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'unused'});

    let bodySeen;
    let bufferSeen;
    let requestCount = 0;
    const limitedResult = await start(
        t,
        Server,
        {
            root,
            port:0,
            server:{maxRequestBodyBytes:4}
        },
        function(server){
            server.onRequest = function(request, response, serve){
                requestCount++;
                bodySeen = request.body;
                bufferSeen = request.bodyBuffer;
                response.setHeader('Content-Type', 'application/octet-stream');
                serve(request, response, request.bodyBuffer);
                return true;
            };
        }
    );
    const accepted = await request(limitedResult.server, {
        path:'/echo',
        method:'POST',
        body:Buffer.from([0xc3, 0xa9])
    });
    const rejected = await request(limitedResult.server, {
        path:'/echo',
        method:'POST',
        body:'12345'
    });

    assert.equal(accepted.statusCode, 200);
    assert.equal(bodySeen, 'é');
    assert.equal(Buffer.isBuffer(bufferSeen), true);
    assert.deepEqual(accepted.body, Buffer.from([0xc3, 0xa9]));
    assert.equal(rejected.statusCode, 413);
    assert.equal(requestCount, 1);

    let unlimitedLength;
    const unlimitedResult = await start(
        t,
        Server,
        {
            root,
            port:0,
            server:{maxRequestBodyBytes:false}
        },
        function(server){
            server.onRequest = function(request, response, serve){
                unlimitedLength = request.bodyBuffer.length;
                serve(request, response, 'ok');
                return true;
            };
        }
    );

    assert.equal((await request(unlimitedResult.server, {
        method:'POST',
        body:'longer than four bytes'
    })).statusCode, 200);
    assert.equal(unlimitedLength, Buffer.byteLength('longer than four bytes'));
});

test('hooks can intercept requests and mutate response body and encoding by reference', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'static'});

    let rawSeen = false;
    let afterSeen = false;
    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRawRequest = function(request, response, serve){
            if(request.url !== '/raw'){
                return;
            }

            rawSeen = true;
            response.setHeader('Content-Type', 'text/plain');
            serve(request, response, 'raw');
            return true;
        };

        server.onRequest = function(request, response, serve){
            if(request.url !== '/hook'){
                return;
            }

            response.setHeader('Content-Type', 'text/plain; charset=utf-8');
            serve(request, response, 'é', 'latin1');
            return true;
        };

        server.beforeServe = function(request, response, body, encoding){
            if(request.url === '/hook'){
                assert.equal(body instanceof serverModule.RefString, true);
                assert.equal(encoding instanceof serverModule.RefString, true);
                body.value += '!';
                encoding.value = 'utf8';
            }
        };

        server.afterServe = function(request){
            if(request.url === '/hook'){
                afterSeen = true;
            }
        };
    });
    const raw = await request(server, {path:'/raw'});
    const hooked = await request(server, {path:'/hook'});

    await waitFor(function(){
        return afterSeen;
    });

    assert.equal(rawSeen, true);
    assert.equal(raw.text, 'raw');
    assert.deepEqual(hooked.body, Buffer.from('é!', 'utf8'));
});

test('public serveFile and serve methods preserve their legacy overloads', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'index',
        'direct.txt':'direct',
        'directory/index.html':'directory index'
    });
    fs.mkdirSync(path.join(root, 'missing-index'));

    let afterCount = 0;
    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = async function(request, response, serve){
            if(request.url === '/direct'){
                return server.serveFile(path.join(root, 'direct.txt'), request, response).then(()=>true);
            }

            if(request.url === '/known-missing'){
                return server.serveFile('unused', false, request, response).then(()=>true);
            }

            if(request.url === '/missing'){
                return server.serveFile(path.join(root, 'absent.txt'), request, response).then(()=>true);
            }

            if(request.url === '/directory'){
                return server.serveFile(path.join(root, 'directory'), request, response).then(()=>true);
            }

            if(request.url === '/missing-index'){
                return server.serveFile(path.join(root, 'missing-index'), request, response).then(()=>true);
            }

            if(request.url === '/empty'){
                await serve(request, response, null);
                return true;
            }

            if(request.url === '/twice'){
                await serve(request, response, 'once');
                await serve(request, response, 'ignored');
                return true;
            }

            if(request.url === '/manual'){
                await serve(request, response, 'ignored by beforeServe');
                return true;
            }
        };

        server.beforeServe = function(request, response){
            if(request.url === '/manual'){
                response.end('manual');
                return true;
            }
        };

        server.afterServe = function(){
            afterCount++;
        };
    });

    assert.equal((await request(server, {path:'/direct'})).text, 'direct');
    assert.equal((await request(server, {path:'/directory'})).text, 'directory index');
    assert.equal((await request(server, {path:'/known-missing'})).statusCode, 404);
    assert.equal((await request(server, {path:'/missing'})).statusCode, 404);
    assert.equal((await request(server, {path:'/missing-index'})).statusCode, 404);
    assert.equal((await request(server, {path:'/empty'})).body.length, 0);
    assert.equal((await request(server, {path:'/twice'})).text, 'once');
    assert.equal((await request(server, {path:'/manual'})).text, 'manual');

    const head = await request(server, {path:'/index.html', method:'HEAD'});

    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
    assert.equal(afterCount, 8);
});

test('hook failures are contained after a response and in afterServe', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const responseError = new Error('after response');
    const respondedResult = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            response.end('already sent');
            throw responseError;
        };
    });

    assert.equal((await request(respondedResult.server)).text, 'already sent');
    await waitFor(()=>respondedResult.server.lastError === responseError);

    const asyncError = new Error('async afterServe');
    const asyncResult = await start(t, Server, {root, port:0}, function(server){
        server.afterServe = function(){
            return Promise.reject(asyncError);
        };
    });

    assert.equal((await request(asyncResult.server)).statusCode, 200);
    await waitFor(()=>asyncResult.server.lastError === asyncError);

    const syncError = new Error('sync afterServe');
    const syncResult = await start(t, Server, {root, port:0}, function(server){
        server.afterServe = function(){
            throw syncError;
        };
    });

    assert.equal((await request(syncResult.server)).statusCode, 200);
    await waitFor(()=>syncResult.server.lastError === syncError);

    const callbackError = new Error('callback response failed');
    let beforeCount = 0;
    let unhandled;
    const unhandledListener = function(error){
        unhandled = error;
    };

    process.on('unhandledRejection', unhandledListener);
    t.after(()=>process.off('unhandledRejection', unhandledListener));

    const callbackResult = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            serve(request, response, 'ignored');
            return true;
        };
        server.beforeServe = function(){
            beforeCount++;
            if(beforeCount===1){
                throw callbackError;
            }
        };
    });
    const callbackResponse = await request(callbackResult.server);

    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(callbackResponse.statusCode, 500);
    assert.equal(callbackResult.server.lastError, callbackError);
    assert.equal(unhandled, undefined);
});

test('HTTP timeout controls are settable and explicitly disableable', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const configuredResult = await start(t, Server, {
        root,
        port:0,
        server:{
            timeout:1000,
            requestTimeout:4000,
            headersTimeout:3000,
            keepAliveTimeout:2000
        }
    });

    assert.equal(configuredResult.server.server.timeout, 1000);
    assert.equal(configuredResult.server.server.requestTimeout, 4000);
    assert.equal(configuredResult.server.server.headersTimeout, 3000);
    assert.equal(configuredResult.server.server.keepAliveTimeout, 2000);

    const disabledResult = await start(t, Server, {
        root,
        port:0,
        server:{
            timeout:false,
            requestTimeout:false,
            headersTimeout:false,
            keepAliveTimeout:false
        }
    });

    assert.equal(disabledResult.server.server.timeout, 0);
    assert.equal(disabledResult.server.server.requestTimeout, 0);
    assert.equal(disabledResult.server.server.headersTimeout, 0);
    assert.equal(disabledResult.server.server.keepAliveTimeout, 0);
});

test('internal stream failures return a sanitized 500 response', async function(t){
    const root = temporaryDirectory(t);
    const marker = 'PRIVATE_ERROR_' + root;

    writeFiles(root, {'broken.txt':'broken'});

    const {server} = await start(t, Server, {root, port:0});
    const originalCreateReadStream = fs.createReadStream;

    fs.createReadStream = function(filename, options){
        if(path.basename(filename) === 'broken.txt'){
            const stream = new PassThrough();

            process.nextTick(function(){
                stream.destroy(new Error(marker));
            });

            return stream;
        }

        return originalCreateReadStream.call(fs, filename, options);
    };

    try{
        const response = await request(server, {path:'/broken.txt'});

        assert.equal(response.statusCode, 500);
        assert.doesNotMatch(response.text, /PRIVATE_ERROR_/);
        assert.doesNotMatch(response.text, new RegExp(root.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
    }finally{
        fs.createReadStream = originalCreateReadStream;
    }
});

test('aborted downloads destroy their source stream', async function(t){
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

test('filesystem denial and unexpected failures map to safe responses', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'ok',
        'bad-realpath.txt':'bad realpath'
    });
    fs.mkdirSync(path.join(root, 'blocked-directory'));
    fs.mkdirSync(path.join(root, 'not-a-file', 'index.html'), {recursive:true});

    const {server} = await start(t, Server, {root, port:0});
    const originalStat = fsp.stat;
    const originalRealpath = fsp.realpath;
    let failRootRealpath = false;

    fsp.stat = async function(filename){
        const normalized = String(filename);

        if(normalized.endsWith('denied.txt') || normalized.endsWith(path.join('blocked-directory', 'index.html'))){
            const error = new Error('private denial detail');
            error.code = 'EACCES';
            throw error;
        }

        if(normalized.endsWith('broken-stat.txt')){
            const error = new Error('private stat detail');
            error.code = 'EIO';
            throw error;
        }

        return originalStat.call(fsp, filename);
    };
    fsp.realpath = async function(filename){
        if(failRootRealpath && path.resolve(filename) === path.resolve(root)){
            const error = new Error('private root detail');
            error.code = 'EIO';
            throw error;
        }

        if(String(filename).endsWith('bad-realpath.txt')){
            const error = new Error('private realpath detail');
            error.code = 'EIO';
            throw error;
        }

        return originalRealpath.call(fsp, filename);
    };

    try{
        assert.equal((await request(server, {path:'/denied.txt'})).statusCode, 403);
        assert.equal((await request(server, {path:'/blocked-directory'})).statusCode, 403);
        assert.equal((await request(server, {path:'/not-a-file'})).statusCode, 404);

        const brokenStat = await request(server, {path:'/broken-stat.txt'});
        const brokenRealpath = await request(server, {path:'/bad-realpath.txt'});

        assert.equal(brokenStat.statusCode, 500);
        assert.equal(brokenRealpath.statusCode, 500);
        assert.doesNotMatch(brokenStat.text, /private stat detail/);
        assert.doesNotMatch(brokenRealpath.text, /private realpath detail/);

        failRootRealpath = true;
        assert.equal((await request(server)).statusCode, 500);
    }finally{
        fsp.stat = originalStat;
        fsp.realpath = originalRealpath;
    }
});

test('resolved symlinks cannot escape the configured root', async function(t){
    const workspace = temporaryDirectory(t);
    const root = path.join(workspace, 'public');
    const outside = path.join(workspace, 'outside');
    const link = path.join(root, 'escape');

    writeFiles(workspace, {
        'public/index.html':'inside',
        'outside/secret.txt':'outside'
    });

    try{
        fs.symlinkSync(outside, link, process.platform === 'win32' ? 'junction' : 'dir');
    }catch(error){
        t.skip('filesystem does not permit test symlinks: ' + error.code);
        return;
    }

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/escape/secret.txt'});

    assert.equal(response.statusCode, 403);
    assert.doesNotMatch(response.text, /outside/);
});

test('default request logging is parseable NDJSON and redacts credentials', async function(t){
    const root = temporaryDirectory(t);
    const log = path.join(root, 'requests.ndjson');
    const secret = 'top-secret-token';

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0, log});

    assert.equal((await request(server, {
        headers:{
            Authorization:'Bearer ' + secret,
            Cookie:'session=' + secret
        }
    })).statusCode, 200);

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

test('custom logging can include bodies and contains async logger failures', async function(t){
    const root = temporaryDirectory(t);
    const failure = new Error('logger rejected');
    let entry;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        log:true,
        logBody:true,
        logFunction:function(data){
            entry = data;
            return Promise.reject(failure);
        }
    }, function(server){
        server.onRequest = function(request, response, serve){
            serve(request, response, 'logged');
            return true;
        };
    });
    const response = await request(server, {
        method:'POST',
        body:'request body'
    });

    assert.equal(response.text, 'logged');
    assert.equal(entry.body, 'request body');
    await waitFor(()=>server.lastError === failure);

    const syncFailure = new Error('logger threw');
    const syncResult = await start(t, Server, {
        root,
        port:0,
        log:true,
        logFunction:function(){
            throw syncFailure;
        }
    });
    const syncResponse = await request(syncResult.server);

    assert.equal(syncResponse.text, 'ok');
    assert.equal(syncResult.server.lastError, syncFailure);
});
