'use strict';
var path = require('path');
var fs = require('fs-extra');
var Promise = require('bluebird');
var fsPromise = {
    outputFile: Promise.promisify(fs.outputFile)
};
module.exports = function(oneFile, options, sections) {
    var destination = path.join(options.output, oneFile + '.html');
    var sectionUlClass;
    if (sections.length !== 1) {
        sectionUlClass = '';
    } else if (!sections[0].docsHtml) {
        sectionUlClass = 'codeOnly';

    } else if (!sections[0].codeHtml) {
        sectionUlClass = 'docsOnly';

    }

    var fileTree = {};
    // create the file tree here
    options.files.forEach(function(onePath) {
        var splits = onePath.split('/'), thisDir;
        for (var i = 0, j = splits.length - 1; i < j; i = i + 1) {
            thisDir = splits.slice(0, i + 1).join('/');
            if (!fileTree[thisDir]) {
                fileTree[thisDir] = {
                    id: thisDir,
                    text: splits[i],
                    icon: 'jstree-folder',
                    parent: (i === 0 ? '#' : splits.slice(0, i).join('/')),
                    'a_attr': {
                        href: path.relative(
                            path.dirname(destination),
                            path.normalize(path.join(options.output, thisDir))
                        ) || '.'
                    },
                    state: {
                        opened: (oneFile.indexOf(thisDir) === 0)
                    }
                };
            }
        }
        fileTree[onePath] = {
            id: onePath,
            text: splits[i],
            icon: 'jstree-file',
            parent: (i === 0 ? '#' : splits.slice(0, i).join('/')),
            'a_attr': {
                href: path.relative(
                    path.dirname(destination),
                    path.normalize(path.join(options.output, onePath + '.html'))
                )
            },
            state: {
                selected: (oneFile === onePath)
            }
        };
    });

    var fileArray = Object.keys(fileTree).map(function(key) {
        return fileTree[key];
    }).sort();

    var title = path.basename(oneFile).replace(/\.[a-zA-Z]*?$/, '');

    if (sections.length && sections[0].docsHtml) {
        var h1Tag = sections[0].docsHtml.match(/<h1.*?>(.*?)<\/h1>/);
        if (h1Tag) {
            title = h1Tag[1];
            sections[0].docsHtml = sections[0].docsHtml.replace(/<h1.*?>(.*?)<\/h1>/, '');
        }
    }

    var html = options.template({
        options: options,
        sections: sections,
        srcPath: oneFile,
        title: title,
        baseName: path.basename(oneFile),
        path: path,
        fileArray: fileArray,
        destination: destination,
        sectionUlClass: sectionUlClass
    });
    return fsPromise.outputFile(destination, html);
};