'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config restores MIME defaults when merging after false', function(){
    const config = new server.Config({contentType:false});

    config.merge({contentType:{thing:'application/x-thing'}});

    assert.equal(config.contentType.html, 'text/html; charset=utf-8');
    assert.equal(config.contentType.thing, 'application/x-thing');
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
