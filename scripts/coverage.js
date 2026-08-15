'use strict';

const childProcess=require('node:child_process'),
    fs=require('node:fs'),
    path=require('node:path');

const root=path.resolve(__dirname,'..'),
    outputDirectory=path.join(root,'coverage'),
    rawDirectory=path.join(outputDirectory,'v8'),
    lcovFile=path.join(outputDirectory,'lcov.info');

if(path.relative(root,outputDirectory).startsWith('..')){
    throw new Error('Coverage output must stay inside the project root.');
}

fs.rmSync(outputDirectory,{recursive:true,force:true});
fs.mkdirSync(rawDirectory,{recursive:true});

const result=childProcess.spawnSync(
    process.execPath,
    [
        '--test',
        '--experimental-test-coverage',
        '--test-coverage-include=server/*.js',
        '--test-coverage-lines=90',
        '--test-coverage-functions=90',
        '--test-coverage-branches=85',
        '--test-reporter=spec',
        '--test-reporter=lcov',
        '--test-reporter-destination=stdout',
        `--test-reporter-destination=${lcovFile}`,
        'test/*.test.js'
    ],
    {
        cwd:root,
        env:{...process.env,NODE_V8_COVERAGE:rawDirectory},
        stdio:'inherit'
    }
);

if(result.error){
    throw result.error;
}

if(fs.existsSync(lcovFile)){
    const summary=summarizeLcov(fs.readFileSync(lcovFile,'utf8'));
    fs.writeFileSync(
        path.join(outputDirectory,'summary.json'),
        `${JSON.stringify(summary,null,2)}\n`
    );
    fs.writeFileSync(
        path.join(outputDirectory,'index.html'),
        coveragePage(summary)
    );
}

process.exitCode=result.status===null ? 1 : result.status;

function summarizeLcov(source){
    const totals={
        lines:{found:0,hit:0},
        functions:{found:0,hit:0},
        branches:{found:0,hit:0}
    };

    for(const line of source.split(/\r?\n/)){
        addTotal(totals.lines,line,'LF:','found');
        addTotal(totals.lines,line,'LH:','hit');
        addTotal(totals.functions,line,'FNF:','found');
        addTotal(totals.functions,line,'FNH:','hit');
        addTotal(totals.branches,line,'BRF:','found');
        addTotal(totals.branches,line,'BRH:','hit');
    }

    for(const key of Object.keys(totals)){
        const value=totals[key];
        value.percent=value.found ? Number((value.hit/value.found*100).toFixed(2)) : 100;
    }

    return {
        generatedAt:new Date().toISOString(),
        provider:'Node.js native V8 coverage',
        thresholds:{lines:90,functions:90,branches:85},
        ...totals
    };
}

function addTotal(total,line,prefix,key){
    if(line.startsWith(prefix)){
        total[key]+=Number(line.slice(prefix.length));
    }
}

function coveragePage(summary){
    const rows=['lines','functions','branches'].map(
        key=>`<tr><th>${key}</th><td>${summary[key].hit} / ${summary[key].found}</td><td>${summary[key].percent}%</td><td>${summary.thresholds[key]}%</td></tr>`
    ).join('');

    return `<!doctype html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>node-http-server coverage</title>
    <style>
        :root{color-scheme:dark;background:#08131d;color:#e8f4f2;font-family:ui-monospace,SFMono-Regular,Consolas,monospace}
        body{max-width:760px;margin:0 auto;padding:8vw 24px}h1{font-size:clamp(2rem,7vw,4rem);margin:0 0 .4em;color:#6ee7c7}
        p{color:#a8c3c0}table{width:100%;border-collapse:collapse;margin-top:2rem;background:#102532;border:1px solid #274454}
        th,td{text-align:left;padding:14px;border-bottom:1px solid #274454}th{text-transform:capitalize;color:#6ee7c7}
        code{color:#f6c177}
    </style>
</head>
<body>
    <h1>V8 coverage</h1>
    <p>Collected directly by Node.js. No coverage package is installed.</p>
    <table><thead><tr><th>scope</th><th>covered</th><th>result</th><th>gate</th></tr></thead><tbody>${rows}</tbody></table>
    <p>Generated <code>${summary.generatedAt}</code></p>
</body>
</html>
`;
}
