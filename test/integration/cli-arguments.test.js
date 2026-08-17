'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const cli = path.resolve(__dirname, '..', '..', 'bin', 'nhs.js');

test('Integration | CLI help documents modern server controls', function(){
    const result = run(['--help']);

    assert.equal(result.status, 0);
    assert.match(result.stdout, /--max-body <bytes\|false>/);
    assert.match(result.stdout, /--timeout <ms\|false>/);
    assert.match(result.stdout, /--keep-alive-timeout <ms\|false>/);
    assert.match(result.stdout, /--allow-dotfiles/);
});

test('Integration | CLI reports the package version', function(){
    const result = run(['--version']);

    assert.equal(result.status, 0);
    assert.equal(result.stdout.trim(), require('../../package.json').version);
});

test('Integration | CLI rejects unknown options', function(){
    const result = run(['--unknown']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /Unknown option/);
});

test('Integration | CLI rejects invalid timeout values', function(){
    const result = run(['--timeout', 'invalid']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /timeout must be a non-negative number/);
});

test('Integration | CLI rejects invalid allow-dotfiles values', function(){
    const result = run(['--allow-dotfiles=maybe']);

    assert.equal(result.status, 2);
    assert.match(result.stderr, /allow-dotfiles must be true or false/);
});

function run(args){
    return childProcess.spawnSync(process.execPath, [cli].concat(args), {
        encoding:'utf8',
        shell:false
    });
}
