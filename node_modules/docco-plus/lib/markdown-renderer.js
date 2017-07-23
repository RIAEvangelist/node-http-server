'use strict';
var marked = require('marked');
var path = require('path');
var fileResolver = require('./file-resolver');
var isAbsolute = function(filePath) {
    return /^(?:\/|[a-z]+:\/\/|#)/.test(filePath);
};

module.exports = function(srcPath, options) {
    var renderer = new marked.Renderer();
    renderer.link = function(href, title, text) {
        if (!isAbsolute(href)) {
            if (options.files.indexOf(path.join(path.dirname(srcPath), href)) !== -1) {
                href = href + '.html';
            } else {
                href = fileResolver(options, path.resolve(path.dirname(srcPath), href));
                href = path.relative(path.join(options.output, path.dirname(srcPath)), href);
            }
        }
        return marked.Renderer.prototype.link.call(this, href, title, text);
    };
    renderer.image = function(href, title, text) {
        if (!isAbsolute(href)) {
            href = fileResolver(options, path.resolve(path.dirname(srcPath), href));
            href = path.relative(path.join(options.output, path.dirname(srcPath)), href);
        }
        return marked.Renderer.prototype.image.call(this, href, title, text);
    };
    return renderer;
};