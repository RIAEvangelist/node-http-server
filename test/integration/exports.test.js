'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Integration | CommonJS exports the singleton Server instance', function(){
    assert.equal(server instanceof server.Server, true);
});

test('Integration | CommonJS exposes Config and RefString constructors', function(){
    assert.equal(typeof server.Config, 'function');
    assert.equal(typeof server.RefString, 'function');
    assert.equal(new server.RefString('').value, '');
});

test('Integration | ESM default export matches the CommonJS singleton', async function(){
    const module = await import('../../server/index.mjs');

    assert.equal(module.default, server);
});

test('Integration | ESM exposes matching public constructors', async function(){
    const module = await import('../../server/index.mjs');

    assert.equal(module.Server, server.Server);
    assert.equal(module.Config, server.Config);
    assert.equal(module.RefString, server.RefString);
});

test('Integration | ESM Config exposes matching default and named exports', async function(){
    const module = await import('../../server/Config.mjs');

    assert.equal(module.default, server.Config);
    assert.equal(module.Config, server.Config);
});

test('Integration | ESM MIME exposes the default map and contentTypes alias', async function(){
    const module = await import('../../server/MimeTypes.mjs');

    assert.equal(module.default.webp, 'image/webp');
    assert.equal(module.contentTypes, module.default);
});
