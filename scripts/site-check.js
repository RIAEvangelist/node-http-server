'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const projectRoot = path.resolve(__dirname, '..');
const siteRoot = path.join(projectRoot, 'site');
const runtimeBoundary = 'node-http-server is Node.js-only; native-browser execution, import maps, and browser-bundler conformance are not applicable.';
const requiredPages = [
    'index.html',
    'guide.html',
    'why.html',
    'cli.html',
    'api.html',
    'configuration.html',
    'https.html',
    'examples.html',
    'playground.html',
    'testing.html',
    'performance.html',
    'benchmarks.html',
    'operations.html',
    'resources.html'
];
const navigationPages = requiredPages.filter(function(filename){
    return !['guide.html', 'resources.html'].includes(filename);
});
const voidElements = new Set([
    'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input',
    'link', 'meta', 'param', 'source', 'track', 'wbr'
]);
const ariaReferences = new Set([
    'aria-controls',
    'aria-describedby',
    'aria-details',
    'aria-labelledby',
    'aria-owns'
]);
const failures = [];
const documents = new Map();

function report(filename, message){
    failures.push(filename + ': ' + message);
}

function parseAttributes(source){
    const values = new Map();
    const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    let match;

    while((match = pattern.exec(source))){
        values.set(
            match[1].toLowerCase(),
            match[2] === undefined
                ? match[3] === undefined
                    ? match[4] === undefined ? '' : match[4]
                    : match[3]
                : match[2]
        );
    }

    return values;
}

function parseTags(source){
    const tags = [];
    const pattern = /<([a-z][\w:-]*)\b([^>]*)>/gi;
    let match;

    while((match = pattern.exec(source))){
        tags.push({
            name:match[1].toLowerCase(),
            attributes:parseAttributes(match[2]),
            index:match.index,
            source:match[0]
        });
    }

    return tags;
}

function checkMarkup(filename, source){
    if(!/^<!doctype html>/i.test(source.trimStart())){
        report(filename, 'missing HTML doctype');
    }

    const clean = source.replace(/<!--[\s\S]*?-->/g, '');
    const stack = [];
    const pattern = /<\/?([a-z][\w:-]*)\b[^>]*>/gi;
    let match;

    while((match = pattern.exec(clean))){
        const name = match[1].toLowerCase();

        if(voidElements.has(name) || /\/>$/.test(match[0])){
            continue;
        }

        if(match[0][1] !== '/'){
            stack.push(name);
            continue;
        }

        const open = stack.pop();
        if(open !== name){
            report(filename, 'HTML tag mismatch: expected </' + (open || 'none') + '> before </' + name + '>');
            return;
        }
    }

    if(stack.length){
        report(filename, 'unclosed HTML tag <' + stack[stack.length - 1] + '>');
    }
}

function isInsideLabel(source, index){
    return source.lastIndexOf('<label', index) > source.lastIndexOf('</label', index);
}

function checkDocument(filename, source){
    const tags = parseTags(source);
    const ids = [];

    checkMarkup(filename, source);
    if(/__[A-Z][A-Z0-9_]*__/.test(source)){
        report(filename, 'contains an unresolved result placeholder');
    }
    const loadsPlaygroundScript = source.includes('src="./playground.js"');
    if(filename === 'playground.html' && !loadsPlaygroundScript){
        report(filename, 'must load playground.js');
    }
    if(filename === 'playground.html' &&
        source.indexOf('src="./script.js"') > source.indexOf('src="./playground.js"')){
        report(filename, 'must load shared script.js before playground.js');
    }
    if(filename !== 'playground.html' && loadsPlaygroundScript){
        report(filename, 'loads the playground-only JavaScript');
    }

    for(const tag of tags){
        if(tag.attributes.has('id')){
            ids.push(tag.attributes.get('id'));
        }
    }

    const idSet = new Set(ids);
    documents.set(path.join(siteRoot, filename), {filename, source, tags, idSet});

    for(const id of idSet){
        if(ids.filter(function(value){ return value === id; }).length > 1){
            report(filename, 'duplicate id #' + id);
        }
    }

    if((source.match(/<h1\b/gi) || []).length !== 1){
        report(filename, 'must contain exactly one h1');
    }

    if(!idSet.has('main')){
        report(filename, 'missing main landmark target #main');
    }

    for(const tag of tags){
        const attributes = tag.attributes;

        if(tag.name === 'img'){
            if(!attributes.has('alt') || !attributes.get('alt').trim()){
                report(filename, 'image is missing useful alt text: ' + tag.source);
            }
        }

        if(tag.name === 'label' && attributes.has('for') && !idSet.has(attributes.get('for'))){
            report(filename, 'label points to missing #' + attributes.get('for'));
        }

        if(['input', 'select', 'textarea'].includes(tag.name) && attributes.has('id')){
            const id = attributes.get('id');
            const hasExplicitLabel = tags.some(function(candidate){
                return candidate.name === 'label' && candidate.attributes.get('for') === id;
            });

            if(!hasExplicitLabel && !isInsideLabel(source, tag.index)){
                report(filename, tag.name + ' #' + id + ' has no label');
            }
        }

        for(const name of ariaReferences){
            if(!attributes.has(name)){
                continue;
            }

            for(const id of attributes.get(name).trim().split(/\s+/)){
                if(id && !idSet.has(id)){
                    report(filename, name + ' points to missing #' + id);
                }
            }
        }

        if(attributes.has('data-copy-target') && !idSet.has(attributes.get('data-copy-target'))){
            report(filename, 'copy button points to missing #' + attributes.get('data-copy-target'));
        }
    }

    const nav = tags.filter(function(tag){
        return tag.name === 'nav' && tag.attributes.get('aria-label') === 'Documentation';
    });

    if(nav.length !== 1){
        report(filename, 'must contain one Documentation navigation landmark');
    }

    const current = tags.filter(function(tag){
        return tag.name === 'a' && tag.attributes.has('aria-current');
    });

    if(current.length !== 1){
        report(filename, 'must expose exactly one current documentation location');
    }else{
        const href = current[0].attributes.get('href');
        const value = current[0].attributes.get('aria-current');
        const expectedHref = filename === 'resources.html'
            ? './operations.html'
            : './' + filename;
        const expectedValue = filename === 'resources.html' ? 'location' : 'page';

        if(href !== expectedHref || value !== expectedValue){
            report(
                filename,
                'current location must be ' + expectedHref + ' with aria-current="' + expectedValue + '"'
            );
        }
    }

    const navMatch = source.match(/<nav\b[^>]*aria-label="Documentation"[^>]*>([\s\S]*?)<\/nav>/i);
    if(navMatch){
        for(const page of navigationPages){
            if(!navMatch[1].includes('href="./' + page + '"')){
                report(filename, 'Documentation navigation is missing ' + page);
            }
        }
    }
}

function localTarget(document, reference){
    if(/^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(reference)){
        return;
    }

    const hashIndex = reference.indexOf('#');
    const fragmentText = hashIndex === -1 ? '' : reference.slice(hashIndex + 1);
    const beforeHash = hashIndex === -1 ? reference : reference.slice(0, hashIndex);
    const pathText = beforeHash.split('?')[0];
    const resolved = pathText
        ? path.resolve(path.dirname(path.join(siteRoot, document.filename)), pathText)
        : path.join(siteRoot, document.filename);
    const projectFallback = path.resolve(projectRoot, pathText.replace(/^\.\//, ''));
    const generatedCoverage = /^\.\/coverage\//.test(pathText);

    if(pathText && !fs.existsSync(resolved) && !fs.existsSync(projectFallback) && !generatedCoverage){
        report(document.filename, 'local target does not exist: ' + reference);
        return;
    }

    if(!fragmentText){
        return;
    }

    let fragment;
    try{
        fragment = decodeURIComponent(fragmentText);
    }catch(error){
        report(document.filename, 'fragment is not valid URL encoding: ' + reference);
        return;
    }

    const target = documents.get(resolved);
    if(!target || !target.idSet.has(fragment)){
        report(document.filename, 'fragment does not exist: ' + reference);
    }
}

function checkLinks(){
    for(const document of documents.values()){
        for(const tag of document.tags){
            for(const name of ['href', 'src']){
                if(tag.attributes.has(name)){
                    localTarget(document, tag.attributes.get(name));
                }
            }
        }
    }
}

function checkCss(){
    const filename = 'site/styles.css';
    const source = fs.readFileSync(path.join(projectRoot, filename), 'utf8');
    const pairs = new Map([['}', '{'], [')', '('], [']', '[']]);
    const opening = new Set(pairs.values());
    const stack = [];
    let quote = '';
    let comment = false;

    for(let index = 0; index < source.length; index += 1){
        const character = source[index];
        const next = source[index + 1];

        if(comment){
            if(character === '*' && next === '/'){
                comment = false;
                index += 1;
            }
            continue;
        }

        if(!quote && character === '/' && next === '*'){
            comment = true;
            index += 1;
            continue;
        }

        if(quote){
            if(character === '\\'){
                index += 1;
            }else if(character === quote){
                quote = '';
            }
            continue;
        }

        if(character === '"' || character === "'"){
            quote = character;
        }else if(opening.has(character)){
            stack.push(character);
        }else if(pairs.has(character) && stack.pop() !== pairs.get(character)){
            report(filename, 'unbalanced delimiter ' + character);
            return;
        }
    }

    if(comment || quote || stack.length){
        report(filename, 'contains an unclosed comment, string, or delimiter');
    }
}

function checkJavaScript(){
    for(const filename of ['script.js', 'playground.js', 'benchmark-results.js']){
        const absoluteFilename = path.join(siteRoot, filename);
        const result = spawnSync(process.execPath, ['--check', absoluteFilename], {
            cwd:projectRoot,
            encoding:'utf8',
            shell:false
        });

        if(result.status !== 0){
            report(
                'site/' + filename,
                (result.stderr || result.stdout || 'syntax check failed').trim()
            );
        }
    }
}

function checkProtocolPositioning(){
    const checks = [
        {
            filename:'README.md',
            source:fs.readFileSync(path.join(projectRoot, 'README.md'), 'utf8'),
            phrases:['HTTP and HTTPS static serving', 'protocols-HTTP_%2B_HTTPS', 'HTTP and HTTPS modes']
        },
        {
            filename:'site/index.html',
            source:fs.readFileSync(path.join(siteRoot, 'index.html'), 'utf8'),
            phrases:['Native HTTP + HTTPS', 'Start an HTTP or HTTPS static server.']
        },
        {
            filename:'site/cli.html',
            source:fs.readFileSync(path.join(siteRoot, 'cli.html'), 'utf8'),
            phrases:['Command line · HTTP listener', 'Use CommonJS or ESM for HTTPS-only or paired HTTP + HTTPS listeners.']
        },
        {
            filename:'site/https.html',
            source:fs.readFileSync(path.join(siteRoot, 'https.html'), 'utf8'),
            phrases:['Native Node HTTPS · zero runtime dependencies', 'node:https', 'HTTPS only', 'HTTP + HTTPS']
        }
    ];

    for(const check of checks){
        for(const phrase of check.phrases){
            if(!check.source.includes(phrase)){
                report(check.filename, 'missing protocol-positioning phrase: ' + phrase);
            }
        }
    }
}

function checkRuntimeBoundary(){
    const manifestFilename = path.join(projectRoot, 'package.json');
    const manifest = JSON.parse(fs.readFileSync(manifestFilename, 'utf8'));

    if(manifest.description !== 'A lightweight, secure, zero-runtime-dependency HTTP and HTTPS static server for Node.js only.'){
        report('package.json', 'description must state the Node.js-only runtime');
    }
    if(!manifest.engines || manifest.engines.node !== '>=22.12.0'){
        report('package.json', 'must retain the exact supported Node.js engine boundary');
    }
    if(!Array.isArray(manifest.keywords) || !manifest.keywords.includes('node-only')){
        report('package.json', 'must retain the node-only keyword');
    }
    if(Object.prototype.hasOwnProperty.call(manifest, 'browser')){
        report('package.json', 'must not declare a browser entry for the Node.js-only package');
    }
    if(JSON.stringify(manifest.exports || {}).includes('"browser"')){
        report('package.json', 'must not declare a browser export condition');
    }
    for(const field of [
        'dependencies',
        'optionalDependencies',
        'peerDependencies',
        'bundledDependencies',
        'bundleDependencies'
    ]){
        const value = manifest[field];
        const hasEntries = Array.isArray(value)
            ? value.length !== 0
            : value && typeof value === 'object'
                ? Object.keys(value).length !== 0
                : Boolean(value);
        if(hasEntries){
            report('package.json', field + ' requires a fresh dependency-boundary conformance audit');
        }
    }

    const runtimeDocuments = [
        'README.md',
        'MIGRATION.md',
        'CHANGELOG.md',
        'SECURITY.md',
        'example/readme.md',
        'benchmark/README.md'
    ];

    for(const filename of runtimeDocuments){
        const source = fs.readFileSync(path.join(projectRoot, filename), 'utf8');
        if(!source.includes(runtimeBoundary)){
            report(filename, 'missing canonical Node.js-only runtime boundary');
        }
    }

    for(const filename of requiredPages){
        const source = fs.readFileSync(path.join(siteRoot, filename), 'utf8');
        if(!source.includes(runtimeBoundary)){
            report(filename, 'missing canonical Node.js-only runtime boundary');
        }
        if((source.match(/data-runtime-boundary/g) || []).length !== 1){
            report(filename, 'must expose exactly one durable runtime-boundary marker');
        }
    }

    const focusedChecks = [
        {
            filename:'site/index.html',
            phrases:['CommonJS and ESM are Node.js module entry points, not browser entry points.']
        },
        {
            filename:'site/api.html',
            phrases:['Node.js module entries:', 'they are not native-browser imports and do not use an import map.']
        },
        {
            filename:'site/examples.html',
            phrases:['Each example is a Node.js program', 'not browser execution of node-http-server.']
        },
        {
            filename:'site/playground.html',
            phrases:['The generator runs in the browser, but node-http-server does not.', 'Browser bundles, native browser ESM, import maps']
        },
        {
            filename:'site/playground.js',
            phrases:['Node.js ESM module']
        },
        {
            filename:'site/testing.html',
            phrases:['Native-browser conformance:', 'no browser entry, browser-targeted bundle, import map, or Chrome runtime job', 'Given the Node CLI is serving an SPA']
        }
    ];

    for(const check of focusedChecks){
        const source = fs.readFileSync(path.join(projectRoot, check.filename), 'utf8');
        for(const phrase of check.phrases){
            if(!source.includes(phrase)){
                report(check.filename, 'missing runtime-boundary evidence phrase: ' + phrase);
            }
        }
    }

    const serverSource = fs.readFileSync(path.join(projectRoot, 'server', 'Server.js'), 'utf8');
    for(const builtin of ['node:http', 'node:https', 'node:path', 'node:fs', 'node:fs/promises', 'node:zlib']){
        if(!serverSource.includes(builtin)){
            report('server/Server.js', 'Node.js-only evidence changed; re-audit missing builtin ' + builtin);
        }
    }
}

if(!fs.existsSync(siteRoot)){
    throw new Error('site directory does not exist');
}

const pages = fs.readdirSync(siteRoot).filter(function(filename){
    return filename.endsWith('.html');
}).sort();

for(const filename of requiredPages){
    if(!pages.includes(filename)){
        report(filename, 'required documentation page is missing');
    }
}

for(const filename of pages){
    checkDocument(filename, fs.readFileSync(path.join(siteRoot, filename), 'utf8'));
}

checkLinks();
checkCss();
checkJavaScript();
checkProtocolPositioning();
checkRuntimeBoundary();

if(failures.length){
    process.stderr.write(failures.sort().join('\n') + '\n');
    process.exitCode = 1;
}else{
    process.stdout.write(
        'Site check passed: ' + pages.length +
        ' HTML pages, links, fragments, IDs, labels, ARIA, images, navigation, CSS, JavaScript, and the Node.js-only runtime boundary.\n'
    );
}
