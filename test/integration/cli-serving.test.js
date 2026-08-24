'use strict';

const assert = require('node:assert/strict');
const childProcess = require('node:child_process');
const http = require('node:http');
const path = require('node:path');
const { test } = require('node:test');
const {
    temporaryDirectory,
    writeFiles
} = require('../helpers.js');

const cli = path.resolve(__dirname, '..', '..', 'bin', 'nhs.js');

test('Integration | CLI serves its configured root', async function(t){
    const root = fixture(t);
    const running = await startCli(t, root);
    let response;

    try{
        response = await get(running.port);
    }finally{
        await stopCli(running.child);
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'served by CLI');
});

test('Integration | CLI blocks dotfiles by default', async function(t){
    const root = fixture(t);
    const running = await startCli(t, root);
    let response;

    try{
        response = await get(running.port, '/.well-known/token');
    }finally{
        await stopCli(running.child);
    }

    assert.equal(response.statusCode, 403);
});

test('Integration | CLI serves dotfiles after explicit opt-in', async function(t){
    const root = fixture(t);
    const running = await startCli(t, root, ['--allow-dotfiles']);
    let response;

    try{
        response = await get(running.port, '/.well-known/token');
    }finally{
        await stopCli(running.child);
    }

    assert.equal(response.statusCode, 200);
    assert.equal(response.body, 'allowed by CLI opt-in');
});

test('Integration | CLI SPA mode serves browser routes without masking missing assets', async function(t){
    const root = fixture(t);
    const running = await startCli(t, root, ['--spa']);
    let navigation;
    let asset;
    let missingAsset;

    try{
        navigation = await get(running.port, '/dashboard/settings', {Accept:'text/html'});
        asset = await get(running.port, '/assets/app.js', {Accept:'text/html'});
        missingAsset = await get(running.port, '/assets/missing.js', {Accept:'text/html'});
    }finally{
        await stopCli(running.child);
    }

    assert.equal(navigation.statusCode, 200);
    assert.equal(navigation.body, 'served by CLI');
    assert.equal(asset.statusCode, 200);
    assert.equal(asset.body, 'console.log("served asset");');
    assert.equal(missingAsset.statusCode, 404);
});

function fixture(t){
    const root = temporaryDirectory(t);

    writeFiles(root, {
        'index.html':'served by CLI',
        'assets/app.js':'console.log("served asset");',
        '.well-known/token':'allowed by CLI opt-in'
    });

    return root;
}

async function startCli(t, root, args = []){
    const childArgs = [cli, '--root', root, '--port', '0', '--timeout', 'false'].concat(args);
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

    child.stdout.on('data', function(chunk){
        output += chunk;
    });
    child.stderr.on('data', function(chunk){
        errors += chunk;
    });
    t.after(async function(){
        await stopCli(child);
    });

    return {
        child:child,
        port:await waitForPort(child, function(){
            return output;
        }, function(){
            return errors;
        })
    };
}

async function stopCli(child){
    if(child.exitCode!==null){
        return;
    }

    await new Promise(function(resolve){
        let settled = false;
        const finish = function(){
            if(settled){
                return;
            }
            settled = true;
            clearTimeout(timeout);
            resolve();
        };
        const timeout = setTimeout(function(){
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

function waitForPort(child, getOutput, getErrors){
    return new Promise(function(resolve, reject){
        const timeout = setTimeout(function(){
            reject(new Error('CLI did not start in time. '+getErrors()));
        }, 5000);

        const inspect = function(){
            const match = /listening at http:\/\/127\.0\.0\.1:(\d+)/.exec(getOutput());
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
                reject(new Error('CLI exited with '+code+'. '+getErrors()));
            }
        });
        inspect();
    });
}

function get(port, requestPath = '/', headers = {}){
    return new Promise(function(resolve, reject){
        http.get(
            {hostname:'127.0.0.1', port:port, path:requestPath, headers:headers},
            function(response){
                const chunks = [];

                response.on('data', function(chunk){
                    chunks.push(chunk);
                });
                response.on('end', function(){
                    resolve({
                        statusCode:response.statusCode,
                        body:Buffer.concat(chunks).toString('utf8')
                    });
                });
            }
        ).on('error', reject);
    });
}
