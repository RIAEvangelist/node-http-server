'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
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
    const invalidDotfiles = run(['--allow-dotfiles=maybe'], false);

    assert.equal(help.status, 0);
    assert.match(help.stdout, /--max-body <bytes\|false>/);
    assert.match(help.stdout, /--timeout <ms\|false>/);
    assert.match(help.stdout, /--keep-alive-timeout <ms\|false>/);
    assert.match(help.stdout, /--allow-dotfiles/);
    assert.equal(version.status, 0);
    assert.equal(version.stdout.trim(), require('../package.json').version);
    assert.equal(unknown.status, 2);
    assert.match(unknown.stderr, /Unknown option/);
    assert.equal(invalidTimeout.status, 2);
    assert.match(invalidTimeout.stderr, /timeout must be a non-negative number/);
    assert.equal(invalidDotfiles.status, 2);
    assert.match(invalidDotfiles.stderr, /allow-dotfiles must be true or false/);
});

test('CLI serves a configured root and requires an explicit dotfile opt-in', async function(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'served by CLI',
        '.well-known/token':'allowed by CLI opt-in'
    });

    const blocked = await startCli(t, root);
    const response = await get(blocked.port);
    const hidden = await get(blocked.port, '/.well-known/token');

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'served by CLI');
    assert.equal(hidden.statusCode, 403);

    await stopCli(blocked.child);

    const allowed = await startCli(t, root, ['--allow-dotfiles']);
    const allowedHidden = await get(allowed.port, '/.well-known/token');

    assert.equal(allowedHidden.statusCode, 200);
    assert.equal(allowedHidden.body, 'allowed by CLI opt-in');

    await stopCli(allowed.child);
});

async function startCli(t,root,args=[]){
    const childArgs=[cli, '--root', root, '--port', '0', '--timeout', 'false'].concat(args);

    const child = childProcess.spawn(
        process.execPath,
        childArgs,
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
    t.after(async function(){
        await stopCli(child);
    });

    return {
        child:child,
        port:await waitForPort(child,()=>output,()=>errors)
    };
}

async function stopCli(child){
    if(child.exitCode!==null){
        return;
    }

    await new Promise(function(resolve){
        let settled=false;
        const finish=function(){
            if(settled){
                return;
            }
            settled=true;
            clearTimeout(timeout);
            resolve();
        };
        const timeout=setTimeout(function(){
            if(child.exitCode===null){
                child.kill('SIGKILL');
            }
            finish();
        }, 1000);

        child.once('exit', finish);
        if(!child.kill('SIGTERM')){
            finish();
        }
    });
}

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

function get(port,requestPath='/'){
    return new Promise(function(resolve,reject){
        http.get(
            {hostname:'127.0.0.1',port,path:requestPath},
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
