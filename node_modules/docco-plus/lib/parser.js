'use strict';
var path = require('path');
module.exports = function(filePath, options, fileContent) {
    var lines = fileContent.split('\n');
    var docsText = [];
    var codeText = [];
    var sections = [];
    var matchers = options.languages[path.extname(filePath)] || {};
    lines.map(function(line) {
        //a line is either a code or a comment depending on whether it matches the comment matcher
        if (matchers.inlineCommentMatcher && line.match(matchers.inlineCommentMatcher)) {
            if (codeText.length) {
                sections.push({
                    docsText: docsText.join('\n'),
                    codeText: codeText.join('\n')
                });
                docsText = [];
                codeText = [];
            }
            docsText.push(line.replace(matchers.inlineCommentMatcher, ''));
        } else {
            codeText.push(line);
        }
    });
    // push the last section
    sections.push({
        docsText: docsText.join('\n'),
        codeText: codeText.join('\n')
    });

    return sections;
};
