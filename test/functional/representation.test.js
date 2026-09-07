'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const {Server} = require('../../server/Server.js');
const {request, start, temporaryDirectory, writeFiles} = require('../helpers.js');

test(
    'Functional | conditional representations skip generation for 304 and HEAD and preserve final modification metadata',
    async function conditionalRepresentation(t) {
        const root = temporaryDirectory(t);
        let generated = 0;
        let completed = 0;
        let modified = new Date('2026-09-06T10:00:00Z');
        const {server} = await start(
            t,
            Server,
            {root, port: 0},
            function configureRepresentation(instance) {
                instance.onRawRequest = async function respondWithRepresentation(req, res) {
                    res.setHeader('Cache-Control', 'no-cache');
                    await this.serveRepresentation(
                        req,
                        res,
                        {
                            lastModified: modified,
                            contentType: 'text/html; charset=utf-8',
                            async body() {
                                generated += 1;
                                return '  Complete generated response.\nSecond line.  ';
                            }
                        }
                    );
                    return true;
                };
                instance.afterServe = function completedRepresentation() {
                    completed += 1;
                };
            }
        );
        const first = await request(server);
        assert.equal(first.statusCode, 200);
        assert.equal(first.text, '  Complete generated response.\nSecond line.  ');
        assert.equal(first.headers['last-modified'], modified.toUTCString());
        assert.equal(first.headers['cache-control'], 'no-cache');
        assert.equal(first.headers.etag, undefined);
        assert.equal(generated, 1);

        const unchanged = await request(
            server,
            {headers: {'If-Modified-Since': first.headers['last-modified']}}
        );
        assert.equal(unchanged.statusCode, 304);
        assert.equal(unchanged.text, '');
        assert.equal(generated, 1);
        assert.equal(unchanged.headers['content-length'], undefined);

        modified = new Date('2026-09-06T10:01:00Z');
        const head = await request(
            server,
            {method: 'HEAD', headers: {'If-Modified-Since': first.headers['last-modified']}}
        );
        assert.equal(head.statusCode, 200);
        assert.equal(head.text, '');
        assert.equal(head.headers['last-modified'], modified.toUTCString());
        assert.equal(generated, 1);
        const changed = await request(
            server,
            {headers: {'If-Modified-Since': first.headers['last-modified']}}
        );
        assert.equal(changed.statusCode, 200);
        assert.equal(generated, 2);
        assert.equal(completed, 4);
    }
);

test(
    'Functional | lazy representation errors remain owned by the request lifecycle and explicit entity conditions take precedence',
    async function representationErrorsAndConditions(t) {
        const root = temporaryDirectory(t);
        const failure = new Error('The complete generated response is unavailable.');
        const modified = new Date('2026-09-06T10:00:00Z');
        const {server} = await start(
            t,
            Server,
            {root, port: 0, server: {nosniff: false}},
            function configureFailure(instance) {
                instance.onRawRequest = async function unavailableRepresentation(req, res) {
                    await this.serveRepresentation(
                        req,
                        res,
                        {
                            lastModified: modified,
                            contentType: 'text/plain',
                            async body() {
                                throw failure;
                            }
                        }
                    );
                    return true;
                };
            }
        );
        const wildcard = await request(
            server,
            {headers: {'If-None-Match': '*'}}
        );
        assert.equal(wildcard.statusCode, 304);
        const failed = await request(
            server,
            {headers: {'If-None-Match': '"other"', 'If-Modified-Since': modified.toUTCString()}}
        );
        assert.equal(failed.statusCode, 500);
        assert.equal(server.lastError, failure);
        assert.equal(failed.headers['x-content-type-options'], undefined);
    }
);

test(
    'Functional | disabling automatic ETags and nosniff preserves static Last-Modified and range responses',
    async function staticLastModifiedWithoutEtag(t) {
        const root = temporaryDirectory(t);
        writeFiles(
            root,
            {'index.html': 'complete static response'}
        );
        const {server} = await start(
            t,
            Server,
            {root, port: 0, server: {etag: false, nosniff: false, noCache: false}}
        );
        const first = await request(server);
        assert.equal(first.text, 'complete static response');
        assert.equal(first.headers.etag, undefined);
        assert.equal(first.headers['x-content-type-options'], undefined);
        assert.ok(first.headers['last-modified']);
        const unchanged = await request(
            server,
            {headers: {'If-Modified-Since': first.headers['last-modified']}}
        );
        assert.equal(unchanged.statusCode, 304);
        const partial = await request(
            server,
            {headers: {Range: 'bytes=0-7', 'If-Range': first.headers['last-modified']}}
        );
        assert.equal(partial.statusCode, 206);
        assert.equal(partial.text, 'complete');
        const unmatchedTag = await request(
            server,
            {headers: {Range: 'bytes=0-7', 'If-Range': '"not-a-current-tag"'}}
        );
        assert.equal(unmatchedTag.statusCode, 200);
        assert.equal(unmatchedTag.text, 'complete static response');
        const missing = await request(
            server,
            {path: '/missing'}
        );
        assert.equal(missing.statusCode, 404);
        assert.equal(missing.headers['x-content-type-options'], undefined);
    }
);

test(
    'Functional | existing static validator and content-type-options defaults remain enabled',
    async function preservedStaticDefaults(t) {
        const root = temporaryDirectory(t);
        writeFiles(
            root,
            {'index.html': 'default response'}
        );
        const {server} = await start(
            t,
            Server,
            {root, port: 0}
        );
        const first = await request(server);
        assert.match(first.headers.etag, /^W\//);
        assert.equal(first.headers['x-content-type-options'], 'nosniff');
        const cached = await request(
            server,
            {headers: {'If-None-Match': first.headers.etag}}
        );
        assert.equal(cached.statusCode, 304);
    }
);
