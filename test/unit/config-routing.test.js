'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | routing version stays stable without routing changes', function(){
    const config = new server.Config();
    const version = server.Config.prototype.routingVersion.call(config);

    assert.equal(server.Config.prototype.routingVersion.call(config), version);
});

test('Unit | routing version follows direct root and domain assignments', function(){
    const config = new server.Config();
    const initial = config.routingVersion();

    config.root = 'alternate-root';
    const rootVersion = config.routingVersion();

    config.domain = 'alternate.test';
    const domainVersion = config.routingVersion();

    assert.equal(rootVersion > initial, true);
    assert.equal(domainVersion > rootVersion, true);
    assert.equal(config.routingVersion(), domainVersion);
});

test('Unit | routing version follows domain-map set define and delete', function(){
    const config = new server.Config();
    const initial = config.routingVersion();

    config.domains['one.test'] = 'one';
    const setVersion = config.routingVersion();

    Object.defineProperty(
        config.domains,
        'two.test',
        {configurable:true,enumerable:true,value:'two',writable:true}
    );
    const defineVersion = config.routingVersion();

    delete config.domains['one.test'];
    const deleteVersion = config.routingVersion();

    assert.equal(setVersion > initial, true);
    assert.equal(defineVersion > setVersion, true);
    assert.equal(deleteVersion > defineVersion, true);
    assert.deepEqual(Object.keys(config.domains), ['two.test']);
    assert.equal(Object.hasOwn(config.domains, 'two.test'), true);
    assert.equal(JSON.stringify(config.domains), '{"two.test":"two"}');
});

test('Unit | routing version tracks a replaced domain map and later mutations', function(){
    const config = new server.Config();
    const initial = config.routingVersion();
    const replacement = {'one.test':'one'};

    config.domains = replacement;
    const replacedVersion = config.routingVersion();

    config.domains['two.test'] = 'two';
    const mutatedVersion = config.routingVersion();

    replacement['one.test'] = 'updated';
    const aliasVersion = config.routingVersion();

    assert.equal(replacedVersion > initial, true);
    assert.equal(mutatedVersion > replacedVersion, true);
    assert.equal(aliasVersion > mutatedVersion, true);
    assert.equal(config.domains['one.test'], 'updated');
    assert.deepEqual(
        Object.keys(config.domains),
        ['one.test', 'two.test']
    );
});

test('Unit | routing version follows Config merge routing overlays', function(){
    const config = new server.Config();
    const initial = config.routingVersion();

    config.merge({
        root:'merged-root',
        domain:'merged.test',
        domains:{'alternate.test':'alternate'}
    });
    const merged = config.routingVersion();

    assert.equal(merged > initial, true);
    assert.equal(config.root, 'merged-root');
    assert.equal(config.domain, 'merged.test');
    assert.equal(config.domains['alternate.test'], 'alternate');
    assert.equal(config.routingVersion(), merged);
});
