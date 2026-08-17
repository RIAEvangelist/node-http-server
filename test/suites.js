'use strict';

const fs=require('node:fs'),
    path=require('node:path'),
    categories=Object.freeze([
        'unit',
        'functional',
        'integration',
        'regression'
    ]);

function filesFor(category){
    if(!categories.includes(category)){
        throw new Error('Unknown test category '+JSON.stringify(category)+'.');
    }

    const directory=path.join(__dirname,category);

    if(!fs.existsSync(directory)){
        return [];
    }

    return findTests(directory);
}

function filesForCategories(selected=categories){
    if(new Set(selected).size!==selected.length){
        throw new Error('Test categories must be unique.');
    }

    return selected.flatMap(filesFor);
}

function findTests(directory){
    return fs.readdirSync(directory,{withFileTypes:true})
        .sort(function(first,second){
            return first.name.localeCompare(second.name);
        })
        .flatMap(function(entry){
            const filename=path.join(directory,entry.name);

            if(entry.isDirectory()){
                return findTests(filename);
            }

            return entry.isFile() && entry.name.endsWith('.test.js') ? [filename] : [];
        });
}

module.exports={
    categories,
    filesFor,
    filesForCategories
};
