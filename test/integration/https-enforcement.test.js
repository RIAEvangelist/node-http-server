'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const {once} = require('node:events');
const test = require('node:test');
const {Server} = require('../../server/Server.js');
const {request, start, temporaryDirectory, writeFiles} = require('../helpers.js');

test(
    'Integration | HTTPS enforcement remains opt-in for existing HTTP consumers',
    async function defaultHttpServing(t) {
        const root = temporaryDirectory(t);
        writeFiles(
            root,
            {'index.html': 'ordinary HTTP response'}
        );
        const {server} = await start(
            t,
            Server,
            {root, port: 0}
        );
        assert.equal(server.config.https.enforce, false);
        assert.equal(server.secureServer, null);
        assert.equal((await request(server)).text, 'ordinary HTTP response');
    }
);

test(
    'Integration | enforced HTTPS reports missing TLS configuration before opening listeners',
    function missingHttpsConfiguration(t) {
        const server = new Server(
            {
                root: temporaryDirectory(t),
                port: 0,
                https: {enforce: true, port: 0}
            }
        );
        assert.throws(
            function deployWithoutTls() {
                server.deploy();
            },
            {code: 'ERR_HTTPS_CONFIGURATION'}
        );
        assert.equal(server.server, null);
        assert.equal(server.secureServer, null);
    }
);

test(
    'Integration | paired enforcement redirects before hooks and retains the request target and method',
    async function pairedHttpsRedirects(t) {
        const server = new Server(
            {
                root: temporaryDirectory(t),
                port: 0,
                https: {options: {}, enforce: true, port: 0}
            }
        );
        let handled = 0;
        let completed = 0;
        let receivedMethod;
        let receivedTarget;
        server.onRawRequest = async function serveEncryptedRequest(req, res) {
            handled += 1;
            receivedMethod = req.method;
            receivedTarget = req.url;
            const chunks = [];
            for await (const chunk of req) {
                chunks.push(chunk);
            }
            await this.serve(req, res, Buffer.concat(chunks));
            return true;
        };
        server.afterServe = function completedResponse() {
            completed += 1;
        };

        const originalCreateServer = https.createServer;
        // Exercise listener selection and redirects, not a TLS handshake.
        https.createServer = function createSyntheticHttpsListener(options, handler) {
            return http.createServer(handler);
        };
        try {
            server.deploy();
            https.createServer = originalCreateServer;
            const listeners = [server.server, server.secureServer];
            await Promise.all(
                listeners.map(
                    function waitForListener(listener) {
                        return listener.listening ? undefined : once(listener, 'listening');
                    }
                )
            );
            const securePort = server.secureServer.address().port;
            const target = '/a%2Fb/../literal?x=1+2&x=%2F&empty=';
            for (const method of ['GET', 'HEAD', 'POST']) {
                const redirected = await request(
                    server,
                    {path: target, method, body: method === 'POST' ? 'complete request' : undefined}
                );
                assert.equal(redirected.statusCode, 308);
                assert.equal(redirected.headers.location, `https://127.0.0.1:${securePort}${target}`);
                assert.equal(redirected.text, '');
            }
            const absolute = await request(
                server,
                {path: `http://localhost:8080${target}`}
            );
            assert.equal(absolute.headers.location, `https://localhost:${securePort}${target}`);
            const ipv6 = await request(
                server,
                {path: target, headers: {Host: '[::1]:8080'}}
            );
            assert.equal(ipv6.headers.location, `https://[::1]:${securePort}${target}`);
            assert.equal(handled, 0);
            assert.equal(completed, 5);

            const body = '  Complete POST content.\nSecond line.  ';
            const encrypted = await request(
                {server: server.secureServer},
                {path: target, method: 'POST', body}
            );
            assert.equal(encrypted.statusCode, 200);
            assert.equal(encrypted.headers.location, undefined);
            assert.equal(encrypted.text, body);
            assert.equal(receivedMethod, 'POST');
            assert.equal(receivedTarget, target);
            assert.equal(handled, 1);
            assert.equal(completed, 6);
        } finally {
            https.createServer = originalCreateServer;
            await server.close();
        }
    }
);
