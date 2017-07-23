'use strict';
var Promise = require('bluebird');
var glob = require('glob');
var fs = require('fs-extra');
var path = require('path');
var _ = require('underscore');
var fsPromise = {
    readFile: Promise.promisify(fs.readFile),
    stat: Promise.promisify(fs.stat)
};

module.exports = function(options) {

    // set the template
    options.template = (options.template || require.resolve('./resources/docco-template.jst'));
    fsPromise.readFile(options.template, 'utf8');
    options.template = _.template(fs.readFileSync(options.template).toString());

    // default the output dir
    options.output = (options.output || 'docs');

    // defaulting languages
    options.languages = options.languages ? fs.readJsonSync(options.languages) : require('./resources/languages.json');

    // defaulting the theme
    options.theme = options.theme || 'foghorn';

    // default the highlightjs style
    options.highlightStyle = options.highlightStyle || 'solarized-light';

    Object.keys(options.languages).forEach(function(lang) {
        if (options.languages[lang].inlineComment) {
            options.languages[lang].inlineCommentMatcher = new RegExp('^\\s*' + options.languages[lang].inlineComment);
        } else {
            options.languages[lang].inlineCommentMatcher = new RegExp('^');
        }
    });

    // defaulting the marked options
    options.marked = options.marked || {
            smartypants: true,
            gfm: true
        };

    // expand the list of files to document
    return Promise.all(options.args.map(function(glob1) {
        return Promise.promisify(glob)(glob1);
    })).spread(function() {
        return Array.prototype.concat.apply([], Array.prototype.slice.call(arguments));
    }).then(function(files) {
        options.files = files;
        return Promise.all(options.files.map(function(path) {
            return fsPromise.stat(path);
        }));
    }).spread(function() {
        var args = arguments;
        options.files = options.files.filter(function(filePath, index) {
            return args[index].isFile() && options.languages[path.extname(filePath)];
        });
        return options.files;
    }).then(function() {
        if (!options.files.length) {
            throw new Error('no files to document!!! will not do anything.');
        }
        // default the value for index
        if (!options.index) {
            var indexMatcherRegex = new RegExp('^readme\\.md$', 'i');
            for (var i = 0, j = options.files.length; i < j; i = i + 1) {
                if (indexMatcherRegex.test(options.files[i])) {
                    options.index = options.files[i];
                }
            }
        }
        if (!options.index) {
            options.index = options.files[0];
        }
        return options;
    });
};
