'use strict';
var path = require('path');
var fs = require('fs-extra');
var Promise = require('bluebird');
var fsPromise = {
    ensureDir: Promise.promisify(fs.ensureDir),
    stat: Promise.promisify(fs.stat),
    copy: Promise.promisify(fs.copy),
    readFile: Promise.promisify(fs.readFile)
};

var filesToBeCopied = {};
var counter = 1;

module.exports = function(options, filePath, newFileName) {
    filePath = path.resolve(filePath);
    if (filesToBeCopied[filePath]) {
        return filesToBeCopied[filePath];
    }
    if (!newFileName) {
        newFileName = 'file_' + counter + path.extname(filePath);
        counter = counter + 1;
    }
    newFileName = path.resolve(options.output, 'assets', newFileName);
    filesToBeCopied[filePath] = newFileName;
    return newFileName;
};

module.exports.copyAssets = function(options) {
    return fsPromise.ensureDir(path.resolve(options.output, 'assets')).then(function() {
        return Promise.all(Object.keys(filesToBeCopied).map(function(srcFilePath) {
            return fsPromise.copy(srcFilePath, filesToBeCopied[srcFilePath]).catch(function(e) {
                console.warn(e.message);
                return true;
            });
        })).spread(function() {
            return options;
        });
    });
};