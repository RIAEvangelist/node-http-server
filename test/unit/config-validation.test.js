'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config rejects an array as the root configuration', function(){
    assert.throws(function(){
        return new server.Config([]);
    }, /config must be an object/);
});

test('Unit | Config rejects null contentType records', function(){
    assert.throws(function(){
        return new server.Config({contentType:null});
    }, /contentType must be an object/);
});

test('Unit | Config rejects array error records', function(){
    assert.throws(function(){
        return new server.Config({errors:[]});
    }, /errors must be an object/);
});

test('Unit | Config rejects non-object server settings', function(){
    assert.throws(function(){
        return new server.Config({server:'invalid'});
    }, /server must be an object/);
});

test('Unit | Config rejects class instances as domain maps', function(){
    assert.throws(function(){
        return new server.Config({domains:new Date()});
    }, /domains must be an object/);
});

test('Unit | Config rejects __proto__ without polluting Object', function(){
    assert.throws(function(){
        return new server.Config(JSON.parse('{"__proto__":{"polluted":true}}'));
    }, /unsafe key/);
    assert.equal({}.polluted, undefined);
});

test('Unit | Config rejects nested constructor keys', function(){
    assert.throws(function(){
        return new server.Config({server:JSON.parse('{"constructor":true}')});
    }, /unsafe key/);
});

test('Unit | Config rejects deeply cloned prototype keys', function(){
    assert.throws(function(){
        return new server.Config({extra:JSON.parse('{"prototype":true}')});
    }, /unsafe key/);
});

test('Unit | Config accepts null-prototype MIME maps', function(){
    const contentType = Object.create(null);

    contentType.custom = 'application/x-custom';

    assert.equal(
        new server.Config({contentType}).contentType.custom,
        'application/x-custom'
    );
});
