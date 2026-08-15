'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { once } = require('node:events');
const { test } = require('node:test');
const {
    temporaryDirectory,
    writeFiles
} = require('./helpers.js');

const cli = path.resolve(__dirname, '..', 'bin', 'nhs.js');

test('CLI documents options, reports its version, and rejects invalid input', function(){
    const help = run(['--help']);
    const version = run(['--version']);
    const unknown = run(['--unknown'], false);
    const invalidTimeout = run(['--timeout', 'invalid'], false);

    assert.equal(help.status, 0);
    assert.match(help.stdout, /--max-body <bytes\|false>/);
    assert.match(help.stdout, /--timeout <ms\|false>/);
    assert.match(help.stdout, /--keep-alive-timeout <ms\|false>/);
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), require('../package.json').version);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /Unknown option/);
    assert.equal(invalidTimeout.status, 2);
    assert.match(invalidTimeout.stderr, /timeout must be a non-negative number/);
});

test('CLI serves a configured root on an ephemeral localhost port', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {'index.html':'served by CLI'});

    const child = childProcess.spawn(
        process.execPath,
        [cli, '--root', root, '--port', '0', '--timeout', 'false'],
        {
            cwd:root,
            stdio:['ignore', 'pipe', 'pipe']
        }
    );
    let output = '';
    let errors = '';

    child.stdout.on('data', chunk=>{
        output += chunk;
    });
    child.stderr.on('data', chunk=>{
        errors += chunk;
    });
    t.after(function(){
        if(child.exitCode===null){
            child.kill();
        }
    });

    const port = await waitForPort(child,()=>output,()=>errors);
    const response = await get(port);

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'served by CLI');

    child.kill('SIGTERM');
    if(child.exitCode===null){
        await once(child, 'exit');
    }
});

function run(args,success=true){
    const result = childProcess.spawnSync(process.execPath, [cli].concat(args), {
        encoding:'utf8',
        shell:false
    });

    if(success && result.error){
        throw result.error;
    }

    return result;
}

function waitForPort(child,getOutput,getErrors){
    return new Promise(function(resolve,reject){
        const timeout = setTimeout(function(){
            reject(new Error('CLI did not start in time. ' + getErrors()));
        }, 5000);

        const inspect = function(){
            const match=/listening at http:\/\/127\.0\.0\.1:(\d+)/.exec(getOutput());
            if(match){
                clearTimeout(timeout);
                resolve(Number(match[1]));
            }
        };

        child.stdout.on('data', inspect);
        child.once('error', function(error){
            clearTimeout(timeout);
            reject(error);
        });
        child.once('exit', function(code){
            if(code!==null && !/listening at/.test(getOutput())){
                clearTimeout(timeout);
                reject(new Error(`CLI exited with ${code}. ${getErrors()}`));
            }
        });
    });
}

function get(port){
    return new Promise(function(resolve,reject){
        http.get(
            {hostname:'127.0.0.1',port,path:'/'},
            function(response){
                const chunks=[];
                response.on('data',chunk=>chunks.push(chunk));
                response.on('end',()=>resolve({
                    statusCode:response.statusCode,
                    body:Buffer.concat(chunks).toString('utf8')
                }));
            }
        ).on('error',reject);
    });
}
