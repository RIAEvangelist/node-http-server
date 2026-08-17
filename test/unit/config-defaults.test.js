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
});

test('Unit | Config includes modern MIME defaults', function(){
    assert.equal(new server.Config().contentType.html, 'text/html; charset=utf-8');
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
