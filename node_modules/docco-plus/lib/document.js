'use strict';
var fs = require('fs-extra');
var Promise = require('bluebird');
var parser = require('./parser');
var formatter = require('./formatter');
var writer = require('./writer');
var normalizer = require('./normalizer');
var fileResolver = require('./file-resolver');
var _ = require('underscore');
var path = require('path');
var fsPromise = {
    readFile: Promise.promisify(fs.readFile),
    outputFile: Promise.promisify(fs.outputFile)
};

// ### copy resource files
var copyAssets = function(options) {
    options.resources = {
        css: [],
        js: []
    };
    // - copy template css file
    options.resources.css.push(fileResolver(
        options,
        require.resolve('./resources/docco-template.css')
    ));
    // - copy jquery js file
    options.resources.js.push(fileResolver(
        options,
        require.resolve('jquery/dist/jquery.min.js')
    ));
    // - copy jstree distribution js
    options.resources.js.push(fileResolver(
        options,
        require.resolve('jstree/dist/jstree.js')
    ));
    // - copy jstree search plugin js
    options.resources.js.push(fileResolver(
        options,
        require.resolve('jstree/src/jstree.search.js')
    ));
    // - copy jstree distribution css
    options.resources.css.push(fileResolver(
        options,
        require.resolve('jstree/dist/themes/default-dark/style.min.css')
    ));
    // - copy jstree distribution images
    options.resources.css.push(fileResolver(
        options,
        require.resolve('jstree/dist/themes/default-dark/32px.png'),
        '32px.png'
    ));
    options.resources.css.push(fileResolver(
        options,
        require.resolve('jstree/dist/themes/default-dark/40px.png'),
        '40px.png'
    ));
    options.resources.css.push(fileResolver(
        options,
        require.resolve('jstree/dist/themes/default-dark/throbber.gif'),
        'throbber.gif'
    ));
    // - copy bootstrap js file
    options.resources.js.push(fileResolver(
        options,
        require.resolve('./resources/bootstrap.js')
    ));
    // - copy highlightjs style
    options.resources.css.push(fileResolver(
        options,
        require.resolve('highlight.js/styles/' + options.highlightStyle + '.css')
    ));
    // - copy markdown style
    options.resources.css.push(fileResolver(
        options,
        require.resolve('./resources/gfm.css')
    ));
    // -copy config.css
    if (options.css) {
        options.resources.css.push(fileResolver(
            options,
            options.css
        ));
    }
    return options;
};

var createIndex = function(options) {
    var template = _.template(fs.readFileSync(require.resolve('./resources/index.jst')).toString());
    var html = template(options);
    return fsPromise.outputFile(path.join(options.output, 'index.html'), html).then(function() {
        return options;
    });
};

// ### document the source files
var document = function(options) {
    return Promise.all(
        options.files.map(function(oneFile) {
            return fsPromise.readFile(oneFile, 'utf8').then(
                parser.bind(null, oneFile, options)
            ).then(
                formatter.bind(null, oneFile, options)
            ).then(
                writer.bind(null, oneFile, options)
            );
        })
    ).spread(function() {
        return options;
    });
};

module.exports = function(options, callback) {
    callback = callback || function() {
            return;
        };
    // normalize the options options
    return normalizer(options).then(
        // copy assets
        copyAssets
    ).then(
        // generate the documentation
        document
    ).then(
        createIndex
    ).then(
        fileResolver.copyAssets
    ).then(
        // call the callback with success
        callback.bind({}, null)
    ).catch(
        // in case of exception call the callback with failure
        callback.bind({})
    );
};