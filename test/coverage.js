'use strict';

const childProcess=require('node:child_process'),
    fs=require('node:fs'),
    path=require('node:path');

const files=fs.readdirSync(__dirname)
    .filter(function(filename){
        return filename.endsWith('.test.js');
    })
    .sort()
    .map(function(filename){
        return path.join(__dirname,filename);
    });

module.exports=function run(){
    return new Promise(function(resolve,reject){
        const tests=childProcess.spawn(
            process.execPath,
            ['--test'].concat(files),
            {
                cwd:path.resolve(__dirname,'..'),
                stdio:'inherit',
                windowsHide:true
            }
        );

        tests.once('error',reject);
        tests.once('close',function(code,signal){
            if(signal){
                reject(new Error('Node test process stopped with signal '+signal+'.'));
                return;
            }

            const failureCount=code===0 ? 0 : 1;
            resolve(Object.freeze({
                ok:failureCount===0,
                failureCount
            }));
        });
    });
};
