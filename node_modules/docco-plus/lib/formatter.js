'use strict';
var marked = require('marked');
var path = require('path');
var highlightjs = require('highlight.js');
var escape = require('escape-html');
var markdownRenderer = require('./markdown-renderer');
module.exports = function(filePath, options, sections) {
    var markedOptions = options.marked;
    var language = options.languages[path.extname(filePath)] || {
            name: path.extname(filePath).replace(/^\./, '')
        };
    marked.setOptions(markedOptions);
    marked.setOptions({
        highlight: function(code, lang) {
            lang = (lang || language.name);
            if (highlightjs.getLanguage(lang)) {
                return highlightjs.highlight(lang, code).value;
            } else {
                console.warn('docco: couldn\'t highlight code block with unknown language "' + lang + '" in ' + code);
                return code;
            }
        }
    });
    var mdRenderer = markdownRenderer(filePath, options);
    var results = [];
    var highlightedText;
    for (var i = 0, len = sections.length; i < len; i = i + 1) {
        var section = sections[i];
        if (section.codeText.trim()) {
            try {
                highlightedText = highlightjs.highlight(
                    language.name,
                    section.codeText
                ).value;
            } catch (e) {
                highlightedText = escape(section.codeText);
            }
            section.codeHtml = '<div class="highlight"><pre>' +
                highlightedText.replace(
                    /\s+$/,
                    ''
                ) +
                '</pre></div>';
        }
        if (section.docsText.trim()) {
            section.docsHtml = marked(section.docsText, {
                renderer: mdRenderer
            });
        }
        results.push(section);
    }
    return results;
};
