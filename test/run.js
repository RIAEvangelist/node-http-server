'use strict';

const childProcess=require('node:child_process'),
    path=require('node:path'),
    suites=require('./suites.js'),
    selected=process.argv.slice(2),
    categories=selected.length ? selected : suites.categories;

let files;

try{
    files=suites.filesForCategories(categories);
}catch(error){
    console.error(error.message);
    process.exitCode=1;
    return;
}

if(!files.length){
    console.error('No tests found for '+categories.join(', ')+'.');
    process.exitCode=1;
    return;
}

const tests=childProcess.spawn(
    process.execPath,
    ['--test'].concat(files),
    {
        cwd:path.resolve(__dirname,'..'),
        stdio:'inherit',
        windowsHide:true
    }
);

tests.once('error',function(error){
    console.error(error);
    process.exitCode=1;
});

tests.once('exit',function(code,signal){
    if(signal){
        console.error('Test process stopped with signal '+signal+'.');
        process.exitCode=1;
        return;
    }

    process.exitCode=code;
});
