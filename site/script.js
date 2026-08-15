'use strict';

const form=document.querySelector('#config-form');
const output=document.querySelector('#snippet-output');
const outputPanel=document.querySelector('#generated-panel');
const outputTabs=[...document.querySelectorAll('[data-output-tab]')];
const copyOutputButton=document.querySelector('[data-copy-output]');
const formatLabel=document.querySelector('#snippet-format');
const warningLabel=document.querySelector('#snippet-warning');
const validationLabel=document.querySelector('#config-validation');
const scrollMeter=document.querySelector('.scroll-meter span');
const customLogger=Symbol('custom log function');
const unsafeKeys=new Set(['__proto__','constructor','prototype']);

const fields={
    root:document.querySelector('#config-root'),
    host:document.querySelector('#config-host'),
    port:document.querySelector('#config-port'),
    domain:document.querySelector('#config-domain'),
    domains:document.querySelector('#config-domains'),
    index:document.querySelector('#config-index'),
    log:document.querySelector('#config-log'),
    logBody:document.querySelector('#config-log-body'),
    customLogger:document.querySelector('#config-custom-logger'),
    contentType:document.querySelector('#config-content-type'),
    mimeOverrides:document.querySelector('#config-mime-overrides'),
    restrictedTypes:document.querySelector('#config-restricted-types'),
    errorHeaders:document.querySelector('#config-error-headers'),
    errorBodies:document.querySelector('#config-error-bodies'),
    noCache:document.querySelector('#config-no-cache'),
    compression:document.querySelector('#config-compression'),
    compressionThreshold:document.querySelector('#config-compression-threshold'),
    verbose:document.querySelector('#config-verbose'),
    spa:document.querySelector('#config-spa'),
    spaFile:document.querySelector('#config-spa-file'),
    bodyLimit:document.querySelector('#config-body-limit'),
    maxBody:document.querySelector('#config-max-body'),
    timeout:document.querySelector('#config-timeout'),
    disableTimeout:document.querySelector('#disable-timeout'),
    requestTimeout:document.querySelector('#config-request-timeout'),
    disableRequestTimeout:document.querySelector('#disable-request-timeout'),
    headersTimeout:document.querySelector('#config-headers-timeout'),
    disableHeadersTimeout:document.querySelector('#disable-headers-timeout'),
    keepAliveTimeout:document.querySelector('#config-keep-alive-timeout'),
    disableKeepAliveTimeout:document.querySelector('#disable-keep-alive-timeout'),
    httpsEnabled:document.querySelector('#config-https'),
    httpsFields:document.querySelector('#https-fields'),
    httpsKey:document.querySelector('#config-https-key'),
    httpsCertificate:document.querySelector('#config-https-certificate'),
    httpsCa:document.querySelector('#config-https-ca'),
    httpsPassphrase:document.querySelector('#config-https-passphrase'),
    httpsPort:document.querySelector('#config-https-port'),
    httpsOnly:document.querySelector('#config-https-only')
};

const formats={
    cjs:'CommonJS module',
    esm:'ES module',
    cli:'CLI command',
    json:'Configuration JSON'
};

let activeFormat='cjs';
let validationMessages=[];

function numberValue(input,fallback,max=Number.MAX_SAFE_INTEGER){
    const value=Number(input.value);

    if(!Number.isFinite(value) || value<0){
        return fallback;
    }

    return Math.min(Math.trunc(value),max);
}

function recordValue(input,label){
    const source=input.value.trim() || '{}';

    try{
        const value=JSON.parse(source);

        if(value===null || typeof value!=='object' || Array.isArray(value)){
            throw new TypeError('must be a JSON object');
        }

        for(const key of Object.keys(value)){
            if(unsafeKeys.has(key)){
                throw new TypeError(`contains unsafe key ${JSON.stringify(key)}`);
            }
        }

        input.removeAttribute('aria-invalid');
        return value;
    }catch(error){
        input.setAttribute('aria-invalid','true');
        validationMessages.push(`${label} ${error.message}`);
        return {};
    }
}

function hasKeys(value){
    return Object.keys(value).length>0;
}

function currentConfig(){
    validationMessages=[];

    const spaFile=fields.spaFile.value.trim();
    const domains=recordValue(fields.domains,'Additional domains');
    const restrictedTypes=recordValue(fields.restrictedTypes,'Restricted extensions');
    const errorHeaders=recordValue(fields.errorHeaders,'Error headers');
    const errorBodies=recordValue(fields.errorBodies,'Error bodies');
    const config={
        host:fields.host.value.trim() || '127.0.0.1',
        port:numberValue(fields.port,8080,65535),
        root:fields.root.value.trim() || '.',
        domain:fields.domain.value.trim() || '0.0.0.0',
        verbose:fields.verbose.checked,
        server:{
            index:fields.index.value.trim() || 'index.html',
            noCache:fields.noCache.checked,
            timeout:fields.disableTimeout.checked ? false : numberValue(fields.timeout,30000),
            requestTimeout:fields.disableRequestTimeout.checked ? false : numberValue(fields.requestTimeout,300000),
            headersTimeout:fields.disableHeadersTimeout.checked ? false : numberValue(fields.headersTimeout,60000),
            keepAliveTimeout:fields.disableKeepAliveTimeout.checked ? false : numberValue(fields.keepAliveTimeout,5000),
            maxRequestBodyBytes:fields.bodyLimit.checked ? numberValue(fields.maxBody,1048576) : false,
            compression:fields.compression.checked,
            compressionThreshold:numberValue(fields.compressionThreshold,1024),
            spaFallback:fields.spa.checked ? spaFile || true : false
        }
    };

    if(hasKeys(domains)){
        config.domains=domains;
    }

    const log=fields.log.value.trim();
    if(log){
        config.log=log;
    }

    if(fields.logBody.checked){
        config.logBody=true;
    }

    if(fields.customLogger.checked){
        config.logFunction=customLogger;
    }

    if(fields.contentType.value==='false'){
        config.contentType=false;
    }else{
        const mimeOverrides=recordValue(fields.mimeOverrides,'MIME overrides');
        if(hasKeys(mimeOverrides)){
            config.contentType=mimeOverrides;
        }
    }

    if(hasKeys(restrictedTypes)){
        config.restrictedType=restrictedTypes;
    }

    if(hasKeys(errorHeaders) || hasKeys(errorBodies)){
        config.errors=Object.assign({},errorBodies);
        if(hasKeys(errorHeaders)){
            config.errors.headers=errorHeaders;
        }
    }

    if(fields.httpsEnabled.checked){
        config.https={
            ca:fields.httpsCa.value.trim(),
            privateKey:fields.httpsKey.value.trim(),
            certificate:fields.httpsCertificate.value.trim(),
            passphrase:fields.httpsPassphrase.value || false,
            port:numberValue(fields.httpsPort,443,65535),
            only:fields.httpsOnly.checked
        };
    }

    return config;
}

function javascriptString(value){
    return `'${value.replace(/\\/g,'\\\\').replace(/'/g,"\\'").replace(/\r/g,'\\r').replace(/\n/g,'\\n')}'`;
}

function javascriptKey(key){
    return /^[A-Za-z_$][\w$]*$/.test(key) ? key : javascriptString(key);
}

function javascriptValue(value,depth=0){
    if(value===customLogger){
        const indent='    '.repeat(depth);
        const childIndent='    '.repeat(depth+1);
        return `function logFunction(data){
${childIndent}// Send the request record somewhere else.
${childIndent}return Promise.resolve(data);
${indent}}`;
    }

    if(typeof value==='string'){
        return javascriptString(value);
    }

    if(Array.isArray(value)){
        return `[${value.map(child=>javascriptValue(child,depth)).join(',')}]`;
    }

    if(value===null || typeof value!=='object'){
        return String(value);
    }

    const indent='    '.repeat(depth);
    const childIndent='    '.repeat(depth+1);
    const entries=Object.entries(value).map(
        ([key,child])=>`${childIndent}${javascriptKey(key)}:${javascriptValue(child,depth+1)}`
    );

    return `{
${entries.join(',\n')}
${indent}}`;
}

function moduleSnippet(config,esm){
    const firstLine=esm
        ? "import {Server} from 'node-http-server';"
        : "const {Server}=require('node-http-server');";

    return `${firstLine}

const server=new Server(${javascriptValue(config)});

server.deploy();`;
}

function shellValue(value){
    return JSON.stringify(String(value));
}

function cliSnippet(config){
    const server=config.server;
    const parts=[
        'node-http-server',
        `--root ${shellValue(config.root)}`,
        `--host ${shellValue(config.host)}`,
        `--port ${config.port}`,
        `--domain ${shellValue(config.domain)}`,
        `--index ${shellValue(server.index)}`,
        server.noCache ? '--no-cache' : '--cache',
        `--max-body ${server.maxRequestBodyBytes===false ? 'false' : server.maxRequestBodyBytes}`,
        `--timeout ${server.timeout===false ? 'false' : server.timeout}`,
        `--request-timeout ${server.requestTimeout===false ? 'false' : server.requestTimeout}`,
        `--headers-timeout ${server.headersTimeout===false ? 'false' : server.headersTimeout}`,
        `--keep-alive-timeout ${server.keepAliveTimeout===false ? 'false' : server.keepAliveTimeout}`
    ];

    if(server.spaFallback){
        parts.push(server.spaFallback===true ? '--spa' : `--spa=${shellValue(server.spaFallback)}`);
    }

    if(server.compression){
        parts.push('--compression');
    }

    if(config.log){
        parts.push(`--log ${shellValue(config.log)}`);
    }

    if(config.verbose){
        parts.push('--verbose');
    }

    return parts.join(' ');
}

function generatedSnippet(config,format){
    if(format==='esm'){
        return moduleSnippet(config,true);
    }

    if(format==='cli'){
        return cliSnippet(config);
    }

    if(format==='json'){
        return JSON.stringify(config,null,4);
    }

    return moduleSnippet(config,false);
}

function cliOmitsOptions(config){
    return Boolean(
        config.domains ||
        config.contentType!==undefined ||
        config.restrictedType ||
        config.errors ||
        config.https ||
        config.logBody ||
        config.logFunction ||
        config.server.compressionThreshold!==1024
    );
}

function syncDependentFields(){
    fields.spaFile.disabled=!fields.spa.checked;
    fields.maxBody.disabled=!fields.bodyLimit.checked;
    fields.timeout.disabled=fields.disableTimeout.checked;
    fields.requestTimeout.disabled=fields.disableRequestTimeout.checked;
    fields.headersTimeout.disabled=fields.disableHeadersTimeout.checked;
    fields.keepAliveTimeout.disabled=fields.disableKeepAliveTimeout.checked;
    fields.mimeOverrides.disabled=fields.contentType.value==='false';
    if(fields.mimeOverrides.disabled){
        fields.mimeOverrides.removeAttribute('aria-invalid');
    }

    const httpsDisabled=!fields.httpsEnabled.checked;
    fields.httpsFields.setAttribute('aria-disabled',String(httpsDisabled));
    for(const input of fields.httpsFields.querySelectorAll('input')){
        input.disabled=httpsDisabled;
    }
}

function updateValidation(){
    if(!validationLabel){
        return;
    }

    if(validationMessages.length){
        validationLabel.textContent=`Fix ${validationMessages.join('; ')}.`;
        validationLabel.dataset.warning='true';
        return;
    }

    validationLabel.textContent='JSON fields are valid.';
    delete validationLabel.dataset.warning;
}

function renderSnippet(){
    if(!output){
        return;
    }

    const config=currentConfig();
    output.textContent=generatedSnippet(config,activeFormat);
    formatLabel.textContent=formats[activeFormat];
    outputPanel.setAttribute('aria-labelledby',`tab-${activeFormat}`);
    updateValidation();

    if(validationMessages.length){
        warningLabel.textContent='Fix marked JSON fields';
        warningLabel.dataset.warning='true';
    }else if(activeFormat==='cli' && cliOmitsOptions(config)){
        warningLabel.textContent='Advanced options need the module API';
        warningLabel.dataset.warning='true';
    }else if(activeFormat==='json' && config.logFunction){
        warningLabel.textContent='JSON omits the custom log function';
        warningLabel.dataset.warning='true';
    }else if(activeFormat==='json'){
        warningLabel.textContent='Serializable Config object';
        delete warningLabel.dataset.warning;
    }else{
        warningLabel.textContent='Ready to copy';
        delete warningLabel.dataset.warning;
    }
}

function selectOutputTab(tab){
    activeFormat=tab.dataset.outputTab;

    for(const candidate of outputTabs){
        const selected=candidate===tab;
        candidate.setAttribute('aria-selected',String(selected));
        candidate.tabIndex=selected ? 0 : -1;
    }

    renderSnippet();
}

for(const tab of outputTabs){
    tab.addEventListener('click',()=>selectOutputTab(tab));
    tab.addEventListener(
        'keydown',
        event=>{
            if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)){
                return;
            }

            event.preventDefault();

            const current=outputTabs.indexOf(tab);
            let next=current;

            if(event.key==='ArrowLeft'){
                next=(current-1+outputTabs.length)%outputTabs.length;
            }

            if(event.key==='ArrowRight'){
                next=(current+1)%outputTabs.length;
            }

            if(event.key==='Home'){
                next=0;
            }

            if(event.key==='End'){
                next=outputTabs.length-1;
            }

            selectOutputTab(outputTabs[next]);
            outputTabs[next].focus();
        }
    );
}

async function copyText(value,button){
    const original=button.textContent;

    try{
        await navigator.clipboard.writeText(value);
        button.textContent='Copied';
    }catch(error){
        const textarea=document.createElement('textarea');
        textarea.value=value;
        textarea.setAttribute('readonly','');
        textarea.style.position='fixed';
        textarea.style.opacity='0';
        document.body.append(textarea);
        textarea.select();

        try{
            document.execCommand('copy');
            button.textContent='Copied';
        }catch(copyError){
            button.textContent='Select + copy';
        }

        textarea.remove();
    }

    setTimeout(()=>{
        button.textContent=original;
    },1400);
}

copyOutputButton?.addEventListener(
    'click',
    ()=>copyText(output.textContent,copyOutputButton)
);

for(const button of document.querySelectorAll('[data-copy-text]')){
    button.addEventListener('click',()=>copyText(button.dataset.copyText,button));
}

form?.addEventListener(
    'input',
    ()=>{
        syncDependentFields();
        renderSnippet();
    }
);

form?.addEventListener('submit',event=>event.preventDefault());

form?.addEventListener(
    'reset',
    ()=>setTimeout(
        ()=>{
            syncDependentFields();
            renderSnippet();
        }
    )
);

if(form && output){
    syncDependentFields();
    renderSnippet();
}

const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealItems=[...document.querySelectorAll('.reveal')];

if(reduceMotion || !('IntersectionObserver' in window)){
    for(const item of revealItems){
        item.classList.add('is-visible');
    }
}else{
    const observer=new IntersectionObserver(
        entries=>{
            for(const entry of entries){
                if(!entry.isIntersecting){
                    continue;
                }

                entry.target.classList.add('is-visible');
                observer.unobserve(entry.target);
            }
        },
        {rootMargin:'0px 0px -8%'}
    );

    for(const item of revealItems){
        observer.observe(item);
    }
}

function updateScrollMeter(){
    if(!scrollMeter){
        return;
    }

    const available=document.documentElement.scrollHeight-window.innerHeight;
    const progress=available>0 ? window.scrollY/available : 0;
    scrollMeter.style.transform=`scaleX(${Math.min(1,Math.max(0,progress))})`;
}

window.addEventListener('scroll',updateScrollMeter,{passive:true});
window.addEventListener('resize',updateScrollMeter);
updateScrollMeter();

const year=document.querySelector('[data-year]');

if(year){
    year.textContent=new Date().getFullYear();
}

function openLinkedDetails(){
    if(!window.location.hash){
        return;
    }

    let id;
    try{
        id=decodeURIComponent(window.location.hash.slice(1));
    }catch(error){
        return;
    }

    const target=document.getElementById(id);
    if(target?.tagName==='DETAILS'){
        target.open=true;
    }
}

window.addEventListener('hashchange',openLinkedDetails);
openLinkedDetails();
