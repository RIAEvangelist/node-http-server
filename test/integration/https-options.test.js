'use strict';

const assert = require('node:assert/strict');
const http = require('node:http');
const https = require('node:https');
const {once} = require('node:events');
const test = require('node:test');
const {Server} = require('../../server/Server.js');
const {request, temporaryDirectory, writeFiles} = require('../helpers.js');

test(
    'Integration | raw HTTPS options reach Node unchanged and take precedence over path configuration',
    async function nativeHttpsOptions(t) {
        const root = temporaryDirectory(t);
        writeFiles(
            root,
            {'index.html': 'native options'}
        );
        const pfx = Buffer.from('synthetic option transport fixture');
        function selectContext(servername, callback) {
            callback(null, {servername});
        }
        let certificateReads = 0;
        const rawOptions = {
            pfx,
            passphrase: 'synthetic fixture',
            SNICallback: selectContext,
            get cert() {
                certificateReads += 1;
                return pfx;
            }
        };
        const server = new Server(
            {
                root,
                port: 0,
                https: {
                    options: rawOptions,
                    enforce: true,
                    privateKey: 'unused-path',
                    certificate: 'unused-path',
                    port: 0,
                    only: true
                }
            }
        );
        const originalCreateServer = https.createServer;
        let observed;
        // This isolates the Node options delegation boundary; it is not a TLS handshake test.
        https.createServer = function observeNativeHttpsOptions(options, handler) {
            assert.equal(certificateReads, 0);
            observed = options;
            return http.createServer(handler);
        };
        try {
            server.deploy();
            https.createServer = originalCreateServer;
            if (!server.secureServer.listening) {
                await once(server.secureServer, 'listening');
            }
            assert.equal(observed, rawOptions);
            assert.equal(observed.pfx, pfx);
            assert.equal(observed.SNICallback, selectContext);
            assert.equal(observed.passphrase, rawOptions.passphrase);
            assert.equal(observed.cert, pfx);
            assert.equal(certificateReads, 1);
            assert.equal(server.server, null);
            const response = await request(
                {server: server.secureServer}
            );
            assert.equal(response.text, 'native options');
        } finally {
            https.createServer = originalCreateServer;
            await server.close();
        }
    }
);
