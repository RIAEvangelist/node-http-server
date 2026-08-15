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
        let output='';
        const tests=childProcess.spawn(
            process.execPath,
            ['--test','--test-reporter=tap'].concat(files),
            {
                cwd:path.resolve(__dirname,'..'),
                stdio:['ignore','pipe','inherit'],
                windowsHide:true
            }
        );

        tests.stdout.setEncoding('utf8');
        tests.stdout.on('data',function(chunk){
            output+=chunk;
            process.stdout.write(chunk);
        });
        tests.once('error',reject);
        tests.once('close',function(code,signal){
            if(signal){
                reject(new Error('Node test process stopped with signal '+signal+'.'));
                return;
            }

            let result;
            try{
                result=parseTap(output);
            }catch(error){
                reject(error);
                return;
            }

            if((code===0)!==(result.failureCount===0)){
                reject(new Error('Node test exit status did not match its TAP summary.'));
                return;
            }

            resolve(Object.freeze({
                ok:result.failureCount===0,
                failureCount:result.failureCount,
                total:result.total,
                passed:Object.freeze(result.passed),
                failed:Object.freeze(result.failed)
            }));
        });
    });
};

function parseTap(output){
    const total=summaryCount(output,'tests'),
        failureCount=summaryCount(output,'fail'),
        passed=[],
        failed=[],
        result=/^(ok|not ok) \d+ - (.+)\r?$/gm;
    let match;

    while((match=result.exec(output))){
        let description=match[2],
            directive=description.match(/\s+#\s+(SKIP|TODO)\b/i);

        if(directive){
            description=description.slice(0,directive.index)+' ['+directive[1].toLowerCase()+']';
        }

        (match[1]==='ok' ? passed : failed).push(description);
    }

    return {total,failureCount,passed,failed};
}

function summaryCount(output,label){
    const match=output.match(new RegExp('^# '+label+' (\\d+)\\r?$','m'));

    if(!match){
        throw new Error('Node TAP output is missing its '+label+' summary.');
    }

    return Number(match[1]);
}
