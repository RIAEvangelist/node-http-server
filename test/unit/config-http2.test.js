'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const server = require('../../server/Server.js');

test('Unit | Config enables HTTP/2 by default and accepts the HTTPS opt-out', function(){
    const defaults = new server.Config();
    const explicit = new server.Config({https:{http2:false}});

    assert.equal(defaults.https.http2, true);
    assert.equal(explicit.https.http2, false);
    assert.equal(explicit.https.port, defaults.https.port);
    assert.equal(explicit.https.only, defaults.https.only);
});

test('Unit | partial HTTPS merges preserve protocol selection and other HTTPS options', function(){
    const config = new server.Config({https:{
        privateKey:'key.pem',
        certificate:'certificate.pem',
        port:8443,
        only:true
    }});

    config.merge({https:{ca:'ca.pem'}});

    assert.equal(config.https.http2, true);

    config.merge({https:{http2:false}});
    config.merge({https:{port:9443}});

    assert.deepEqual(config.https, {
        ca:'ca.pem',
        privateKey:'key.pem',
        certificate:'certificate.pem',
        passphrase:false,
        http2:false,
        port:9443,
        only:true
    });

    config.merge({https:{http2:true}});

    assert.equal(config.https.http2, true);
    assert.equal(config.https.port, 9443);
    assert.equal(config.https.privateKey, 'key.pem');
    assert.equal(config.https.certificate, 'certificate.pem');
});

test('Unit | constructor and merge options cannot later change the selected HTTPS protocol', function(){
    const constructorOptions = {https:{http2:false, port:8443}};
    const mergeOptions = {https:{http2:false, port:9443}};
    const constructed = new server.Config(constructorOptions);
    const merged = new server.Config();

    merged.merge(mergeOptions);
    constructorOptions.https.http2 = true;
    constructorOptions.https.port = 443;
    mergeOptions.https.http2 = true;
    mergeOptions.https.port = 443;

    assert.equal(constructed.https.http2, false);
    assert.equal(constructed.https.port, 8443);
    assert.equal(merged.https.http2, false);
    assert.equal(merged.https.port, 9443);

    constructed.https.port = 10443;
    merged.https.port = 11443;

    assert.equal(constructorOptions.https.port, 443);
    assert.equal(mergeOptions.https.port, 443);
});

test('Unit | HTTPS protocol changes stay within each Config and defaults snapshot', function(){
    const defaults = server.Config.defaults;
    const first = new server.Config();
    const second = new server.Config();

    defaults.https.http2 = false;
    first.https.http2 = false;

    assert.equal(second.https.http2, true);
    assert.equal(server.Config.defaults.https.http2, true);
    assert.equal(new server.Config().https.http2, true);

    second.merge({https:{http2:false}});
    first.merge({https:{http2:true}});

    assert.equal(second.https.http2, false);
    assert.equal(defaults.https.http2, false);
});

test('Unit | Server instances own their HTTPS protocol selection', function(){
    const options = {https:{http2:false}};
    const first = new server.Server(options);
    const second = new server.Server(options);
    const defaults = new server.Server();

    options.https.http2 = true;

    assert.equal(first.config.https.http2, false);
    assert.equal(second.config.https.http2, false);
    assert.equal(defaults.config.https.http2, true);

    first.config.merge({https:{http2:true}});

    assert.equal(first.config.https.http2, true);
    assert.equal(second.config.https.http2, false);
    assert.equal(defaults.config.https.http2, true);
    assert.equal(new server.Server().config.https.http2, true);
});
