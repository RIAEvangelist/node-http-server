'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config defaults to the loopback host', function(){
    assert.equal(new server.Config().host, '127.0.0.1');
});

test('Unit | Config provides secure static-file defaults', function(){
    const config = new server.Config();

    assert.equal(config.server.index, 'index.html');
    assert.equal(config.server.allowDotfiles, false);
    assert.equal(config.server.brotliQuality, 4);
});

test('Unit | Config includes modern MIME defaults', function(){
    const contentTypes = new server.Config().contentType;

    assert.equal(contentTypes.html, 'text/html; charset=utf-8');
    assert.equal(Object.hasOwn(contentTypes, 'html'), true);
    assert.equal(Object.keys(contentTypes).includes('html'), true);
});

test('Unit | Config merges custom server settings with defaults', function(){
    const config = new server.Config({server:{timeout:1234}});

    assert.equal(config.server.timeout, 1234);
    assert.equal(config.server.index, 'index.html');
});

test('Unit | Config merges custom MIME types with defaults', function(){
    const config = new server.Config({contentType:{thing:'application/x-thing'}});

    assert.equal(config.contentType.thing, 'application/x-thing');
    assert.equal(config.contentType.html, 'text/html; charset=utf-8');
});

test('Unit | Config defers its MIME snapshot until contentType is read', function(){
    const config = new server.Config({contentType:{thing:'application/x-thing'}});
    const deferred = Object.getOwnPropertyDescriptor(config, 'contentType');

    assert.equal(typeof deferred.get, 'function');
    assert.deepEqual(Object.keys(config), Object.keys(server.Config.defaults));
    assert.equal(Object.hasOwn(config, 'contentType'), true);

    const contentTypes = config.contentType;
    const materialized = Object.getOwnPropertyDescriptor(config, 'contentType');

    assert.equal(materialized.value, contentTypes);
    assert.equal(materialized.writable, true);
    assert.equal(contentTypes.thing, 'application/x-thing');
    assert.equal(contentTypes.html, 'text/html; charset=utf-8');
});

test('Unit | Config resolves MIME defaults and overlays without materializing', function(){
    const config = new server.Config({
        contentType:{thing:'application/x-thing', deny:false}
    });

    assert.equal(config.contentTypeFor('html'), 'text/html; charset=utf-8');
    assert.equal(config.contentTypeFor('thing'), 'application/x-thing');
    assert.equal(config.contentTypeFor('deny'), false);
    assert.equal(config.contentTypeFor('unknown'), undefined);
    assert.equal(
        typeof Object.getOwnPropertyDescriptor(config, 'contentType').get,
        'function'
    );
});

test('Unit | Config merges custom error headers with defaults', function(){
    const config = new server.Config({errors:{headers:{'X-Test':'yes'}}});

    assert.equal(config.errors.headers['X-Test'], 'yes');
    assert.equal(config.errors.headers['Content-Type'], 'text/plain; charset=utf-8');
});

test('Unit | Config accepts domain-to-root mappings', function(){
    const config = new server.Config({domains:{'one.test':'one'}});

    assert.equal(config.domains['one.test'], 'one');
});

test('Unit | Config permits disabling automatic MIME handling', function(){
    const config = new server.Config({contentType:false});

    assert.equal(config.contentType, false);
});
