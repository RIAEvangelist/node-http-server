'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { once } = require('node:events');
const test = require('node:test');
const zlib = require('node:zlib');
const serverModule = require('../../server/Server.js');
const {
    request,
    start,
    temporaryDirectory,
    waitFor,
    writeFiles
} = require('../helpers.js');

const Server = serverModule.Server;

test('Functional | deploy returns its instance and exposes the default HTTP address', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ready'});

    const result = await start(t, Server, {root, port:0});

    assert.equal(result.deployed, result.server);
    assert.equal(result.server.server.address().address, '127.0.0.1');
    assert.deepEqual(result.server.address(), result.server.server.address());
    assert.equal(result.server.secureServer, null);
    assert.equal((await request(result.server)).text, 'ready');
});

test('Functional | close is Promise-based, invokes callbacks, clears address, and repeated closes are safe', async function(t){
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

    assert.equal(firstClose instanceof Promise, true);
    await Promise.all([firstClose, secondClose]);
    assert.equal(callbacks, 2);
    assert.equal(server.address(), null);

    await server.close(function(){
        callbacks++;
    });
    assert.equal(callbacks, 3);
});

test('Functional | close called immediately after deploy leaves no pending listener', async function(t){
    const root = temporaryDirectory(t);
    const server = new Server({root, port:0});

    writeFiles(root, {'index.html':'closed'});

    t.after(async function(){
        await server.close();
    });

    server.deploy();
    const nodeServer = server.server;

    await server.close();
    await new Promise(resolve=>setTimeout(resolve, 25));

    assert.equal(nodeServer.listening, false);
    assert.equal(server.address(), null);
    assert.equal(server._deployed, false);
});

test('Functional | a closed instance redeploys with overrides and invokes its ready callback', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'again'});

    const {server} = await start(t, Server, {root, port:0});

    await server.close();

    let callbackServer;
    const deployed = server.deploy({port:0}, function(instance){
        callbackServer = instance;
    });

    if(!server.server.listening){
        await once(server.server, 'listening');
    }

    assert.equal(deployed, server);
    assert.equal(callbackServer, server);
    assert.equal((await request(server)).text, 'again');
});

test('Functional | static GET resolves the root index file', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'home'});

    const {server} = await start(t, Server, {root, port:0});
    const index = await request(server);

    assert.equal(index.statusCode, 200);
    assert.equal(index.text, 'home');
});

test('Functional | static GET resolves a nested directory index file', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'nested/index.html':'nested'});

    const {server} = await start(t, Server, {root, port:0});
    const nested = await request(server, {path:'/nested/'});

    assert.equal(nested.statusCode, 200);
    assert.equal(nested.text, 'nested');
});

test('Functional | HEAD returns GET metadata with an empty body', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'home'});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/index.html', method:'HEAD'});

    assert.equal(response.statusCode, 200);
    assert.equal(response.body.length, 0);
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength('home'));
});

test('Functional | custom beforeServe receives the full HEAD representation and controls its metadata', async function(t){
    const root = temporaryDirectory(t);
    const representation = Buffer.from('complete representation');
    let bodySeen;
    let afterCount = 0;

    writeFiles(root, {'representation.txt':representation});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.beforeServe = function(request, response, body){
            if(request.url !== '/representation.txt'){
                return;
            }

            bodySeen = Buffer.from(body.value);
            response.setHeader('X-Representation-Length', body.value.length);
            body.value = Buffer.from('short');
        };
        server.afterServe = function(request){
            if(request.url === '/representation.txt'){
                afterCount++;
            }
        };
    });
    const response = await request(server, {
        path:'/representation.txt',
        method:'HEAD',
        headers:{Range:'bytes=0-1'}
    });

    await waitFor(()=>afterCount === 1);
    assert.equal(response.statusCode, 200);
    assert.equal(response.headers['content-range'], undefined);
    assert.equal(response.headers['x-representation-length'], String(representation.length));
    assert.equal(Number(response.headers['content-length']), Buffer.byteLength('short'));
    assert.equal(response.body.length, 0);
    assert.deepEqual(bodySeen, representation);
    assert.equal(afterCount, 1);
});

test('Functional | automatic MIME maps modern WebP and Wasm types', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'image.webp':Buffer.from([1, 2, 3]),
        'module.wasm':Buffer.from([0, 97, 115, 109])
    });

    const {server} = await start(t, Server, {root, port:0});
    const webp = await request(server, {path:'/image.webp'});
    const wasm = await request(server, {path:'/module.wasm'});

    assert.equal(webp.headers['content-type'], 'image/webp');
    assert.equal(wasm.headers['content-type'], 'application/wasm');
});

test('Functional | automatic MIME falls back to application/octet-stream for unknown types', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'unknown.future':'future'});

    const {server} = await start(t, Server, {root, port:0});
    const unknown = await request(server, {path:'/unknown.future'});

    assert.equal(unknown.headers['content-type'], 'application/octet-stream');
});

test('Functional | contentType false keeps files servable as octet-stream', async function(t){
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

test('Functional | a custom contentType false value rejects its extension', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'unsupported.deny':'unsupported'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        contentType:{deny:false}
    });
    const unsupported = await request(server, {path:'/unsupported.deny'});

    assert.equal(unsupported.statusCode, 415);
});

test('Functional | a restrictedType true value blocks its extension', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'blocked.key':'private'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        restrictedType:{key:true}
    });
    const blocked = await request(server, {path:'/blocked.key'});

    assert.equal(blocked.statusCode, 403);
});

test('Functional | unsupported methods return 405 and advertise GET and HEAD', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'home'});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {method:'POST'});

    assert.equal(response.statusCode, 405);
    assert.match(response.headers.allow, /GET/);
    assert.match(response.headers.allow, /HEAD/);
});

test('Functional | matching and wildcard If-None-Match validators return 304', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const initial = await request(server, {path:'/bytes.txt'});
    const tagged = await request(server, {
        path:'/bytes.txt',
        headers:{'If-None-Match':initial.headers.etag}
    });
    const wildcard = await request(server, {
        path:'/bytes.txt',
        headers:{'If-None-Match':'*'}
    });

    assert.ok(initial.headers.etag);
    assert.equal(initial.headers['accept-ranges'], 'bytes');
    assert.equal(tagged.statusCode, 304);
    assert.equal(tagged.body.length, 0);
    assert.equal(wildcard.statusCode, 304);
});

test('Functional | a fresh If-Modified-Since returns 304 while an invalid date is ignored', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const initial = await request(server, {path:'/bytes.txt'});
    const dated = await request(server, {
        path:'/bytes.txt',
        headers:{'If-Modified-Since':initial.headers['last-modified']}
    });
    const invalidDate = await request(server, {
        path:'/bytes.txt',
        headers:{'If-Modified-Since':'not-a-date'}
    });

    assert.equal(dated.statusCode, 304);
    assert.equal(invalidDate.statusCode, 200);
});

test('Functional | a bounded byte range returns its selected bytes and metadata', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const bounded = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=2-5'}
    });

    assert.equal(bounded.statusCode, 206);
    assert.equal(bounded.text, '2345');
    assert.equal(bounded.headers['content-range'], 'bytes 2-5/10');
    assert.equal(Number(bounded.headers['content-length']), 4);
});

test('Functional | a suffix byte range returns the requested trailing bytes', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const suffix = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=-3'}
    });

    assert.equal(suffix.statusCode, 206);
    assert.equal(suffix.text, '789');
});

test('Functional | an open-ended byte range returns through the end of the file', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const openEnded = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=7-'}
    });

    assert.equal(openEnded.statusCode, 206);
    assert.equal(openEnded.text, '789');
});

test('Functional | a byte range beyond the file end is clamped to the last byte', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'bytes.txt':'0123456789'});

    const {server} = await start(t, Server, {root, port:0});
    const clamped = await request(server, {
        path:'/bytes.txt',
        headers:{Range:'bytes=8-99'}
    });

    assert.equal(clamped.statusCode, 206);
    assert.equal(clamped.text, '89');
});

test('Functional | GET serves an empty file with zero content length', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'empty.txt':''});

    const {server} = await start(t, Server, {root, port:0});
    const get = await request(server, {path:'/empty.txt'});

    assert.equal(get.statusCode, 200);
    assert.equal(get.body.length, 0);
    assert.equal(Number(get.headers['content-length']), 0);
});

test('Functional | HEAD serves an empty file without a response body', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'empty.txt':''});

    const {server} = await start(t, Server, {root, port:0});
    const head = await request(server, {path:'/empty.txt', method:'HEAD'});

    assert.equal(head.statusCode, 200);
    assert.equal(head.body.length, 0);
});

test('Functional | request.uri preserves repeated query values as an array', async function(t){
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
    const response = await request(server, {
        path:'/inspect?a=1&a=2&a=3&b=3'
    });

    assert.equal(response.text, 'inspected');
    assert.deepEqual(uri.query.a, ['1', '2', '3']);
    assert.equal(uri.query.b, '3');
});

test('Functional | request.uri preserves three thousand repeated query values in order', async function(t){
    const root = temporaryDirectory(t);
    const values = Array.from({length:3000}, function(value, index){
        return String(index % 10);
    });
    let uri;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            if(request.url !== '/inspect-large-query'){
                return;
            }

            uri = request.uri;
            serve(request, response, 'inspected');
            return true;
        };
    });
    const response = await request(server, {
        path:'/inspect-large-query?' + values.map(value=>'a=' + value).join('&')
    });

    assert.equal(response.text, 'inspected');
    assert.equal(Object.getPrototypeOf(uri.query), null);
    assert.deepEqual(uri.query.a, values);
});

test('Functional | a frozen request.uri keeps its parsed query readable', async function(t){
    const root = temporaryDirectory(t);
    let query;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            Object.freeze(request.uri);
            query = request.uri.query;
            serve(request, response, 'frozen');
            return true;
        };
    });
    const response = await request(server, {path:'/inspect?a=1&a=2'});

    assert.equal(response.text, 'frozen');
    assert.deepEqual(query.a, ['1', '2']);
});

test('Functional | a sealed request.uri keeps its query property writable', async function(t){
    const root = temporaryDirectory(t);
    const replacement = Object.assign(Object.create(null), {ready:'yes'});
    let query;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            Object.seal(request.uri);
            request.uri.query = replacement;
            query = request.uri.query;
            serve(request, response, 'sealed');
            return true;
        };
    });
    const response = await request(server, {path:'/inspect?a=1'});

    assert.equal(response.text, 'sealed');
    assert.equal(query, replacement);
});

test('Functional | request.uri parses an IPv6 hostname and explicit port', async function(t){
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
    const response = await request(server, {
        path:'/inspect',
        headers:{Host:'[::1]:1234'}
    });

    assert.equal(response.text, 'inspected');
    assert.equal(uri.hostname, '::1');
    assert.equal(uri.port, 1234);
});

test('Functional | domain routing selects configured roots case-insensitively', async function(t){
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

    assert.equal(primary.text, 'primary');
    assert.equal(alternate.text, 'alternate');
});

test('Functional | domain routing rejects an unknown host with 421', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'primary'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        domain:'primary.test'
    });
    const unknown = await request(server, {headers:{Host:'unknown.test'}});

    assert.equal(unknown.statusCode, 421);
});

test('Functional | normalized domain routing preserves exact lowercase precedence and mixed-case aliases', async function(t){
    const primaryRoot = temporaryDirectory(t, 'node-http-server-primary-domain-');
    const firstAliasRoot = temporaryDirectory(t, 'node-http-server-first-alias-');
    const exactAliasRoot = temporaryDirectory(t, 'node-http-server-exact-alias-');
    const mixedAliasRoot = temporaryDirectory(t, 'node-http-server-mixed-alias-');

    writeFiles(primaryRoot, {'index.html':'primary'});
    writeFiles(firstAliasRoot, {'index.html':'first alias'});
    writeFiles(exactAliasRoot, {'index.html':'exact alias'});
    writeFiles(mixedAliasRoot, {'index.html':'mixed alias'});

    const {server} = await start(t, Server, {
        root:primaryRoot,
        port:0,
        domain:'PRIMARY.TEST',
        domains:{
            'EXAMPLE.TEST':firstAliasRoot,
            'example.test':exactAliasRoot,
            'Mixed.TEST':mixedAliasRoot
        }
    });

    const primary = await request(server, {headers:{Host:'primary.test'}});
    const exact = await request(server, {headers:{Host:'example.test'}});
    const mixed = await request(server, {headers:{Host:'mixed.test'}});
    const unknown = await request(server, {headers:{Host:'unknown.test'}});

    assert.equal(primary.text, 'primary');
    assert.equal(exact.text, 'exact alias');
    assert.equal(mixed.text, 'mixed alias');
    assert.equal(unknown.statusCode, 421);
});

test('Functional | changing the active root rebuilds routing on the next request', async function(t){
    const firstRoot = temporaryDirectory(t, 'node-http-server-live-root-a-');
    const secondRoot = temporaryDirectory(t, 'node-http-server-live-root-b-');

    writeFiles(firstRoot, {'index.html':'first root'});
    writeFiles(secondRoot, {'index.html':'second root'});

    const {server} = await start(t, Server, {root:firstRoot, port:0});
    const first = await request(server);
    server.config.root = secondRoot;
    const second = await request(server);

    assert.equal(first.text, 'first root');
    assert.equal(second.text, 'second root');
});

test('Functional | changing the active primary domain rebuilds Host routing', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'domain root'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        domain:'first.test'
    });
    const first = await request(server, {headers:{Host:'first.test'}});
    server.config.domain = 'second.test';
    const oldDomain = await request(server, {headers:{Host:'first.test'}});
    const newDomain = await request(server, {headers:{Host:'second.test'}});

    assert.equal(first.text, 'domain root');
    assert.equal(oldDomain.statusCode, 421);
    assert.equal(newDomain.text, 'domain root');
});

test('Functional | changing the active domains map rebuilds virtual-host routing', async function(t){
    const primaryRoot = temporaryDirectory(t, 'node-http-server-live-primary-');
    const firstRoot = temporaryDirectory(t, 'node-http-server-live-domain-a-');
    const secondRoot = temporaryDirectory(t, 'node-http-server-live-domain-b-');

    writeFiles(primaryRoot, {'index.html':'primary'});
    writeFiles(firstRoot, {'index.html':'first domain'});
    writeFiles(secondRoot, {'index.html':'second domain'});

    const {server} = await start(t, Server, {
        root:primaryRoot,
        port:0,
        domain:'primary.test',
        domains:{'virtual.test':firstRoot}
    });
    const first = await request(server, {headers:{Host:'virtual.test'}});
    server.config.domains['virtual.test'] = secondRoot;
    const second = await request(server, {headers:{Host:'virtual.test'}});
    delete server.config.domains['virtual.test'];
    const removed = await request(server, {headers:{Host:'virtual.test'}});

    assert.equal(first.text, 'first domain');
    assert.equal(second.text, 'second domain');
    assert.equal(removed.statusCode, 421);
});

test('Functional | replacing the active domains map keeps later mutations live', async function(t){
    const primaryRoot = temporaryDirectory(t, 'node-http-server-replaced-primary-');
    const firstRoot = temporaryDirectory(t, 'node-http-server-replaced-domain-a-');
    const secondRoot = temporaryDirectory(t, 'node-http-server-replaced-domain-b-');

    writeFiles(primaryRoot, {'index.html':'primary'});
    writeFiles(firstRoot, {'index.html':'first replacement'});
    writeFiles(secondRoot, {'index.html':'second replacement'});

    const {server} = await start(t, Server, {
        root:primaryRoot,
        port:0,
        domain:'primary.test'
    });
    const replacement = {'replacement.test':firstRoot};
    server.config.domains = replacement;
    const first = await request(server, {headers:{Host:'replacement.test'}});
    replacement['replacement.test'] = secondRoot;
    const second = await request(server, {headers:{Host:'replacement.test'}});

    assert.equal(first.text, 'first replacement');
    assert.equal(second.text, 'second replacement');
});

test('Functional | SPA fallback is disabled by default', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index fallback'});

    const {server} = await start(t, Server, {root, port:0});
    const response = await request(server, {path:'/dashboard'});

    assert.equal(response.statusCode, 404);
});

test('Functional | SPA fallback true serves the configured index for a navigation route', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index fallback'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{spaFallback:true}
    });
    const response = await request(server, {
        path:'/dashboard',
        headers:{Accept:'text/html'}
    });

    assert.equal(response.text, 'index fallback');
});

test('Functional | a custom SPA fallback applies only to extensionless HTML navigation', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'app.html':'custom fallback'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{spaFallback:'app.html'}
    });
    const custom = await request(server, {
        path:'/custom/route',
        headers:{Accept:'text/html'}
    });
    const rejectsJson = await request(server, {
        path:'/api/route',
        headers:{Accept:'application/json'}
    });
    const rejectsExtension = await request(server, {
        path:'/missing.js',
        headers:{Accept:'text/html'}
    });

    assert.equal(custom.text, 'custom fallback');
    assert.equal(rejectsJson.statusCode, 404);
    assert.equal(rejectsExtension.statusCode, 404);
});

test('Functional | gzip compression returns content that restores the original body', async function(t){
    const root = temporaryDirectory(t);
    const index = '<main>' + 'compressible '.repeat(200) + '</main>';

    writeFiles(root, {'index.html':index});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:0}
    });
    const response = await request(server, {headers:{'Accept-Encoding':'gzip'}});

    assert.equal(response.headers['content-encoding'], 'gzip');
    assert.equal(zlib.gunzipSync(response.body).toString(), index);
});

test('Functional | Brotli is preferred over lower-quality gzip', async function(t){
    const root = temporaryDirectory(t);
    const index = '<main>' + 'compressible '.repeat(200) + '</main>';

    writeFiles(root, {'index.html':index});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:0}
    });
    const response = await request(server, {
        headers:{'Accept-Encoding':'br, gzip;q=0.5'}
    });

    assert.equal(response.headers['content-encoding'], 'br');
    assert.equal(zlib.brotliDecompressSync(response.body).toString(), index);
});

test('Functional | Brotli compression uses quality four by default and accepts a configured quality', async function(t){
    const root = temporaryDirectory(t);
    const index = '<main>' + 'compression quality '.repeat(200) + '</main>';
    const descriptor = Object.getOwnPropertyDescriptor(zlib, 'createBrotliCompress');
    const qualities = [];

    writeFiles(root, {'index.html':index});

    Object.defineProperty(zlib, 'createBrotliCompress', {
        configurable:true,
        enumerable:descriptor.enumerable,
        value:function(options){
            qualities.push(options && options.params && options.params[zlib.constants.BROTLI_PARAM_QUALITY]);
            return options === undefined ? descriptor.value.call(zlib) : descriptor.value.call(zlib, options);
        }
    });

    try{
        const defaults = await start(t, Server, {
            root,
            port:0,
            server:{compression:true, compressionThreshold:0}
        });
        const configured = await start(t, Server, {
            root,
            port:0,
            server:{compression:true, compressionThreshold:0, brotliQuality:7}
        });

        const defaultResponse = await request(defaults.server, {
            headers:{'Accept-Encoding':'br'}
        });
        const configuredResponse = await request(configured.server, {
            headers:{'Accept-Encoding':'br'}
        });

        assert.equal(zlib.brotliDecompressSync(defaultResponse.body).toString(), index);
        assert.equal(zlib.brotliDecompressSync(configuredResponse.body).toString(), index);
        assert.deepEqual(qualities, [4, 7]);
    }finally{
        Object.defineProperty(zlib, 'createBrotliCompress', descriptor);
    }
});

test('Functional | identity is used when every supported compression encoding has zero quality', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'compressible '.repeat(200)});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:0}
    });
    const response = await request(server, {
        headers:{'Accept-Encoding':'br;q=0, gzip;q=0, identity'}
    });

    assert.equal(response.headers['content-encoding'], undefined);
});

test('Functional | content below compressionThreshold remains uncompressed', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'small.txt':'small'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{compression:true, compressionThreshold:100}
    });
    const response = await request(server, {
        path:'/small.txt',
        headers:{'Accept-Encoding':'gzip'}
    });

    assert.equal(response.headers['content-encoding'], undefined);
});

test('Functional | request bodies expose UTF-8 text and original Buffer bytes', async function(t){
    const root = temporaryDirectory(t);
    let bodySeen;
    let bufferSeen;

    writeFiles(root, {'index.html':'unused'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response, serve){
            bodySeen = request.body;
            bufferSeen = request.bodyBuffer;
            response.setHeader('Content-Type', 'application/octet-stream');
            serve(request, response, request.bodyBuffer);
            return true;
        };
    });
    const response = await request(server, {
        path:'/echo',
        method:'POST',
        body:Buffer.from([0xc3, 0xa9])
    });

    assert.equal(response.statusCode, 200);
    assert.equal(bodySeen, 'é');
    assert.equal(Buffer.isBuffer(bufferSeen), true);
    assert.deepEqual(response.body, Buffer.from([0xc3, 0xa9]));
});

test('Functional | bodyless GET and HEAD avoid empty concatenation while framed GET preserves its body', async function(t){
    const root = temporaryDirectory(t);
    const observed = [];
    const originalConcat = Buffer.concat;
    let emptyConcatenations = 0;

    writeFiles(root, {'index.html':'unused'});

    Buffer.concat = function(chunks, length){
        if(arguments.length === 2 && chunks.length === 0 && length === 0){
            emptyConcatenations++;
        }

        return length === undefined ? originalConcat.call(Buffer, chunks) : originalConcat.call(Buffer, chunks, length);
    };

    try{
        const {server} = await start(t, Server, {root, port:0}, function(server){
            server.onRequest = function(request, response, serve){
                observed.push({
                    method:request.method,
                    body:request.body,
                    bodyBuffer:request.bodyBuffer
                });
                serve(request, response, 'ok');
                return true;
            };
        });

        await request(server, {path:'/empty-get'});
        await request(server, {path:'/empty-head', method:'HEAD'});
        await request(server, {
            path:'/framed-get',
            method:'GET',
            headers:{'Content-Length':'6'},
            body:'framed'
        });
    }finally{
        Buffer.concat = originalConcat;
    }

    assert.equal(emptyConcatenations, 0);
    assert.equal(observed.length, 3);
    assert.equal(observed[0].body, '');
    assert.equal(observed[0].bodyBuffer.length, 0);
    assert.equal(observed[1].body, '');
    assert.equal(observed[1].bodyBuffer.length, 0);
    assert.notEqual(observed[0].bodyBuffer, observed[1].bodyBuffer);
    assert.equal(observed[2].body, 'framed');
    assert.deepEqual(observed[2].bodyBuffer, Buffer.from('framed'));
});

test('Functional | maxRequestBodyBytes accepts a body exactly at its boundary', async function(t){
    const root = temporaryDirectory(t);
    let requestCount = 0;

    writeFiles(root, {'index.html':'unused'});

    const limited = await start(t, Server, {
        root,
        port:0,
        server:{maxRequestBodyBytes:4}
    }, function(server){
        server.onRequest = function(request, response, serve){
            requestCount++;
            serve(request, response, 'ok');
            return true;
        };
    });
    const accepted = await request(limited.server, {method:'POST', body:'1234'});

    assert.equal(accepted.statusCode, 200);
    assert.equal(requestCount, 1);
});

test('Functional | maxRequestBodyBytes rejects an oversized body before onRequest', async function(t){
    const root = temporaryDirectory(t);
    let requestCount = 0;

    writeFiles(root, {'index.html':'unused'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{maxRequestBodyBytes:4}
    }, function(server){
        server.onRequest = function(request, response, serve){
            requestCount++;
            serve(request, response, 'unexpected');
            return true;
        };
    });
    const rejected = await request(server, {method:'POST', body:'12345'});

    assert.equal(rejected.statusCode, 413);
    assert.equal(requestCount, 0);
});

test('Functional | maxRequestBodyBytes false permits an unlimited body', async function(t){
    const root = temporaryDirectory(t);
    let unlimitedLength;

    writeFiles(root, {'index.html':'unused'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{maxRequestBodyBytes:false}
    }, function(server){
        server.onRequest = function(request, response, serve){
            unlimitedLength = request.bodyBuffer.length;
            serve(request, response, 'ok');
            return true;
        };
    });
    const body = 'longer than four bytes';
    const response = await request(server, {method:'POST', body});

    assert.equal(response.statusCode, 200);
    assert.equal(unlimitedLength, Buffer.byteLength(body));
});

test('Functional | onRawRequest can intercept before normal routing', async function(t){
    const root = temporaryDirectory(t);
    let rawSeen = false;

    writeFiles(root, {'index.html':'static'});

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
    });
    const response = await request(server, {path:'/raw'});

    assert.equal(rawSeen, true);
    assert.equal(response.text, 'raw');
});

test('Functional | onRequest, beforeServe, and afterServe share mutable body and encoding refs', async function(t){
    const root = temporaryDirectory(t);
    let afterSeen = false;

    writeFiles(root, {'index.html':'static'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
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
    const response = await request(server, {path:'/hook'});

    await waitFor(()=>afterSeen);
    assert.deepEqual(response.body, Buffer.from('é!', 'utf8'));
});

test('Functional | serveFile serves a direct file path', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'index',
        'direct.txt':'direct'
    });

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            if(request.url === '/direct'){
                return server.serveFile(path.join(root, 'direct.txt'), request, response).then(()=>true);
            }
        };
    });

    assert.equal((await request(server, {path:'/direct'})).text, 'direct');
});

test('Functional | serveFile resolves a directory index', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'index',
        'directory/index.html':'directory index'
    });

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            if(request.url === '/directory'){
                return server.serveFile(path.join(root, 'directory'), request, response).then(()=>true);
            }
        };
    });

    assert.equal((await request(server, {path:'/directory'})).text, 'directory index');
});

test('Functional | serveFile missing overloads and absent indexes return 404', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index'});
    fs.mkdirSync(path.join(root, 'missing-index'));

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = function(request, response){
            if(request.url === '/known-missing'){
                return server.serveFile('unused', false, request, response).then(()=>true);
            }
            if(request.url === '/missing'){
                return server.serveFile(path.join(root, 'absent.txt'), request, response).then(()=>true);
            }
            if(request.url === '/missing-index'){
                return server.serveFile(path.join(root, 'missing-index'), request, response).then(()=>true);
            }
        };
    });

    assert.equal((await request(server, {path:'/known-missing'})).statusCode, 404);
    assert.equal((await request(server, {path:'/missing'})).statusCode, 404);
    assert.equal((await request(server, {path:'/missing-index'})).statusCode, 404);
});

test('Functional | serve accepts null as an empty response body', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = async function(request, response, serve){
            if(request.url === '/empty'){
                await serve(request, response, null);
                return true;
            }
        };
    });

    assert.equal((await request(server, {path:'/empty'})).body.length, 0);
});

test('Functional | serve respects a response ended by beforeServe', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'index'});

    const {server} = await start(t, Server, {root, port:0}, function(server){
        server.onRequest = async function(request, response, serve){
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
    });

    assert.equal((await request(server, {path:'/manual'})).text, 'manual');
});

test('Functional | configured timeout options map exact values to the Node server', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const configured = await start(t, Server, {
        root,
        port:0,
        server:{
            timeout:1000,
            requestTimeout:4000,
            headersTimeout:3000,
            keepAliveTimeout:2000
        }
    });

    assert.equal(configured.server.server.timeout, 1000);
    assert.equal(configured.server.server.requestTimeout, 4000);
    assert.equal(configured.server.server.headersTimeout, 3000);
    assert.equal(configured.server.server.keepAliveTimeout, 2000);
});

test('Functional | false timeout options map to Node zero', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'ok'});

    const disabled = await start(t, Server, {
        root,
        port:0,
        server:{
            timeout:false,
            requestTimeout:false,
            headersTimeout:false,
            keepAliveTimeout:false
        }
    });

    assert.equal(disabled.server.server.timeout, 0);
    assert.equal(disabled.server.server.requestTimeout, 0);
    assert.equal(disabled.server.server.headersTimeout, 0);
    assert.equal(disabled.server.server.keepAliveTimeout, 0);
});

test('Functional | custom logging receives request bodies when enabled', async function(t){
    const root = temporaryDirectory(t);
    let entry;

    writeFiles(root, {'index.html':'ok'});

    const {server} = await start(t, Server, {
        root,
        port:0,
        log:true,
        logBody:true,
        logFunction:function(data){
            entry = data;
        }
    }, function(server){
        server.onRequest = function(request, response, serve){
            serve(request, response, 'logged');
            return true;
        };
    });
    const response = await request(server, {method:'POST', body:'request body'});

    await waitFor(()=>entry);
    assert.equal(response.text, 'logged');
    assert.equal(entry.body, 'request body');
});

test('Functional | allowDotfiles true deliberately serves hidden content', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'visible',
        '.gitignore':'private ignore rules',
        '.git/HEAD':'private git head',
        '.well-known/acme-token':'private token'
    });

    const {server} = await start(t, Server, {
        root,
        port:0,
        server:{allowDotfiles:true}
    });

    assert.equal((await request(server, {path:'/.gitignore'})).text, 'private ignore rules');
    assert.equal((await request(server, {path:'/.git/HEAD'})).text, 'private git head');
    assert.equal((await request(server, {path:'/.well-known/acme-token'})).text, 'private token');
});
