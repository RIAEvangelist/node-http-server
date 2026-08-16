'use strict';

const fs=require('fs'),
    mimeTypes=require(`${__dirname}/MimeTypes.js`),
    unsafeKeys=new Set(['__proto__','constructor','prototype']),
    nestedKeys=new Set(['server','https','domains','restrictedType']);

class Config{
    constructor(userConfig){
        Object.assign(this,clone(defaultConfigs));
        this.merge(userConfig);
    }

    merge(userConfig){
        if(userConfig!==undefined && userConfig!==null){
            mergeConfig(this,userConfig);
        }
        return this;
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
            if(!isRecord(config.contentType)){
                config.contentType=clone(mimeTypes);
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
