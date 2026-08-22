'use strict';

const fs=require('fs'),
    mimeTypes=require(`${__dirname}/MimeTypes.js`),
    unsafeKeys=new Set(['__proto__','constructor','prototype']),
    nestedKeys=new Set(['server','https','domains','restrictedType']),
    pendingContentTypes=Symbol('pendingContentTypes'),
    unmaterializedContentTypes=Symbol('unmaterializedContentTypes'),
    routingState=Symbol('routingState'),
    lazyContentTypeDescriptor=Object.freeze({
        configurable:true,
        enumerable:true,
        get:materializeContentTypes,
        set:replaceContentTypes
    }),
    trackedDomainsHandler=Object.freeze({
        set:setTrackedDomain,
        deleteProperty:deleteTrackedDomain,
        defineProperty:defineTrackedDomain
    });

class Config{
    constructor(userConfig){
        assignDefaults(this);
        this.merge(userConfig);
        installRoutingTracking(this);
    }

    merge(userConfig){
        if(userConfig!==undefined && userConfig!==null){
            mergeConfig(this,userConfig);
        }
        return this;
    }

    contentTypeFor(extension){
        if(isLazyContentTypes(this)){
            const state=this[pendingContentTypes];
            if(state.value!==unmaterializedContentTypes){
                const contentTypes=state.value;
                if(!contentTypes || !Object.hasOwn(contentTypes,extension)){
                    return undefined;
                }
                return contentTypes[extension];
            }

            const overlays=state.overlays;
            if(overlays && Object.hasOwn(overlays,extension)){
                return overlays[extension];
            }
            return Object.hasOwn(mimeTypes,extension) ? mimeTypes[extension] : undefined;
        }

        const contentTypes=this.contentType;
        if(!contentTypes || !Object.hasOwn(contentTypes,extension)){
            return undefined;
        }
        return contentTypes[extension];
    }

    routingVersion(){
        const state=routingStateFor(this);

        if(!Object.is(state.root,this.root)){
            state.root=this.root;
            incrementRoutingVersion(state);
        }
        if(!Object.is(state.domain,this.domain)){
            state.domain=this.domain;
            incrementRoutingVersion(state);
        }
        if(state.domains!==this.domains){
            trackDomains(this,state,true);
            incrementRoutingVersion(state);
        }else if(domainsAliasChanged(state)){
            incrementRoutingVersion(state);
        }

        return state.version;
    }

    static get defaults(){
        return clone(defaultConfigs);
    }

    static get mimeTypes(){
        return clone(mimeTypes);
    }
}

const defaultConfigs=deepFreeze({
    verbose     : false,
    port        : 8080,
    root        : process.cwd(),
    host        : '127.0.0.1',
    domain      : '0.0.0.0',
    log         : false,
    logBody     : false,
    logFunction : serverLogging,
    domains     : {},
    server      : {
        index               : 'index.html',
        noCache             : true,
        allowDotfiles       : false,
        timeout             : 30000,
        requestTimeout      : 300000,
        headersTimeout      : 60000,
        keepAliveTimeout    : 5000,
        maxRequestBodyBytes : false,
        compression         : false,
        compressionThreshold: 1024,
        brotliQuality       : 4,
        spaFallback         : false
    },
    https       : {
        ca          : '',
        privateKey  : '',
        certificate : '',
        passphrase  : false,
        port        : 443,
        only        : false
    },
    contentType : mimeTypes,
    restrictedType: {},
    errors      : {
        headers : {
            'Content-Type'           : 'text/plain; charset=utf-8',
            'X-Content-Type-Options' : 'nosniff'
        },
        400 : '400 Bad Request',
        403 : '403 Forbidden',
        404 : '404 Not Found',
        405 : '405 Method Not Allowed',
        413 : '413 Payload Too Large',
        415 : '415 Unsupported Media Type',
        416 : '416 Range Not Satisfiable',
        421 : '421 Misdirected Request',
        500 : '500 Internal Server Error'
    }
});

function assignDefaults(config){
    for(const key of Object.keys(defaultConfigs)){
        if(key==='contentType'){
            installLazyContentTypes(config);
            continue;
        }
        config[key]=clone(defaultConfigs[key]);
    }
}

function installRoutingTracking(config){
    const state=routingStateFor(config);

    state.root=config.root;
    state.domain=config.domain;
    if(state.domains!==config.domains){
        trackDomains(config,state,false);
    }
}

function routingStateFor(config){
    let state=config[routingState];

    if(state && state.owner===config){
        return state;
    }

    state={
        owner:config,
        version:state && Number.isSafeInteger(state.version) ? state.version : 0,
        root:config.root,
        domain:config.domain,
        domains:null
    };
    Object.defineProperty(
        config,
        routingState,
        {
            value:state,
            writable:true
        }
    );
    return state;
}

function trackDomains(config,state,watchAlias){
    const domains=config.domains;

    if(!isRecord(domains)){
        state.domains=domains;
        clearDomainsAlias(state);
        return;
    }

    const handler=Object.create(trackedDomainsHandler);

    handler.state=state;
    const tracked=new Proxy(domains,handler);
    const descriptor=Object.getOwnPropertyDescriptor(config,'domains');

    if(watchAlias){
        state.domainsAlias=domains;
        state.domainsAliasSnapshot=snapshotDomains(domains);
    }else{
        clearDomainsAlias(state);
    }

    if(descriptor && Object.hasOwn(descriptor,'value') && descriptor.writable){
        config.domains=tracked;
        state.domains=tracked;
        return;
    }

    state.domains=domains;
}

function setTrackedDomain(target,key,value){
    const changed=Reflect.set(target,key,value,target);

    if(changed && typeof key==='string'){
        incrementRoutingVersion(this.state);
        refreshDomainsAliasSnapshot(this.state,target);
    }
    return changed;
}

function deleteTrackedDomain(target,key){
    const present=Object.hasOwn(target,key),
        changed=Reflect.deleteProperty(target,key);

    if(changed && present && typeof key==='string'){
        incrementRoutingVersion(this.state);
        refreshDomainsAliasSnapshot(this.state,target);
    }
    return changed;
}

function defineTrackedDomain(target,key,descriptor){
    const changed=Reflect.defineProperty(target,key,descriptor);

    if(changed && typeof key==='string'){
        incrementRoutingVersion(this.state);
        refreshDomainsAliasSnapshot(this.state,target);
    }
    return changed;
}

function clearDomainsAlias(state){
    if(Object.hasOwn(state,'domainsAlias')){
        delete state.domainsAlias;
        delete state.domainsAliasSnapshot;
    }
}

function refreshDomainsAliasSnapshot(state,target){
    if(state.domainsAlias===target){
        state.domainsAliasSnapshot=snapshotDomains(target);
    }
}

function domainsAliasChanged(state){
    const domains=state.domainsAlias;
    if(!domains){
        return false;
    }

    const keys=Object.keys(domains),
        snapshot=state.domainsAliasSnapshot;
    let changed=!snapshot || keys.length!==snapshot.keys.length;

    if(!changed){
        for(let index=0;index<keys.length;index++){
            const key=keys[index];
            if(key!==snapshot.keys[index] || !Object.is(domains[key],snapshot.values[key])){
                changed=true;
                break;
            }
        }
    }

    if(changed){
        state.domainsAliasSnapshot=snapshotDomains(domains,keys);
    }
    return changed;
}

function snapshotDomains(domains,keys=Object.keys(domains)){
    const values=Object.create(null);

    for(const key of keys){
        values[key]=domains[key];
    }

    return {keys:keys,values:values};
}

function incrementRoutingVersion(state){
    state.version=state.version==Number.MAX_SAFE_INTEGER ? 0 : state.version+1;
}

function installLazyContentTypes(config){
    let state=Object.hasOwn(config,pendingContentTypes) ? config[pendingContentTypes] : null;

    if(state && state.owner===config){
        state.overlays=null;
        state.value=unmaterializedContentTypes;
    }else{
        state={
            owner:config,
            overlays:null,
            value:unmaterializedContentTypes
        };
        Object.defineProperty(
            config,
            pendingContentTypes,
            {
                value:state,
                writable:true
            }
        );
    }

    Object.defineProperty(config,'contentType',lazyContentTypeDescriptor);
}

function isLazyContentTypes(config){
    const descriptor=Object.getOwnPropertyDescriptor(config,'contentType');

    return isLazyContentTypeDescriptor(descriptor);
}

function isLazyContentTypeDescriptor(descriptor){
    return Boolean(
        descriptor &&
        descriptor.get===materializeContentTypes &&
        descriptor.set===replaceContentTypes
    );
}

function inheritedLazyContentTypeOwner(config){
    let current=Object.getPrototypeOf(config);

    while(current){
        const descriptor=Object.getOwnPropertyDescriptor(current,'contentType');

        if(descriptor){
            return isLazyContentTypeDescriptor(descriptor) ? current : null;
        }
        current=Object.getPrototypeOf(current);
    }
    return null;
}

function contentTypeStateFor(config){
    const previous=Object.hasOwn(config,pendingContentTypes) ? config[pendingContentTypes] : null;

    if(previous && previous.owner===config){
        return previous;
    }
    if(previous && !Object.getOwnPropertyDescriptor(config,pendingContentTypes).writable){
        return previous;
    }

    const state={
        owner:config,
        overlays:copyContentTypeOverlays(previous && previous.overlays),
        value:previous ? previous.value : unmaterializedContentTypes
    };
    Object.defineProperty(
        config,
        pendingContentTypes,
        {
            value:state,
            writable:true
        }
    );
    return state;
}

function copyContentTypeOverlays(overlays){
    if(!overlays){
        return null;
    }

    const result=Object.create(null);

    for(const key of Object.keys(overlays)){
        result[key]=overlays[key];
    }
    return result;
}

function materializeContentTypes(){
    const descriptor=Object.getOwnPropertyDescriptor(this,'contentType');

    if(!isLazyContentTypeDescriptor(descriptor)){
        const owner=inheritedLazyContentTypeOwner(this);

        if(owner){
            return materializeContentTypes.call(owner);
        }
        throw new TypeError('contentType getter called on an incompatible object.');
    }

    const state=contentTypeStateFor(this);
    if(state.value!==unmaterializedContentTypes){
        return state.value;
    }

    const result=clone(mimeTypes);
    const overlays=state.overlays;

    if(overlays){
        for(const key of Object.keys(overlays)){
            result[key]=overlays[key];
        }
    }

    if(descriptor.configurable){
        Object.defineProperty(
            this,
            'contentType',
            {
                configurable:true,
                enumerable:true,
                value:result,
                writable:true
            }
        );
    }else{
        state.value=result;
    }
    state.overlays=null;
    return result;
}

function replaceContentTypes(value){
    const descriptor=Object.getOwnPropertyDescriptor(this,'contentType');

    if(!isLazyContentTypeDescriptor(descriptor)){
        const owner=inheritedLazyContentTypeOwner(this);

        if(!owner){
            throw new TypeError('contentType setter called on an incompatible object.');
        }
        if(Object.isFrozen(owner)){
            throw new TypeError('Cannot assign to read only property contentType.');
        }
        Object.defineProperty(
            this,
            'contentType',
            {
                configurable:true,
                enumerable:true,
                value:value,
                writable:true
            }
        );
        return;
    }

    if(descriptor.configurable){
        Object.defineProperty(
            this,
            'contentType',
            {
                configurable:true,
                enumerable:true,
                value:value,
                writable:true
            }
        );
        return;
    }

    const state=contentTypeStateFor(this);

    if(Object.isFrozen(this) || state.owner!==this){
        throw new TypeError('Cannot assign to read only property contentType.');
    }

    state.overlays=null;
    state.value=value;
}

function mergeLazyContentTypes(config,source){
    const state=contentTypeStateFor(config);

    if(state.value!==unmaterializedContentTypes){
        if(isRecord(state.value)){
            mergeObject(state.value,source,'config.contentType');
            return;
        }
        state.value=unmaterializedContentTypes;
        state.overlays=null;
    }

    let overlays=state.overlays;

    if(!overlays){
        overlays=Object.create(null);
        state.overlays=overlays;
    }

    mergeObject(overlays,source,'config.contentType');
}

function mergeConfig(config,userConfig){
    if(!isObject(userConfig)){
        throw new TypeError('config must be an object.');
    }

    for(const key of Object.keys(userConfig)){
        requireSafeKey(key,'config');
        const value=userConfig[key];

        if(key==='contentType'){
            if(value===false){
                config.contentType=false;
                continue;
            }
            requireRecord(value,'config.contentType');
            if(isLazyContentTypes(config)){
                mergeLazyContentTypes(config,value);
                continue;
            }
            if(!isRecord(config.contentType)){
                installLazyContentTypes(config);
                mergeLazyContentTypes(config,value);
                continue;
            }
            mergeObject(config.contentType,value,'config.contentType');
            continue;
        }

        if(key==='errors'){
            requireRecord(value,'config.errors');
            if(!isRecord(config.errors)){
                config.errors=clone(defaultConfigs.errors);
            }
            mergeErrors(config.errors,value);
            continue;
        }

        if(nestedKeys.has(key)){
            requireRecord(value,`config.${key}`);
            if(!isRecord(config[key])){
                config[key]=clone(defaultConfigs[key]);
            }
            mergeObject(config[key],value,`config.${key}`);
            continue;
        }

        config[key]=clone(value);
    }
}

function mergeErrors(errors,userErrors){
    for(const key of Object.keys(userErrors)){
        requireSafeKey(key,'config.errors');

        if(key==='headers'){
            requireRecord(userErrors.headers,'config.errors.headers');
            if(!isRecord(errors.headers)){
                errors.headers=clone(defaultConfigs.errors.headers);
            }
            mergeObject(errors.headers,userErrors.headers,'config.errors.headers');
            continue;
        }

        errors[key]=clone(userErrors[key]);
    }
}

function mergeObject(target,source,label){
    for(const key of Object.keys(source)){
        requireSafeKey(key,label);
        target[key]=clone(source[key]);
    }
}

function clone(value){
    if(Array.isArray(value)){
        return value.map(clone);
    }

    if(!isRecord(value)){
        return value;
    }

    const result={};
    for(const key of Object.keys(value)){
        requireSafeKey(key,'configuration value');
        result[key]=clone(value[key]);
    }
    return result;
}

function deepFreeze(value){
    if(!isRecord(value) && !Array.isArray(value)){
        return value;
    }

    for(const child of Object.values(value)){
        deepFreeze(child);
    }
    return Object.freeze(value);
}

function isObject(value){
    return value!==null && typeof value==='object' && !Array.isArray(value);
}

function isRecord(value){
    if(!isObject(value)){
        return false;
    }

    const prototype=Object.getPrototypeOf(value);
    return prototype===Object.prototype || prototype===null;
}

function requireRecord(value,label){
    if(!isRecord(value)){
        throw new TypeError(`${label} must be an object.`);
    }
}

function requireSafeKey(key,label){
    if(unsafeKeys.has(key)){
        throw new TypeError(`${label} contains unsafe key ${JSON.stringify(key)}.`);
    }
}

function serverLogging(data){
    let JSONData;

    try{
        JSONData=`${JSON.stringify(Object.assign({},data,{timestamp:Date.now()}))}\n`;
    }catch(err){
        return Promise.reject(err);
    }

    return new Promise(
        function(resolve,reject){
            try{
                fs.appendFile(this.log,JSONData,'utf8',function logWritten(err){
                    if(err){
                        reject(err);
                        return;
                    }
                    resolve();
                });
            }catch(err){
                reject(err);
            }
        }.bind(this)
    );
}

module.exports=Config;
