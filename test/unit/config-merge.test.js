'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config restores MIME defaults when merging after false', function(){
    const config = new server.Config({contentType:false});

    config.merge({contentType:{thing:'application/x-thing'}});

    assert.equal(
        typeof Object.getOwnPropertyDescriptor(config, 'contentType').get,
        'function'
    );

    assert.equal(config.contentType.html, 'text/html; charset=utf-8');
    assert.equal(config.contentType.thing, 'application/x-thing');
});

test('Unit | Config accumulates deferred MIME overlays in merge order', function(){
    const config = new server.Config({contentType:{first:'first/type'}});

    config.merge({contentType:{second:'second/type', first:'changed/type'}});

    assert.equal(
        typeof Object.getOwnPropertyDescriptor(config, 'contentType').get,
        'function'
    );
    assert.equal(config.contentType.first, 'changed/type');
    assert.equal(config.contentType.second, 'second/type');
    assert.equal(config.contentType.html, 'text/html; charset=utf-8');
});

test('Unit | Config merges MIME overlays into an existing materialized map', function(){
    const config = new server.Config();
    const contentTypes = config.contentType;

    config.merge({contentType:{thing:'application/x-thing'}});

    assert.equal(config.contentType, contentTypes);
    assert.equal(contentTypes.thing, 'application/x-thing');
});

test('Unit | Config resolver follows false and restored MIME states', function(){
    const config = new server.Config({contentType:false});

    assert.equal(config.contentTypeFor('html'), undefined);

    config.merge({contentType:{thing:'application/x-thing'}});

    assert.equal(config.contentTypeFor('html'), 'text/html; charset=utf-8');
    assert.equal(config.contentTypeFor('thing'), 'application/x-thing');
});

test('Unit | Config restores server defaults when merging after false', function(){
    const config = new server.Config();

    config.server = false;
    config.merge({server:{timeout:12}});

    assert.equal(config.server.timeout, 12);
    assert.equal(config.server.index, 'index.html');
});

test('Unit | Config restores error defaults when merging after false', function(){
    const config = new server.Config();

    config.errors = false;
    config.merge({errors:{404:'gone'}});

    assert.equal(config.errors[404], 'gone');
    assert.equal(config.errors[500], '500 Internal Server Error');
});

test('Unit | Config restores error headers when merging after false', function(){
    const config = new server.Config();

    config.errors.headers = false;
    config.merge({errors:{headers:{Test:'yes'}}});

    assert.equal(config.errors.headers.Test, 'yes');
    assert.equal(config.errors.headers['Content-Type'], 'text/plain; charset=utf-8');
});
