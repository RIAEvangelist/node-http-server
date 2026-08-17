'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config.defaults returns an isolated snapshot', function(){
    const defaults = server.Config.defaults;

    defaults.server.index = 'changed.html';

    assert.equal(server.Config.defaults.server.index, 'index.html');
});

test('Unit | Config.mimeTypes returns an isolated map', function(){
    const mimeTypes = server.Config.mimeTypes;

    mimeTypes.html = 'changed/type';

    assert.equal(server.Config.mimeTypes.html, 'text/html; charset=utf-8');
});

test('Unit | Config clones nested source values', function(){
    const source = {extra:[{value:'original'}]};
    const config = new server.Config(source);

    source.extra[0].value = 'changed';

    assert.equal(config.extra[0].value, 'original');
});

test('Unit | Config isolates server settings between instances', function(){
    const first = new server.Config();
    const second = new server.Config();

    first.server.index = 'changed.html';
    first.server.allowDotfiles = true;

    assert.equal(second.server.index, 'index.html');
    assert.equal(second.server.allowDotfiles, false);
});

test('Unit | Config isolates MIME maps between instances', function(){
    const first = new server.Config();
    const second = new server.Config();

    first.contentType.html = 'changed/type';

    assert.notEqual(second.contentType.html, 'changed/type');
});

test('Unit | Config isolates error headers between instances', function(){
    const first = new server.Config();
    const second = new server.Config();

    first.errors.headers.Test = 'changed';

    assert.equal(second.errors.headers.Test, undefined);
});

test('Unit | Config isolates domain maps between instances', function(){
    const first = new server.Config();
    const second = new server.Config();

    first.domains['two.test'] = 'two';

    assert.equal(second.domains['two.test'], undefined);
});
