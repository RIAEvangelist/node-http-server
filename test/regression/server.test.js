'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const { PassThrough } = require('node:stream');
const test = require('node:test');
const serverModule = require('../../server/Server.js');
const {
    request,
    start,
    temporaryDirectory,
    waitFor,
    writeFiles
} = require('../helpers.js');

const Server = serverModule.Server;

test('Regression | deploy rejects HTTP ports outside the integer range', function(t){
    const root = temporaryDirectory(t);

    for(const port of [-1, 65536, 1.5]){
        assert.throws(
            ()=>new Server({root, port}).deploy(),
            /port must be an integer/
        );
    }
});

test('Regression | deploy rejects an empty host', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, host:''}).deploy(),
        /host must be a non-empty string/
    );
});

test('Regression | deploy rejects a root that is not a directory', function(t){
    const root = temporaryDirectory(t);
    const rootFile = path.join(root, 'not-a-directory');

    writeFiles(root, {'not-a-directory':'file'});

    assert.throws(
        ()=>new Server({root:rootFile}).deploy(),
        /root must be a directory/
    );
});

test('Regression | deploy rejects a domain root that is not a directory', function(t){
    const root = temporaryDirectory(t);
    const rootFile = path.join(root, 'not-a-directory');

    writeFiles(root, {'not-a-directory':'file'});

    assert.throws(
        ()=>new Server({root, domains:{'invalid.test':rootFile}}).deploy(),
        /domains\.invalid\.test must be a directory/
    );
});

test('Regression | deploy rejects negative or non-finite timeout controls', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, server:{timeout:-1}}).deploy(),
        /server\.timeout must be a non-negative number/
    );
    assert.throws(
        ()=>new Server({root, server:{requestTimeout:Infinity}}).deploy(),
        /server\.requestTimeout must be a non-negative number/
    );
});

test('Regression | deploy rejects a negative request body limit', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, server:{maxRequestBodyBytes:-1}}).deploy(),
        /maxRequestBodyBytes must be a non-negative number or false/
    );
});

test('Regression | deploy rejects a negative compression threshold', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, server:{compressionThreshold:-1}}).deploy(),
        /compressionThreshold must be a non-negative number/
    );
});

test('Regression | deploy rejects a non-boolean allowDotfiles value', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, server:{allowDotfiles:'true'}}).deploy(),
        /allowDotfiles must be true or false/
    );
});

test('Regression | deploy rejects an invalid HTTPS port', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root, https:{port:'invalid'}}).deploy(),
        /https\.port must be an integer/
    );
});

test('Regression | deploy rejects a non-function ready callback', function(t){
    const root = temporaryDirectory(t);

    assert.throws(
        ()=>new Server({root}).deploy(null, 'invalid'),
        /readyCallback must be a function/
    );
});

test('Regression | close rejects a non-function callback', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});

    await assert.rejects(server.close('invalid'), /callback must be a function/);
});

test('Regression | duplicate deployment returns ERR_SERVER_ALREADY_DEPLOYED', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});

    assert.throws(
        ()=>server.deploy(),
        function(error){
            return error.code === 'ERR_SERVER_ALREADY_DEPLOYED';
        }
    );
});

test('Regression | incomplete HTTPS credentials return ERR_HTTPS_CONFIGURATION', function(t){
    const root = temporaryDirectory(t);

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
});

test('Regression | failed dual-protocol deployment leaves the instance undeployed', function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'invalid.key':'not a private key',
        'invalid.cert':'not a certificate'
    });

    const server = new Server({
        root,
        port:0,
        https:{
            privateKey:path.join(root, 'invalid.key'),
            certificate:path.join(root, 'invalid.cert'),
            port:0
        }
    });

    assert.throws(()=>server.deploy());
    assert.equal(server.server, null);
    assert.equal(server.secureServer, null);
    assert.equal(server._deployed, false);
});

test('Regression | underlying close errors close idle connections and reach callback and Promise', async function(t){
    const root = temporaryDirectory(t);
    const closeError = new Error('close failed');
    const server = new Server({root});
    let idleClosed = false;
    let callbackError;

    server._deployed = true;
    server.server = {
        listening:true,
        closeIdleConnections:function(){
            idleClosed = true;
        },
        close:function(callback){
            callback(closeError);
        }
    };

    await assert.rejects(
        server.close(function(error){
            callbackError = error;
        }),
        /close failed/
    );
    assert.equal(idleClosed, true);
    assert.equal(callbackError, closeError);
});

test('Regression | prototype names do not leak into MIME or restriction lookup', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'safe.constructor':'constructor',
        'safe.toString':'toString'
    });

    const {server} = await start(t, Server, {
        root,
        port:0,
        restrictedType:{key:true}
    });
    const constructor = await request(server, {path:'/safe.constructor'});
    const toString = await request(server, {path:'/safe.toString'});

    assert.equal(constructor.statusCode, 200);
    assert.equal(constructor.headers['content-type'], 'application/octet-stream');
    assert.equal(toString.statusCode, 200);
    assert.equal(toString.headers['content-type'], 'application/octet-stream');
});

test('Regression | unsupported and malformed range syntax is ignored', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const ignored = await Promise.all([
        request(server, {path:'/bytes.txt', headers:{Range:'items=0-1'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=0-1,3-4'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=--'}})
    ]);

    assert.equal(ignored.every(response=>response.statusCode === 200), true);
});

test('Regression | unsatisfiable ranges return 416 including for an empty file', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'bytes.txt':'0123456789',
        'empty.txt':''
    });

    const {server} = await start(t, Server, {root, port:0});
    const unsatisfied = await Promise.all([
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=50-60'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=-0'}}),
        request(server, {path:'/bytes.txt', headers:{Range:'bytes=5-2'}}),
        request(server, {path:'/empty.txt', headers:{Range:'bytes=0-1'}})
    ]);

    assert.equal(unsatisfied.every(response=>response.statusCode === 416), true);
    assert.equal(unsatisfied[0].headers['content-range'], 'bytes */10');
});

test('Regression | If-Range falls back for weak or stale validators and accepts a fresh date', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const initial = await request(server, {path:'/bytes.txt'});
    const weak = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':initial.headers.etag}
    });
    const stale = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':'W/"stale"'}
    });
    const dated = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=0-1', 'If-Range':initial.headers['last-modified']}
    });

    assert.equal(weak.statusCode, 200);
    assert.equal(weak.text, '0123456789');
    assert.equal(stale.statusCode, 200);
    assert.equal(stale.text, '0123456789');
    assert.equal(dated.statusCode, 206);
    assert.equal(dated.text, '01');
});

test('Regression | HEAD ignores a byte range and returns full-response metadata', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const head = await request(server, {
        path:'/bytes.txt',
        method:'HEAD',
        headers:{Range:'bytes=0-1'}
    });

    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
    assert.equal(Number(head.headers['content-length']), 10);
});

test('Regression | encoded slash traversal returns 403 and keeps protected content private', async function(t){
    const workspace = temporaryDirectory(t);
    const root = path.join(workspace, 'public');

    writeFiles(workspace, {
        'public/index.html':'inside',
        'secret.txt':'outside'
    });

    const {server} = await start(t, Server, {root, port:0});
    const slash = await request(server, {path:'/..%2fsecret.txt'});

    assert.equal(slash.statusCode, 403);
    assert.doesNotMatch(slash.text, /outside/);
});

test('Regression | encoded backslash traversal returns 403 and keeps protected content private', async function(t){
    const workspace = temporaryDirectory(t);
    const root = path.join(workspace, 'public');

    writeFiles(workspace, {
        'public/index.html':'inside',
        'secret.txt':'outside'
    });

    const {server} = await start(t, Server, {root, port:0});
    const backslash = await request(server, {path:'/..%5csecret.txt'});

    assert.equal(backslash.statusCode, 403);
    assert.doesNotMatch(backslash.text, /outside/);
});

test('Regression | malformed URL escapes return 400', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'inside'});

    const {server} = await start(t, Server, {root, port:0});
    const malformed = await request(server, {path:'/%E0%A4%A'});

    assert.equal(malformed.statusCode, 400);
});

test('Regression | NUL in a request path returns 400', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'inside'});

    const {server} = await start(t, Server, {root, port:0});
    const nullByte = await request(server, {path:'/%00'});

    assert.equal(nullByte.statusCode, 400);
});

test('Regression | a missing Host header returns 400', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'inside'});

    const {server} = await start(t, Server, {root, port:0});
    const noHost = await request(server, {setHost:false});

    assert.equal(noHost.statusCode, 400);
});

test('Regression | an invalid Host header returns 400', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'inside'});

    const {server} = await start(t, Server, {root, port:0});
    const invalidHost = await request(server, {headers:{Host:'['}});

    assert.equal(invalidHost.statusCode, 400);
});

test('Regression | Windows alternate data streams return 403', {
    skip:process.platform !== 'win32'
}, async function(t){
    const root = temporaryDirectory(t);
    const filename = path.join(root, 'visible.txt');

    writeFiles(root, {'visible.txt':'visible'});
    try{
        fs.writeFileSync(filename + ':hidden', 'hidden stream');
    }catch(error){
        t.skip('filesystem does not permit alternate data streams: ' + error.code);
        return;
    }

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/visible.txt:hidden'});

    assert.equal(response.statusCode, 403);
    assert.doesNotMatch(response.text, /hidden stream/);
});

test('Regression | absolute-form targets normalize and retain clean request error state', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {
        path:'http://example.test/index.html',
        headers:{Host:'example.test'}
    });

    assert.equal(response.statusCode, 200);
    assert.equal(response.text, 'ok');
    assert.equal(server.lastError, null);
});

test('Regression | range responses remain uncompressed', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'compressible '.repeat(200)});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:0}
    });
    const ranged = await request(server, {
        headers:{Range:'bytes=0-9', 'Accept-Encoding':'gzip'}
    });

    assert.equal(ranged.headers['content-encoding'], undefined);
});

test('Regression | binary responses remain uncompressed', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'binary.bin':Buffer.alloc(2048)});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:0}
    });
    const binary = await request(server, {
        path:'/binary.bin',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(binary.headers['content-encoding'], undefined);
});

test('Regression | trusted direct serveFile remains the deliberate dotfile-policy bypass', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'index',
        '.well-known/trusted.txt':'trusted dotfile'
    });

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            if(request.url === '/trusted-dotfile'){
                return server.serveFile(
                    path.join(root, '.well-known', 'trusted.txt'),
                    request,
                    response
                ).then(()=>true);
            }
        };
    });
    const response = await request(server, {path:'/trusted-dotfile'});

    assert.equal(response.statusCode, 200);
    assert.equal(response.text, 'trusted dotfile');
});

test('Regression | a second serve call cannot overwrite the first response', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = async function(request, response, serve){
            if(request.url === '/twice'){
                await serve(request, response, 'once');
                await serve(request, response, 'ignored');
                return true;
            }
        };
    });
    const response = await request(server, {path:'/twice'});

    assert.equal(response.text, 'once');
});

test('Regression | onRequest throwing after response.end preserves the response and records the error', async function(t){
    const root = temporaryDirectory(t);
    const failure = new Error('after response');

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            response.end('already sent');
            throw failure;
        };
    });
    const response = await request(server);

    assert.equal(response.text, 'already sent');
    await waitFor(()=>server.lastError === failure);
    assert.equal(server.lastError, failure);
});

test('Regression | an async afterServe rejection preserves 200 and records lastError', async function(t){
    const root = temporaryDirectory(t);
    const asyncFailure = new Error('async afterServe');

    writeFiles(root, {'index.html':'ok'});

    const asyncResult = await start(t, Server, {root, port:0}, function(server){
        server.afterServe = function(){
            return Promise.reject(asyncFailure);
        };
    });
    assert.equal((await request(asyncResult.server)).statusCode, 200);
    await waitFor(()=>asyncResult.server.lastError === asyncFailure);
});

test('Regression | a synchronous afterServe throw preserves 200 and records lastError', async function(t){
    const root = temporaryDirectory(t);
    const syncFailure = new Error('sync afterServe');

    writeFiles(root, {'index.html':'ok'});

    const syncResult = await start(t, Server, {root, port:0}, function(server){
        server.afterServe = function(){
            throw syncFailure;
        };
    });
    assert.equal((await request(syncResult.server)).statusCode, 200);
    await waitFor(()=>syncResult.server.lastError === syncFailure);
});

test('Regression | beforeServe failure returns 500 and contains the rejected promise', async function(t){
    const root = temporaryDirectory(t);
    const failure = new Error('callback response failed');
    let beforeCount = 0;
    let unhandled;
    const unhandledListener = function(error){
        unhandled = error;
    };

    process.on('unhandledRejection', unhandledListener);
    t.after(()=>process.off('unhandledRejection', unhandledListener));

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            serve(request, response, 'ignored');
            return true;
        };
        server.beforeServe = function(){
            beforeCount++;
            if(beforeCount === 1){
                throw failure;
            }
        };
    });
    const response = await request(server);

    await new Promise(resolve=>setImmediate(resolve));
    assert.equal(response.statusCode, 500);
    assert.equal(server.lastError, failure);
    assert.equal(unhandled, undefined);
});

test('Regression | read-stream failures return a sanitized 500 response', async function(t){
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
        assert.doesNotMatch(response.text, new RegExp(escapeRegExp(root)));
    }finally{
        fs.createReadStream = originalCreateReadStream;
    }
});

test('Regression | filesystem access denial maps file and directory-index requests to 403', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});
    fs.mkdirSync(path.join(root, 'blocked-directory'));

    const {server} = await start(t, Server, {root, port:0});
    const originalStat = fsp.stat;

    fsp.stat = async function(filename){
        const normalized = String(filename);

        if(normalized.endsWith('denied.txt') || normalized.endsWith(path.join('blocked-directory', 'index.html'))){
            const error = new Error('private denial detail');
            error.code = 'EACCES';
            throw error;
        }

        return originalStat.call(fsp, filename);
    };

    try{
        assert.equal((await request(server, {path:'/denied.txt'})).statusCode, 403);
        assert.equal((await request(server, {path:'/blocked-directory'})).statusCode, 403);
    }finally{
        fsp.stat = originalStat;
    }
});

test('Regression | a directory whose index candidate is not a file returns 404', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});
    fs.mkdirSync(path.join(root, 'not-a-file', 'index.html'), {recursive:true});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/not-a-file'});

    assert.equal(response.statusCode, 404);
});

test('Regression | an unexpected stat failure returns a sanitized 500 response', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});
    const originalStat = fsp.stat;

    fsp.stat = async function(filename){
        if(String(filename).endsWith('broken-stat.txt')){
            const error = new Error('private stat detail');
            error.code = 'EIO';
            throw error;
        }

        return originalStat.call(fsp, filename);
    };

    try{
        const brokenStat = await request(server, {path:'/broken-stat.txt'});

        assert.equal(brokenStat.statusCode, 500);
        assert.doesNotMatch(brokenStat.text, /private stat detail/);
    }finally{
        fsp.stat = originalStat;
    }
});

test('Regression | an unexpected candidate realpath failure returns a sanitized 500 response', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bad-realpath.txt':'bad realpath'});

    const {server} = await start(t, Server, {root, port:0});
    const originalRealpath = fsp.realpath;

    fsp.realpath = async function(filename){
        if(String(filename).endsWith('bad-realpath.txt')){
            const error = new Error('private realpath detail');
            error.code = 'EIO';
            throw error;
        }

        return originalRealpath.call(fsp, filename);
    };

    try{
        const response = await request(server, {path:'/bad-realpath.txt'});

        assert.equal(response.statusCode, 500);
        assert.doesNotMatch(response.text, /private realpath detail/);
    }finally{
        fsp.realpath = originalRealpath;
    }
});

test('Regression | an unexpected root realpath failure returns a sanitized 500 response', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0});
    const originalRealpath = fsp.realpath;

    fsp.realpath = async function(filename){
        if(path.resolve(filename) === path.resolve(root)){
            const error = new Error('private root detail');
            error.code = 'EIO';
            throw error;
        }

        return originalRealpath.call(fsp, filename);
    };

    try{
        const response = await request(server);

        assert.equal(response.statusCode, 500);
        assert.doesNotMatch(response.text, /private root detail/);
    }finally{
        fsp.realpath = originalRealpath;
    }
});

test('Regression | resolved symlinks cannot escape the configured root', async function(t){
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

test('Regression | an async custom logger rejection preserves the response and records diagnostics', async function(t){
    const root = temporaryDirectory(t);
    const failure = new Error('logger rejected');
    const originalError = console.error;
    const errors = [];

    writeFiles(root, {'index.html':'ok'});
    console.error = function(){
        errors.push(Array.from(arguments));
    };

    try{
        const asyncResult = await start(t, Server, {
            root,
            port:0,
            log:true,
            logFunction:function(){
                return Promise.reject(failure);
            }
        });
        asyncResult.server.config.verbose = true;
        const response = await request(asyncResult.server);

        assert.equal(response.text, 'ok');
        await waitFor(()=>asyncResult.server.lastError === failure);
        assert.deepEqual(errors, [
            ['Unable to write request log', 'logger rejected']
        ]);
    }finally{
        console.error = originalError;
    }
});

test('Regression | a synchronous custom logger throw preserves the response and records diagnostics', async function(t){
    const root = temporaryDirectory(t);
    const failure = new Error('logger threw');
    const originalError = console.error;
    const errors = [];

    writeFiles(root, {'index.html':'ok'});
    console.error = function(){
        errors.push(Array.from(arguments));
    };

    try{
        const syncResult = await start(t, Server, {
            root,
            port:0,
            log:true,
            logFunction:function(){
                throw failure;
            }
        });
        syncResult.server.config.verbose = true;
        const response = await request(syncResult.server);

        assert.equal(response.text, 'ok');
        assert.equal(syncResult.server.lastError, failure);
        assert.deepEqual(errors, [
            ['Unable to write request log', 'logger threw']
        ]);
    }finally{
        console.error = originalError;
    }
});

test('Regression | default dotfile denial covers literal, nested, and double-dot segments', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        '.gitignore':'private ignore rules',
        '..secret':'private double-dot file',
        '.git/HEAD':'private git head',
        'nested/.env':'private environment',
        '.well-known/acme-token':'private token'
    });

    const {server} = await start(t, Server, {root, port:0});
    const blockedPaths = [
        '/.gitignore',
        '/..secret',
        '/.git/HEAD',
        '/nested/.env',
        '/.well-known/acme-token'
    ];

    for(const requestPath of blockedPaths){
        const response = await request(server, {path:requestPath});

        assert.equal(response.statusCode, 403, requestPath);
        assert.doesNotMatch(response.text, /private/, requestPath);
    }
});

test('Regression | encoded dotfile names and separators are denied', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        '.git/HEAD':'private git head'
    });

    const {server} = await start(t, Server, {root, port:0});
    const blockedPaths = [
        '/%2egit/HEAD',
        '/%2Egit%2FHEAD',
        '/.git%5cHEAD'
    ];

    for(const requestPath of blockedPaths){
        const response = await request(server, {path:requestPath});

        assert.equal(response.statusCode, 403, requestPath);
        assert.doesNotMatch(response.text, /private/, requestPath);
    }
});

test('Regression | HEAD on a hidden path returns 403 with an empty body', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        '.git/HEAD':'private git head'
    });

    const {server} = await start(t, Server, {root, port:0});
    const hiddenHead = await request(server, {path:'/.git/HEAD', method:'HEAD'});

    assert.equal(hiddenHead.statusCode, 403);
    assert.equal(hiddenHead.body.length, 0);
});

test('Regression | hidden paths are denied before SPA fallback while a dot-named root remains usable', async function(t){
    const workspace = temporaryDirectory(t);
    const root = path.join(workspace, '.served-root');

    writeFiles(root, {
        'index.html':'spa shell',
        'app.config':'visible configuration'
    });

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{spaFallback:true}
    });
    const hidden = await request(server, {path:'/.missing?value=1'});
    const visible = await request(server, {path:'/app.config'});
    const spa = await request(server, {path:'/dashboard', headers:{Accept:'text/html'}});

    assert.equal(hidden.statusCode, 403);
    assert.doesNotMatch(hidden.text, /spa shell/);
    assert.equal(visible.statusCode, 200);
    assert.equal(visible.text, 'visible configuration');
    assert.equal(spa.statusCode, 200);
    assert.equal(spa.text, 'spa shell');
});

test('Regression | visible symlink aliases into hidden directories are denied', async function(t){
    const root = temporaryDirectory(t);
    const hiddenDirectory = path.join(root, '.private');
    const visibleAlias = path.join(root, 'visible-alias');

    writeFiles(root, {
        'index.html':'visible',
        '.private/secret.txt':'private symlink target'
    });

    try{
        fs.symlinkSync(hiddenDirectory, visibleAlias, process.platform === 'win32' ? 'junction' : 'dir');
    }catch(error){
        t.skip('filesystem does not permit dotfile symlinks: ' + error.code);
        return;
    }

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/visible-alias/secret.txt'});

    assert.equal(response.statusCode, 403);
    assert.doesNotMatch(response.text, /private symlink target/);
});

test('Regression | a configured hidden index target is denied', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        'hidden-index/.index.html':'private index'
    });

    const {server} = await start(t, Server, {
        root:path.join(root, 'hidden-index'),
        port:0,
        server:{index:'.index.html'}
    });

    assert.equal((await request(server)).statusCode, 403);
});

test('Regression | a configured hidden SPA fallback target is denied', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        '.fallback.html':'private fallback'
    });

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{spaFallback:'.fallback.html'}
    });

    assert.equal((await request(server, {path:'/route'})).statusCode, 403);
});

function escapeRegExp(value){
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
