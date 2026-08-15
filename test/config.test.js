'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const server = require('../server/Server.js');

test('CommonJS exposes the singleton and public constructors', function(){
    assert.equal(server instanceof server.Server, true);
    assert.equal(typeof server.Config, 'function');
    assert.equal(typeof server.RefString, 'function');
    assert.equal(new server.RefString('').value, '');
});

test('Config defaults are modern, merged, and deeply isolated', function(){
    const first = new server.Config({
        server:{timeout:1234},
        contentType:{thing:'application/x-thing'},
        errors:{headers:{'X-Test':'yes'}},
        domains:{'one.test':'one'}
    });
    const second = new server.Config();

    assert.equal(first.host, '127.0.0.1');
    assert.equal(first.server.timeout, 1234);
    assert.equal(first.server.index, 'index.html');
    assert.equal(first.contentType.thing, 'application/x-thing');
    assert.equal(first.contentType.html, 'text/html; charset=utf-8');
    assert.equal(first.errors.headers['X-Test'], 'yes');

    first.server.index = 'changed.html';
    first.contentType.html = 'changed/type';
    first.errors.headers.Test = 'changed';
    first.domains['two.test'] = 'two';

    assert.equal(second.server.index, 'index.html');
    assert.notEqual(second.contentType.html, 'changed/type');
    assert.equal(second.errors.headers.Test, undefined);
    assert.equal(second.domains['two.test'], undefined);
});

test('Config permits disabling automatic MIME handling', function(){
    const config = new server.Config({contentType:false});

    assert.equal(config.contentType, false);
});

test('Config static values, source values, and replacement maps remain isolated', function(){
    const defaults = server.Config.defaults;
    const mimeTypes = server.Config.mimeTypes;
    const source = {
        extra:[{value:'original'}]
    };
    const config = new server.Config(source);

    defaults.server.index = 'changed.html';
    mimeTypes.html = 'changed/type';
    source.extra[0].value = 'changed';

    assert.equal(server.Config.defaults.server.index, 'index.html');
    assert.equal(server.Config.mimeTypes.html, 'text/html; charset=utf-8');
    assert.equal(config.extra[0].value, 'original');

    config.contentType = false;
    config.merge({contentType:{thing:'application/x-thing'}});
    assert.equal(config.contentType.html, 'text/html; charset=utf-8');
    assert.equal(config.contentType.thing, 'application/x-thing');

    config.server = false;
    config.merge({server:{timeout:12}});
    assert.equal(config.server.timeout, 12);
    assert.equal(config.server.index, 'index.html');

    config.errors = false;
    config.merge({errors:{404:'gone'}});
    assert.equal(config.errors[404], 'gone');

    config.errors.headers = false;
    config.merge({errors:{headers:{Test:'yes'}}});
    assert.equal(config.errors.headers.Test, 'yes');
    assert.equal(config.errors.headers['Content-Type'], 'text/plain; charset=utf-8');
});

test('Config rejects invalid records and prototype-pollution keys', function(){
    assert.throws(()=>new server.Config([]), /config must be an object/);
    assert.throws(()=>new server.Config({contentType:null}), /contentType must be an object/);
    assert.throws(()=>new server.Config({errors:[]}), /errors must be an object/);
    assert.throws(()=>new server.Config({server:'invalid'}), /server must be an object/);
    assert.throws(()=>new server.Config({domains:new Date()}), /domains must be an object/);
    assert.throws(
        ()=>new server.Config(JSON.parse('{"__proto__":{"polluted":true}}')),
        /unsafe key/
    );
    assert.throws(
        ()=>new server.Config({server:JSON.parse('{"constructor":true}')}),
        /unsafe key/
    );
    assert.throws(
        ()=>new server.Config({extra:JSON.parse('{"prototype":true}')}),
        /unsafe key/
    );
    assert.equal({}.polluted, undefined);

    const nullPrototype = Object.create(null);
    nullPrototype.custom = 'application/x-custom';
    assert.equal(new server.Config({contentType:nullPrototype}).contentType.custom, 'application/x-custom');
});

test('the default logger returns serialization and filesystem errors', async function(){
    const logger = new server.Config().logFunction;
    const originalAppendFile = fs.appendFile;
    const circular = {};

    circular.circular = circular;

    try{
        await assert.rejects(logger.call({log:'unused'}, circular));

        fs.appendFile = function(filename, data, encoding, callback){
            callback(new Error('async logging failure'));
        };
        await assert.rejects(
            logger.call({log:'unused'}, {method:'GET'}),
            /async logging failure/
        );

        fs.appendFile = function(){
            throw new Error('sync logging failure');
        };
        await assert.rejects(
            logger.call({log:'unused'}, {method:'GET'}),
            /sync logging failure/
        );
    }finally{
        fs.appendFile = originalAppendFile;
    }
});

test('ESM exposes the same default singleton and named constructors', async function(){
    const module = await import('../server/index.mjs'),
        configModule = await import('../server/Config.mjs'),
        mimeModule = await import('../server/MimeTypes.mjs');

    assert.equal(module.default, server);
    assert.equal(module.Server, server.Server);
    assert.equal(module.Config, server.Config);
    assert.equal(module.RefString, server.RefString);
    assert.equal(configModule.default, server.Config);
    assert.equal(configModule.Config, server.Config);
    assert.equal(mimeModule.default.webp, 'image/webp');
    assert.equal(mimeModule.contentTypes, mimeModule.default);
});
