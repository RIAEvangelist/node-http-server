'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const test = require('node:test');

const projectRoot = path.resolve(__dirname, '../..');
const benchmarkScript = path.join(projectRoot, 'benchmark', 'run.js');
let smokeOutput;

function run(args){
    return spawnSync(process.execPath, [benchmarkScript].concat(args), {
        cwd:projectRoot,
        encoding:'utf8',
        shell:false,
        timeout:30000,
        windowsHide:true
    });
}

function smoke(){
    if(smokeOutput){
        return smokeOutput;
    }

    const result = run(['--smoke', '--json']);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(result.stderr, '');
    smokeOutput = JSON.parse(result.stdout);
    return smokeOutput;
}

test('Integration | benchmark smoke executes every public-path scenario', function(){
    const output = smoke();

    assert.deepEqual(output.configuration, {
        requestsPerScenario:8,
        warmupRequestsPerScenario:2,
        concurrency:2
    });
    assert.deepEqual(
        output.scenarios.map(function(scenario){
            return scenario.id;
        }),
        [
            'static-get-small',
            'static-head-small',
            'static-range-large',
            'spa-fallback-gzip',
            'dynamic-hook'
        ]
    );
    assert.equal(output.benchmark, 'node-http-server');
    assert.match(output.version, /^\d+\.\d+\.\d+$/);
});

test('Integration | benchmark metrics report finite throughput and ordered percentiles', function(){
    const output = smoke();

    for(const scenario of output.scenarios){
        const latency = scenario.latencyMilliseconds;

        assert.equal(scenario.requests, 8);
        assert.equal(Number.isFinite(scenario.durationMilliseconds), true);
        assert.equal(scenario.durationMilliseconds > 0, true);
        assert.equal(Number.isFinite(scenario.requestsPerSecond), true);
        assert.equal(scenario.requestsPerSecond > 0, true);
        assert.equal(latency.p50 >= 0, true);
        assert.equal(latency.p95 >= latency.p50, true);
        assert.equal(latency.p99 >= latency.p95, true);
    }
});

test('Integration | benchmark CLI rejects invalid request counts', function(){
    const result = run(['--requests', '0', '--json']);

    assert.equal(result.status, 1);
    assert.equal(result.stdout, '');
    assert.match(result.stderr, /--requests must be a positive integer/);
});
