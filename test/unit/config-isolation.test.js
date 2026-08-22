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
    assert.notEqual(first.contentType, second.contentType);
});

test('Unit | Config isolates MIME overlays materialized at different times', function(){
    const first = new server.Config({contentType:{custom:'first/type'}});
    const second = new server.Config({contentType:{custom:'second/type'}});

    first.contentType.custom = 'changed/type';

    assert.equal(second.contentType.custom, 'second/type');
    assert.equal(Object.hasOwn(first.contentType, 'html'), true);
    assert.equal(Object.hasOwn(second.contentType, 'html'), true);
});

test('Unit | Config clones deferred MIME overlay values before materialization', function(){
    const source = {contentType:{custom:{value:'original'}}};
    const config = new server.Config(source);

    source.contentType.custom.value = 'changed';

    assert.equal(config.contentType.custom.value, 'original');
});

test('Unit | Config materializes its isolated MIME map after a shallow freeze', function(){
    const config = new server.Config({contentType:{custom:'custom/type'}});

    Object.freeze(config);

    assert.equal(config.contentType.custom, 'custom/type');
    config.contentType.html = 'changed/type';
    config.merge({contentType:{second:'second/type'}});

    assert.equal(config.contentTypeFor('html'), 'changed/type');
    assert.equal(config.contentType.second, 'second/type');
    assert.throws(function(){
        config.contentType = false;
    }, TypeError);
});

test('Unit | Config restores deferred MIME defaults after a sealed assignment', function(){
    const config = new server.Config();

    Object.seal(config);
    config.contentType = false;

    assert.equal(config.contentType, false);

    config.merge({contentType:{custom:'custom/type'}});

    assert.equal(config.contentTypeFor('html'), 'text/html; charset=utf-8');
    assert.equal(config.contentType.custom, 'custom/type');
});

test('Unit | inherited lazy MIME access preserves its owning Config', function(){
    const parent = new server.Config({contentType:{custom:'custom/type'}});
    const child = Object.create(parent);

    assert.equal(child.contentType.custom, 'custom/type');
    assert.equal(parent.contentType.custom, 'custom/type');
    assert.equal(child.contentType, parent.contentType);

    const assignedParent = new server.Config({contentType:{custom:'custom/type'}});
    const assignedChild = Object.create(assignedParent);

    assignedChild.contentType = false;

    assert.equal(assignedChild.contentType, false);
    assert.equal(assignedParent.contentType.custom, 'custom/type');
});

test('Unit | descriptor copies detach deferred MIME state', function(){
    const original = new server.Config({contentType:{custom:'custom/type'}});
    const copy = Object.create(
        Object.getPrototypeOf(original),
        Object.getOwnPropertyDescriptors(original)
    );

    assert.equal(copy.contentType.custom, 'custom/type');
    assert.equal(original.contentType.custom, 'custom/type');
    assert.notEqual(copy.contentType, original.contentType);

    const assignedOriginal = new server.Config({contentType:{custom:'custom/type'}});
    const assignedCopy = Object.create(
        Object.getPrototypeOf(assignedOriginal),
        Object.getOwnPropertyDescriptors(assignedOriginal)
    );

    assignedCopy.contentType = false;

    assert.equal(assignedCopy.contentType, false);
    assert.equal(assignedOriginal.contentType.custom, 'custom/type');
});

test('Unit | frozen descriptor copies preserve shared MIME value semantics', function(){
    const original = new server.Config({contentType:{custom:'custom/type'}});

    Object.freeze(original);
    const copy = Object.create(
        Object.getPrototypeOf(original),
        Object.getOwnPropertyDescriptors(original)
    );

    assert.equal(copy.contentType.custom, 'custom/type');
    assert.equal(original.contentType, copy.contentType);
    assert.throws(function(){
        copy.contentType = false;
    }, TypeError);
    assert.equal(original.contentType.custom, 'custom/type');
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
