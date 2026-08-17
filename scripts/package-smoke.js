'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const manifest = require(path.join(projectRoot, 'package.json'));
const workspace = fs.mkdtempSync(path.join(os.tmpdir(), 'node-http-server-package-'));
const packed = path.join(workspace, 'packed');
const installed = path.join(workspace, 'installed');
const adjacentNpm = path.join(path.dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npm-cli.js');
const npmCli = process.env.npm_execpath || (fs.existsSync(adjacentNpm) && adjacentNpm);

assert.deepEqual(manifest.dependencies || {}, {}, 'runtime dependencies must stay empty');
assert.deepEqual(
    manifest.devDependencies || {},
    {'vanilla-test':'2.1.1'},
    'vanilla-test must stay the only direct development dependency'
);

function run(command, args, options = {}){
    const result = spawnSync(command, args, {
        cwd:options.cwd || projectRoot,
        encoding:'utf8',
        env:process.env,
        shell:false
    });

    if(result.status !== 0){
        throw new Error(
            command + ' ' + args.join(' ') + ' failed\n' +
            (result.stdout || '') + (result.stderr || '') +
            (result.error ? result.error.stack : '')
        );
    }

    return result.stdout;
}

function runNpm(args, options){
    if(npmCli){
        return run(process.execPath, [npmCli].concat(args), options);
    }

    return run('npm', args, options);
}

fs.mkdirSync(packed);
fs.mkdirSync(installed);

try{
    const packOutput = runNpm([
        'pack',
        '--json',
        '--ignore-scripts',
        '--pack-destination',
        packed
    ]);
    const details = JSON.parse(packOutput)[0];
    const filenames = details.files.map(function(file){
        return file.path.replace(/\\/g, '/');
    });
    const tarball = path.join(packed, details.filename);

    assert.equal(fs.existsSync(tarball), true, 'npm pack did not create a tarball');
    assert.equal(
        filenames.some(function(filename){
            return /^(site|scripts|test|tests|docs)\//.test(filename);
        }),
        false,
        'repository-only scripts, tests, or generated documentation were included in the package'
    );
    const publishedTopLevels = new Set([
        'assets',
        'benchmark',
        'bin',
        'server',
        'CHANGELOG.md',
        'MIGRATION.md',
        'README.md',
        'SECURITY.md',
        'licence',
        'package.json'
    ]);
    assert.deepEqual(
        filenames.filter(function(filename){
            return !publishedTopLevels.has(filename.split('/')[0]);
        }),
        [],
        'the packed package contains a path outside the publish allowlist'
    );
    assert.equal(
        filenames.some(function(filename){
            return /(^|\/)(local-certs|private)(\/|$)|\.(key|pem|p12|pfx)$/i.test(filename);
        }),
        false,
        'private key material was included in the package'
    );

    runNpm([
        'install',
        '--ignore-scripts',
        '--no-audit',
        '--no-fund',
        tarball
    ], {cwd:installed});

    run(process.execPath, [
        '-e',
        [
            "'use strict';",
            "const assert=require('node:assert/strict');",
            "const fs=require('node:fs');",
            "const http=require('node:http');",
            "const os=require('node:os');",
            "const path=require('node:path');",
            "const moduleApi=require('node-http-server');",
            "const Config=require('node-http-server/config');",
            "const mimeTypes=require('node-http-server/mime-types');",
            "assert.equal(moduleApi instanceof moduleApi.Server,true);",
            "assert.equal(moduleApi.Config,Config);",
            "assert.equal(mimeTypes.webp,'image/webp');",
            "const root=fs.mkdtempSync(path.join(os.tmpdir(),'nhs-installed-'));",
            "fs.writeFileSync(path.join(root,'index.html'),'installed');",
            "fs.writeFileSync(path.join(root,'.gitignore'),'hidden');",
            "const first=new moduleApi.Server({root,port:0});",
            "const second=new moduleApi.Server({root,port:0,server:{allowDotfiles:true}});",
            "function listening(server){return server.server.listening?Promise.resolve():new Promise((resolve,reject)=>{server.server.once('listening',resolve);server.server.once('error',reject);});}",
            "function get(server,requestPath='/'){return new Promise((resolve,reject)=>{http.get({hostname:'127.0.0.1',port:server.server.address().port,path:requestPath},response=>{const chunks=[];response.on('data',chunk=>chunks.push(chunk));response.on('end',()=>resolve({status:response.statusCode,body:Buffer.concat(chunks).toString()}));}).on('error',reject);});}",
            "(async()=>{try{assert.equal(first.deploy(),first);assert.equal(second.deploy(),second);await Promise.all([listening(first),listening(second)]);assert.notEqual(first.server.address().port,second.server.address().port);const response=await get(first);assert.deepEqual(response,{status:200,body:'installed'});assert.equal((await get(first,'/.gitignore')).status,403);assert.deepEqual(await get(second,'/.gitignore'),{status:200,body:'hidden'});await Promise.all([first.close(),second.close()]);}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});"
        ].join('')
    ], {cwd:installed});

    run(process.execPath, [
        '--input-type=module',
        '-e',
        [
            "import assert from 'node:assert/strict';",
            "import server,{Server,Config,RefString} from 'node-http-server';",
            "import ConfigSubpath from 'node-http-server/config';",
            "import mimeTypes from 'node-http-server/mime-types';",
            "assert.equal(server instanceof Server,true);",
            "assert.equal(server.Config,Config);",
            "assert.equal(server.RefString,RefString);",
            "assert.equal(Config,ConfigSubpath);",
            "assert.equal(mimeTypes.wasm,'application/wasm');"
        ].join('')
    ], {cwd:installed});

    const installedCli = path.join(installed, 'node_modules', 'node-http-server', 'bin', 'nhs.js');
    const cliHelp = run(process.execPath, [installedCli, '--help'], {cwd:installed});
    const cliVersion = run(process.execPath, [installedCli, '--version'], {cwd:installed});

    assert.match(cliHelp, /--max-body/);
    assert.match(cliHelp, /--timeout/);
    assert.match(cliHelp, /--allow-dotfiles/);
    assert.equal(cliVersion.trim(), manifest.version);

    const installedBenchmark = path.join(
        installed,
        'node_modules',
        'node-http-server',
        'benchmark',
        'run.js'
    );
    const benchmark = JSON.parse(run(
        process.execPath,
        [installedBenchmark, '--smoke', '--json'],
        {cwd:installed}
    ));

    assert.equal(benchmark.benchmark, 'node-http-server');
    assert.equal(benchmark.version, manifest.version);
    assert.equal(benchmark.scenarios.length, 5);
    assert.equal(benchmark.scenarios.every(function(scenario){
        return scenario.requests===8 && scenario.requestsPerSecond>0;
    }), true);

    process.stdout.write('Package smoke test passed: ' + details.filename + '\n');
}finally{
    fs.rmSync(workspace, {recursive:true, force:true});
}
