'use strict';

const fs=require('node:fs'),
    path=require('node:path');

const root=path.resolve(__dirname,'..'),
    summaryFile=path.join(root,'coverage','node','coverage-summary.json'),
    badgeDirectories=Object.freeze([
        path.join(root,'badges'),
        path.join(root,'coverage','badges')
    ]),
    metrics=Object.freeze({
        lines:'line coverage',
        functions:'function coverage',
        branches:'branch coverage'
    });

if(!inside(root,summaryFile) || badgeDirectories.some(function(directory){
    return !inside(root,directory);
})){
    throw new Error('Coverage files must stay inside the project root.');
}

let summary;
try{
    summary=JSON.parse(fs.readFileSync(summaryFile,'utf8'));
}catch(error){
    throw new Error('Unable to read vanilla-test coverage summary.',{cause:error});
}

if(!summary || typeof summary!='object' || !summary.total){
    throw new TypeError('vanilla-test coverage summary must contain total metrics.');
}

for(const directory of badgeDirectories){
    fs.mkdirSync(directory,{recursive:true});
}

const results=[];
for(const metric of Object.keys(metrics)){
    const percent=coveragePercent(summary.total[metric],metric),
        message=formatPercent(percent)+'%',
        badge={
            schemaVersion:1,
            label:metrics[metric],
            message,
            color:coverageColor(percent)
        };

    for(const directory of badgeDirectories){
        fs.writeFileSync(
            path.join(directory,metric+'.json'),
            JSON.stringify(badge,null,2)+'\n'
        );
    }
    results.push(metric+' '+message);
}

process.stdout.write('Coverage badges: '+results.join(', ')+'\n');

function inside(directory,target){
    const relative=path.relative(directory,target);
    return relative==='' || (!relative.startsWith('..'+path.sep) && relative!='..' && !path.isAbsolute(relative));
}

function coveragePercent(record,metric){
    if(!record || typeof record!='object'){
        throw new TypeError('Coverage summary is missing '+metric+'.');
    }

    if(!Number.isSafeInteger(record.total) || record.total<0 ||
        !Number.isSafeInteger(record.covered) || record.covered<0 ||
        record.covered>record.total){
        throw new TypeError('Coverage summary contains invalid '+metric+' totals.');
    }

    if(typeof record.pct!='number' || !Number.isFinite(record.pct) ||
        record.pct<0 || record.pct>100){
        throw new TypeError('Coverage summary contains an invalid '+metric+' percentage.');
    }

    return record.pct;
}

function formatPercent(percent){
    return percent.toFixed(2).replace(/\.?0+$/,'');
}

function coverageColor(percent){
    if(percent===100){
        return 'brightgreen';
    }
    if(percent>=90){
        return 'green';
    }
    if(percent>=80){
        return 'yellowgreen';
    }
    if(percent>=70){
        return 'yellow';
    }
    if(percent>=60){
        return 'orange';
    }
    return 'red';
}
