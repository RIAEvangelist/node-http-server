'use strict';

const http=require('node:http'),
    https=require('node:https'),
    path=require('node:path'),
    fs=require('node:fs'),
    fsp=require('node:fs/promises'),
    zlib=require('node:zlib'),
    Config=require('./Config.js');

const hiddenHeaders=new Set([
    'authorization',
    'cookie',
    'proxy-authorization',
    'set-cookie',
    'x-api-key'
]);

class Server{
    constructor(userConfig){
        this.config=new this.Config(userConfig);
        this.server=null;
        this.secureServer=null;
        this.lastError=null;
        this._deployed=false;
        this._closing=null;
    }

    deploy(userConfig,readyCallback){
        return deploy.call(this,userConfig,readyCallback);
    }

    close(callback){
        return close.call(this,callback);
    }

    address(){
        if(this.server && this.server.listening){
            return this.server.address();
        }

        if(this.secureServer && this.secureServer.listening){
            return this.secureServer.address();
        }

        return null;
    }

    onRawRequest(request,response,serve){

    }

    onRequest(request,response,serve){

    }

    beforeServe(request,response,body,encoding,serve){

    }

    afterServe(request,response){

    }

    serve(request,response,body,encoding){
        return serve.call(this,request,response,body,encoding);
    }

    serveFile(filename,exists,request,response){
        return serveFile.call(this,filename,exists,request,response);
    }

    get Config(){
        return Config;
    }

    get Server(){
        return Server;
    }

    get RefString(){
        return RefString;
    }
}

function deploy(userConfig,readyCallback=function(){}){
    if(typeof userConfig=='function'){
        readyCallback=userConfig;
        userConfig=undefined;
    }

    if(typeof readyCallback!='function'){
        throw new TypeError('readyCallback must be a function');
    }

    if(this._deployed){
        const error=new Error('This Server instance is already deployed. Create another Server or close this one first.');
        error.code='ERR_SERVER_ALREADY_DEPLOYED';
        throw error;
    }

    if(userConfig){
        this.config.merge(userConfig);
    }

    validateConfig(this.config);

    const requestHandler=function(request,response){
        requestReceived.call(this,request,response).catch(
            function(err){
                handleRequestError.call(this,err,request,response);
            }.bind(this)
        );
    }.bind(this);

    const clientErrorHandler=function(err,socket){
        this.lastError=err;
        if(socket.writable){
            socket.end('HTTP/1.1 400 Bad Request\r\nConnection: close\r\nContent-Length: 0\r\n\r\n');
        }
    }.bind(this);

    let httpsOptions;
    const secureConfigured=this.config.https.privateKey || this.config.https.certificate;

    if(secureConfigured){
        if(!this.config.https.privateKey || !this.config.https.certificate){
            const error=new Error('HTTPS requires both https.privateKey and https.certificate');
            error.code='ERR_HTTPS_CONFIGURATION';
            throw error;
        }

        httpsOptions={
            key:fs.readFileSync(this.config.https.privateKey),
            cert:fs.readFileSync(this.config.https.certificate)
        };

        if(this.config.https.ca){
            httpsOptions.ca=fs.readFileSync(this.config.https.ca);
        }

        if(this.config.https.passphrase){
            httpsOptions.passphrase=this.config.https.passphrase;
        }
    }else if(this.config.https.only){
        const error=new Error('https.only requires a private key and certificate');
        error.code='ERR_HTTPS_CONFIGURATION';
        throw error;
    }

    let nodeServer=null;
    let secureNodeServer=null;

    if(!this.config.https.only){
        nodeServer=http.createServer(requestHandler);
        nodeServer.on('clientError',clientErrorHandler);
        configureNodeServer(nodeServer,this.config.server);
    }

    if(httpsOptions){
        secureNodeServer=https.createServer(httpsOptions,requestHandler);
        secureNodeServer.on('clientError',clientErrorHandler);
        configureNodeServer(secureNodeServer,this.config.server);
    }

    this.server=nodeServer;
    this.secureServer=secureNodeServer;
    this.lastError=null;
    this._deployed=true;

    if(this.server){
        listen.call(this,this.server,this.config.port,readyCallback,false);
    }

    if(this.secureServer){
        listen.call(this,this.secureServer,this.config.https.port,readyCallback,true);
    }

    if(this.config.verbose){
        console.log(`${this.config.domain} server configured`,sanitizedConfig(this.config));
    }

    return this;
}

function listen(nodeServer,port,readyCallback,secure){
    nodeServer.listen(
        port,
        this.config.host,
        function(){
            if(this.config.verbose){
                const address=nodeServer.address();
                const protocol=secure ? 'https' : 'http';
                console.log(`${protocol}://${formatAddress(address.address)}:${address.port}`);
            }

            readyCallback(this,nodeServer);
        }.bind(this)
    );
}

function configureNodeServer(nodeServer,config){
    nodeServer.timeout=timeoutValue(config.timeout);
    nodeServer.requestTimeout=timeoutValue(config.requestTimeout);
    nodeServer.headersTimeout=timeoutValue(config.headersTimeout);
    nodeServer.keepAliveTimeout=timeoutValue(config.keepAliveTimeout);
}

function timeoutValue(value){
    if(value===false || value===null){
        return 0;
    }

    return Number(value);
}

async function close(callback){
    if(callback!==undefined && typeof callback!='function'){
        throw new TypeError('callback must be a function');
    }

    if(this._closing){
        if(callback){
            this._closing.then(()=>callback(),callback);
        }
        return this._closing;
    }

    this._closing=Promise.all([
        closeNodeServer(this.server),
        closeNodeServer(this.secureServer)
    ]).then(
        function(){
            this._deployed=false;
            this._closing=null;
        }.bind(this)
    ).catch(
        function(err){
            this._closing=null;
            throw err;
        }.bind(this)
    );

    if(callback){
        this._closing.then(()=>callback(),callback);
    }

    return this._closing;
}

function closeNodeServer(nodeServer){
    if(!nodeServer || !nodeServer.listening){
        return Promise.resolve();
    }

    if(typeof nodeServer.closeIdleConnections=='function'){
        nodeServer.closeIdleConnections();
    }

    return new Promise(
        function(resolve,reject){
            nodeServer.close(
                function(err){
                    if(err){
                        reject(err);
                        return;
                    }
                    resolve();
                }
            );
        }
    );
}

async function requestReceived(request,response){
    const rawHandled=await this.onRawRequest(
        request,
        response,
        hookServe.bind(this)
    );

    if(rawHandled || response.writableEnded){
        return;
    }

    decorateRequest.call(this,request);
    request.serverRoot=selectRoot.call(this,request.uri.hostname);

    const bodyComplete=await collectBody.call(this,request,response);
    if(!bodyComplete || response.writableEnded){
        return;
    }

    logRequest.call(this,request);

    const handled=await this.onRequest(
        request,
        response,
        hookServe.bind(this)
    );

    if(handled || response.writableEnded){
        return;
    }

    if(request.method!='GET' && request.method!='HEAD'){
        response.setHeader('Allow','GET, HEAD');
        await sendError.call(this,405,request,response);
        return;
    }

    await serveRequestFile.call(this,request,response);
}

function hookServe(request,response,body,encoding){
    return this.serve(request,response,body,encoding).catch(
        function(err){
            handleRequestError.call(this,err,request,response);
        }.bind(this)
    );
}

function decorateRequest(request){
    const encrypted=Boolean(request.socket && request.socket.encrypted);
    const protocol=encrypted ? 'https' : 'http';
    const authority=request.headers.host;

    if(!authority){
        throw new HttpError(400,'Host header required');
    }

    let requestURL;
    try{
        requestURL=new URL(request.url || '/',`${protocol}://${authority}`);
    }catch{
        throw new HttpError(400,'Invalid request URL');
    }

    let pathname;
    try{
        const rawTarget=String(request.url || '/');
        const rawPath=rawTarget.startsWith('/') ? rawTarget.split(/[?#]/,1)[0] : requestURL.pathname;
        pathname=decodeURIComponent(rawPath).replace(/\\/g,'/');
    }catch{
        throw new HttpError(400,'Malformed URL encoding');
    }

    if(pathname.includes('\0')){
        throw new HttpError(400,'Invalid request URL');
    }

    if(process.platform=='win32' && pathname.includes(':')){
        throw new HttpError(403,'Alternate data streams are not served');
    }

    if(pathname.split('/').includes('..')){
        throw new HttpError(403,'Path escapes server root');
    }

    const query=Object.create(null);
    for(const [key,value] of requestURL.searchParams){
        if(Object.hasOwn(query,key)){
            query[key]=Array.isArray(query[key]) ? [...query[key],value] : [query[key],value];
        }else{
            query[key]=value;
        }
    }

    let hostname=requestURL.hostname.toLowerCase();
    if(hostname.startsWith('[') && hostname.endsWith(']')){
        hostname=hostname.slice(1,-1);
    }

    request.originalUrl=request.url;
    request.url=pathname;
    request.uri={
        protocol:protocol,
        host:hostname,
        hostname:hostname,
        port:Number(requestURL.port || (encrypted ? 443 : 80)),
        pathname:pathname,
        path:`${pathname}${requestURL.search}`,
        query:query,
        search:requestURL.search,
        href:requestURL.href
    };
}

function selectRoot(hostname){
    const configuredDomain=String(this.config.domain || '0.0.0.0').toLowerCase();

    if(configuredDomain=='0.0.0.0' || configuredDomain=='*' || configuredDomain==hostname){
        return this.config.root;
    }

    const domainRoot=ownDomain(this.config.domains,hostname);
    if(domainRoot){
        return domainRoot;
    }

    throw new HttpError(421,'Misdirected request');
}

function ownDomain(domains,hostname){
    if(Object.hasOwn(domains,hostname)){
        return domains[hostname];
    }

    for(const key of Object.keys(domains)){
        if(key.toLowerCase()==hostname){
            return domains[key];
        }
    }

    return false;
}

function collectBody(request,response){
    const configuredLimit=this.config.server.maxRequestBodyBytes;
    const limit=configuredLimit===false || configuredLimit===null || Number(configuredLimit)===0 ? false : Number(configuredLimit);

    return new Promise(
        function(resolve,reject){
            const chunks=[];
            let length=0;
            let settled=false;

            const finish=function(value){
                if(settled){
                    return;
                }
                settled=true;
                resolve(value);
            };

            request.on(
                'data',
                function(chunk){
                    if(settled){
                        return;
                    }

                    const buffer=Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
                    length+=buffer.length;

                    if(limit!==false && length>limit){
                        settled=true;
                        sendError.call(this,413,request,response).then(()=>resolve(false),reject);
                        request.resume();
                        return;
                    }

                    chunks.push(buffer);
                }.bind(this)
            );

            request.on(
                'end',
                function(){
                    if(settled){
                        return;
                    }

                    request.bodyBuffer=Buffer.concat(chunks,length);
                    request.body=request.bodyBuffer.toString('utf8');
                    finish(true);
                }
            );

            request.on('aborted',()=>reject(new HttpError(400,'Request aborted')));
            request.on('error',reject);
        }.bind(this)
    );
}

function logRequest(request){
    if(!this.config.log || typeof this.config.logFunction!='function'){
        return;
    }

    const data={
        method:request.method,
        url:request.originalUrl,
        headers:redactHeaders(request.headers)
    };

    if(this.config.logBody){
        data.body=request.body;
    }

    let result;
    try{
        result=this.config.logFunction.call(this.config,data);
    }catch(err){
        this.lastError=err;
        if(this.config.verbose){
            console.error('Unable to write request log',err.message);
        }
        return;
    }

    Promise.resolve(result).catch(
        function(err){
            this.lastError=err;
            if(this.config.verbose){
                console.error('Unable to write request log',err.message);
            }
        }.bind(this)
    );
}

function redactHeaders(headers){
    const output={};

    for(const key of Object.keys(headers)){
        output[key]=hiddenHeaders.has(key.toLowerCase()) ? '[REDACTED]' : headers[key];
    }

    return output;
}

async function serveRequestFile(request,response){
    const root=path.resolve(request.serverRoot);
    let rootReal;

    try{
        rootReal=await fsp.realpath(root);
    }catch(err){
        throw internalError(err);
    }

    let filename=resolveInsideRoot(root,request.url);
    let result=await inspectFile.call(this,rootReal,filename);

    if(result.status==404 && shouldUseSpaFallback.call(this,request)){
        const fallback=this.config.server.spaFallback===true ? this.config.server.index : this.config.server.spaFallback;
        filename=resolveInsideRoot(root,`/${fallback}`);
        result=await inspectFile.call(this,rootReal,filename);
    }

    if(result.status){
        await sendError.call(this,result.status,request,response,result.headers);
        return;
    }

    await serveStaticFile.call(this,result.filename,result.stat,request,response);
}

function resolveInsideRoot(root,requestPath){
    const safePath=String(requestPath || '/').replace(/\\/g,'/').replace(/^\/+/, '');
    const filename=path.resolve(root,safePath || '.');

    if(!isInside(root,filename)){
        throw new HttpError(403,'Path escapes server root');
    }

    return filename;
}

async function inspectFile(rootReal,filename){
    let stat;
    try{
        stat=await fsp.stat(filename);
    }catch(err){
        if(err.code=='ENOENT' || err.code=='ENOTDIR'){
            return {status:404};
        }
        if(err.code=='EACCES' || err.code=='EPERM'){
            return {status:403};
        }
        throw internalError(err);
    }

    if(stat.isDirectory()){
        filename=path.join(filename,this.config.server.index);
        try{
            stat=await fsp.stat(filename);
        }catch(err){
            if(err.code=='ENOENT' || err.code=='ENOTDIR'){
                return {status:404};
            }
            if(err.code=='EACCES' || err.code=='EPERM'){
                return {status:403};
            }
            throw internalError(err);
        }
    }

    if(!stat.isFile()){
        return {status:404};
    }

    let realFilename;
    try{
        realFilename=await fsp.realpath(filename);
    }catch(err){
        throw internalError(err);
    }

    if(!isInside(rootReal,realFilename)){
        return {status:403};
    }

    return {
        filename:realFilename,
        stat:stat
    };
}

function isInside(root,filename){
    const relative=path.relative(root,filename);
    return relative==='' || (!relative.startsWith(`..${path.sep}`) && relative!='..' && !path.isAbsolute(relative));
}

function shouldUseSpaFallback(request){
    if(!this.config.server.spaFallback){
        return false;
    }

    if(path.extname(request.url)){
        return false;
    }

    const accept=String(request.headers.accept || '');
    return !accept || accept.includes('text/html') || accept.includes('*/*');
}

async function serveFile(filename,exists,request,response){
    if(typeof exists!='boolean'){
        response=request;
        request=exists;
        exists=undefined;
    }

    if(exists===false){
        await sendError.call(this,404,request,response);
        return false;
    }

    let stat;
    try{
        stat=await fsp.stat(filename);
    }catch(err){
        if(err.code=='ENOENT' || err.code=='ENOTDIR'){
            await sendError.call(this,404,request,response);
            return false;
        }
        throw err;
    }

    if(stat.isDirectory()){
        filename=path.join(filename,this.config.server.index);
        try{
            stat=await fsp.stat(filename);
        }catch(err){
            if(err.code=='ENOENT' || err.code=='ENOTDIR'){
                await sendError.call(this,404,request,response);
                return false;
            }
            throw err;
        }
    }

    await serveStaticFile.call(this,filename,stat,request,response);
    return true;
}

async function serveStaticFile(filename,stat,request,response){
    const extension=path.extname(filename).slice(1).toLowerCase();

    if(Object.hasOwn(this.config.restrictedType,extension) && this.config.restrictedType[extension]){
        await sendError.call(this,403,request,response);
        return;
    }

    if(this.config.contentType && Object.hasOwn(this.config.contentType,extension) && this.config.contentType[extension]===false){
        await sendError.call(this,415,request,response);
        return;
    }

    const contentType=this.config.contentType && Object.hasOwn(this.config.contentType,extension) && this.config.contentType[extension] || 'application/octet-stream';
    const etag=weakEtag(stat);

    response.setHeader('Content-Type',contentType);
    response.setHeader('X-Content-Type-Options','nosniff');
    response.setHeader('Accept-Ranges','bytes');
    response.setHeader('ETag',etag);
    response.setHeader('Last-Modified',stat.mtime.toUTCString());

    if(this.config.server.noCache){
        response.setHeader('Cache-Control','no-cache, no-store, must-revalidate');
    }

    if(isNotModified(request,stat,etag)){
        response.statusCode=304;
        response.removeHeader('Content-Type');
        response.removeHeader('Content-Length');
        completeResponse.call(this,request,response);
        return;
    }

    let start=0;
    let end=stat.size-1;
    let range;

    if(request.method=='GET' && request.headers.range && ifRangeMatches(request.headers['if-range'],stat,etag)){
        range=parseRange(request.headers.range,stat.size);
        if(range===false){
            await sendError.call(
                this,
                416,
                request,
                response,
                {'Content-Range':`bytes */${stat.size}`}
            );
            return;
        }

        if(range){
            start=range.start;
            end=range.end;
            response.statusCode=206;
            response.setHeader('Content-Range',`bytes ${start}-${end}/${stat.size}`);
        }
    }

    response.statusCode=response.statusCode==206 ? 206 : 200;

    const length=range ? end-start+1 : stat.size;
    const customBeforeServe=this.beforeServe!==Server.prototype.beforeServe;

    if(customBeforeServe){
        const file=await fsp.readFile(filename);
        const body=range ? file.subarray(start,end+1) : file;
        await this.serve(request,response,body,'binary');
        return;
    }

    if(length===0){
        response.setHeader('Content-Length',0);
        completeResponse.call(this,request,response);
        return;
    }

    const compression=selectCompression.call(this,request,contentType,length,Boolean(range));
    if(!compression){
        response.setHeader('Content-Length',length);
    }else{
        response.setHeader('Content-Encoding',compression);
        appendVary(response,'Accept-Encoding');
    }

    if(request.method=='HEAD'){
        completeResponse.call(this,request,response);
        return;
    }

    await streamFile.call(this,filename,start,end,compression,request,response);
}

function weakEtag(stat){
    return `W/"${stat.size.toString(16)}-${Math.trunc(stat.mtimeMs).toString(16)}"`;
}

function isNotModified(request,stat,etag){
    const noneMatch=request.headers['if-none-match'];
    if(noneMatch){
        return noneMatch.split(',').map(value=>value.trim()).includes(etag) || noneMatch.trim()=='*';
    }

    const modifiedSince=request.headers['if-modified-since'];
    if(!modifiedSince){
        return false;
    }

    const time=Date.parse(modifiedSince);
    return Number.isFinite(time) && Math.trunc(stat.mtimeMs/1000)<=Math.trunc(time/1000);
}

function ifRangeMatches(ifRange,stat,etag){
    if(!ifRange){
        return true;
    }

    if(ifRange.startsWith('"') || ifRange.startsWith('W/')){
        return !etag.startsWith('W/') && ifRange==etag;
    }

    const time=Date.parse(ifRange);
    return Number.isFinite(time) && Math.trunc(stat.mtimeMs/1000)<=Math.trunc(time/1000);
}

function parseRange(header,size){
    if(!header.startsWith('bytes=') || header.includes(',')){
        return null;
    }

    const match=/^bytes=(\d*)-(\d*)$/.exec(header);
    if(!match || (!match[1] && !match[2])){
        return null;
    }

    if(size<1){
        return false;
    }

    let start;
    let end;

    if(!match[1]){
        const suffix=Number(match[2]);
        if(!Number.isInteger(suffix) || suffix<=0){
            return false;
        }
        start=Math.max(size-suffix,0);
        end=size-1;
    }else{
        start=Number(match[1]);
        end=match[2] ? Number(match[2]) : size-1;
    }

    if(!Number.isInteger(start) || !Number.isInteger(end) || start<0 || start>=size || end<start){
        return false;
    }

    return {
        start:start,
        end:Math.min(end,size-1)
    };
}

function selectCompression(request,contentType,length,ranged){
    if(!this.config.server.compression || ranged || length<this.config.server.compressionThreshold || !isCompressible(contentType)){
        return false;
    }

    const accepted=parseEncodings(request.headers['accept-encoding']);
    if(accepted.br>0 && accepted.br>=accepted.gzip){
        return 'br';
    }
    if(accepted.gzip>0){
        return 'gzip';
    }

    return false;
}

function isCompressible(contentType){
    return /^text\//.test(contentType) || /(?:javascript|json|xml|svg)/.test(contentType);
}

function parseEncodings(header){
    const output={br:0,gzip:0};

    for(const item of String(header || '').split(',')){
        const [name,...parameters]=item.trim().toLowerCase().split(';');
        let quality=1;
        for(const parameter of parameters){
            const match=/^q=(\d(?:\.\d+)?)$/.exec(parameter.trim());
            if(match){
                quality=Number(match[1]);
            }
        }
        if(Object.hasOwn(output,name)){
            output[name]=quality;
        }
    }

    return output;
}

function appendVary(response,value){
    const current=response.getHeader('Vary');
    if(!current){
        response.setHeader('Vary',value);
        return;
    }

    const values=String(current).split(',').map(item=>item.trim().toLowerCase());
    if(!values.includes(value.toLowerCase())){
        response.setHeader('Vary',`${current}, ${value}`);
    }
}

function streamFile(filename,start,end,compression,request,response){
    return new Promise(
        function(resolve,reject){
            const source=fs.createReadStream(filename,{start:start,end:end});
            const streams=[source];
            let output=source;
            let settled=false;

            if(compression=='br'){
                output=zlib.createBrotliCompress();
                streams.push(output);
                source.pipe(output);
            }else if(compression=='gzip'){
                output=zlib.createGzip();
                streams.push(output);
                source.pipe(output);
            }

            const destroyStreams=function(){
                for(const stream of streams){
                    if(!stream.destroyed){
                        stream.destroy();
                    }
                }
            };

            const finish=function(){
                if(settled){
                    return;
                }
                settled=true;
                invokeAfterServe.call(this,request,response);
                resolve();
            }.bind(this);

            const close=function(){
                if(settled){
                    return;
                }
                settled=true;
                destroyStreams();
                resolve();
            };

            const fail=function(err){
                if(settled){
                    return;
                }
                settled=true;
                output.unpipe(response);
                destroyStreams();

                if(response.headersSent || response.destroyed){
                    this.lastError=err;
                    if(!response.destroyed){
                        response.destroy();
                    }
                    resolve();
                    return;
                }

                reject(err);
            }.bind(this);

            for(const stream of streams){
                stream.once('error',fail);
            }
            response.once('finish',finish);
            response.once('close',close);
            response.once('error',fail);
            output.pipe(response);
        }.bind(this)
    );
}

async function serve(request,response,body='',encoding='utf8'){
    if(response.writableEnded){
        invokeAfterServe.call(this,request,response);
        return;
    }

    if(!response.statusCode){
        response.statusCode=200;
    }

    if(!response.getHeader('Content-Type')){
        response.setHeader('Content-Type','text/plain; charset=utf-8');
    }

    const refBody=new RefString(body);
    const refEncoding=new RefString(encoding);
    const handled=await this.beforeServe(
        request,
        response,
        refBody,
        refEncoding,
        completeServing.bind(this)
    );

    if(handled || response.writableEnded){
        return;
    }

    completeServing.call(this,request,response,refBody,refEncoding);
}

function completeServing(request,response,refBody,refEncoding){
    if(!(refBody instanceof RefString)){
        refBody=new RefString(refBody);
    }

    if(!(refEncoding instanceof RefString)){
        refEncoding=new RefString(refEncoding || 'utf8');
    }

    if(response.writableEnded){
        invokeAfterServe.call(this,request,response);
        return;
    }

    let body=refBody.value;
    if(body===undefined || body===null){
        body='';
    }

    if(!response.hasHeader('Content-Length') && !response.hasHeader('Content-Encoding') && response.statusCode!=204 && response.statusCode!=304){
        response.setHeader('Content-Length',Buffer.isBuffer(body) ? body.length : Buffer.byteLength(String(body),refEncoding.value));
    }

    if(request && request.method=='HEAD'){
        completeResponse.call(this,request,response);
        return;
    }

    response.end(
        body,
        Buffer.isBuffer(body) ? undefined : refEncoding.value,
        function(){
            invokeAfterServe.call(this,request,response);
        }.bind(this)
    );
}

function completeResponse(request,response){
    if(response.writableEnded){
        invokeAfterServe.call(this,request,response);
        return;
    }

    response.end(
        function(){
            invokeAfterServe.call(this,request,response);
        }.bind(this)
    );
}

function invokeAfterServe(request,response){
    if(response.__nodeHttpServerAfterServe){
        return;
    }

    Object.defineProperty(response,'__nodeHttpServerAfterServe',{value:true});

    try{
        const result=this.afterServe(request,response);
        if(result && typeof result.catch=='function'){
            result.catch(err=>{
                this.lastError=err;
                if(this.config.verbose){
                    console.error('afterServe failed',err.message);
                }
            });
        }
    }catch(err){
        this.lastError=err;
        if(this.config.verbose){
            console.error('afterServe failed',err.message);
        }
    }
}

async function sendError(status,request,response,headers={}){
    if(response.writableEnded){
        return;
    }

    for(const header of [
        'Accept-Ranges',
        'Content-Encoding',
        'Content-Length',
        'Content-Range',
        'ETag',
        'Last-Modified'
    ]){
        response.removeHeader(header);
    }

    response.statusCode=status;
    setHeaders(response,this.config.errors.headers);
    setHeaders(response,headers);

    const body=this.config.errors[String(status)] || this.config.errors[status] || `${status} ${http.STATUS_CODES[status] || 'Error'}`;
    await this.serve(request,response,body,'utf8');
}

function setHeaders(response,headers){
    if(!headers){
        return;
    }

    for(const key of Object.keys(headers)){
        response.setHeader(key,headers[key]);
    }
}

function handleRequestError(err,request,response){
    this.lastError=err;

    if(this.config.verbose){
        console.error('Request failed',err);
    }

    if(response.writableEnded){
        return;
    }

    const status=err instanceof HttpError ? err.status : 500;
    sendError.call(this,status,request,response).catch(
        function(sendErr){
            this.lastError=sendErr;
            if(!response.destroyed){
                response.destroy();
            }
        }.bind(this)
    );
}

function internalError(err){
    const output=new HttpError(500,'Internal Server Error');
    output.cause=err;
    return output;
}

function validateConfig(config){
    validatePort(config.port,'port');
    validatePort(config.https.port,'https.port');
    config.port=Number(config.port);
    config.https.port=Number(config.https.port);

    if(typeof config.host!='string' || !config.host){
        throw new TypeError('host must be a non-empty string');
    }

    const root=path.resolve(config.root);
    const stat=fs.statSync(root);
    if(!stat.isDirectory()){
        throw new TypeError('root must be a directory');
    }
    config.root=root;

    for(const key of Object.keys(config.domains)){
        const domainRoot=path.resolve(config.domains[key]);
        const domainStat=fs.statSync(domainRoot);
        if(!domainStat.isDirectory()){
            throw new TypeError(`domains.${key} must be a directory`);
        }
        config.domains[key]=domainRoot;
    }

    validateNonNegative(config.server.timeout,'server.timeout');
    validateNonNegative(config.server.requestTimeout,'server.requestTimeout');
    validateNonNegative(config.server.headersTimeout,'server.headersTimeout');
    validateNonNegative(config.server.keepAliveTimeout,'server.keepAliveTimeout');
    validateNonNegative(config.server.maxRequestBodyBytes,'server.maxRequestBodyBytes',true);
    validateNonNegative(config.server.compressionThreshold,'server.compressionThreshold');
}

function validatePort(value,name){
    const port=Number(value);
    if(!Number.isInteger(port) || port<0 || port>65535){
        throw new RangeError(`${name} must be an integer from 0 to 65535`);
    }
}

function validateNonNegative(value,name,allowFalse=false){
    if((allowFalse && value===false) || value===null){
        return;
    }

    const number=Number(value);
    if(!Number.isFinite(number) || number<0){
        throw new RangeError(`${name} must be a non-negative number${allowFalse ? ' or false' : ''}`);
    }
}

function sanitizedConfig(config){
    return {
        verbose:config.verbose,
        host:config.host,
        port:config.port,
        root:config.root,
        domain:config.domain,
        log:Boolean(config.log),
        domains:Object.keys(config.domains),
        server:{
            index:config.server.index,
            noCache:config.server.noCache,
            timeout:config.server.timeout,
            requestTimeout:config.server.requestTimeout,
            headersTimeout:config.server.headersTimeout,
            keepAliveTimeout:config.server.keepAliveTimeout,
            maxRequestBodyBytes:config.server.maxRequestBodyBytes,
            compression:config.server.compression,
            compressionThreshold:config.server.compressionThreshold,
            spaFallback:config.server.spaFallback
        },
        https:{
            ca:Boolean(config.https.ca),
            privateKey:Boolean(config.https.privateKey),
            certificate:Boolean(config.https.certificate),
            passphrase:Boolean(config.https.passphrase),
            port:config.https.port,
            only:config.https.only
        }
    };
}

function formatAddress(address){
    return address.includes(':') ? `[${address}]` : address;
}

class RefString{
    constructor(value){
        this._string=value;
    }

    get value(){
        return this._string;
    }

    set value(value){
        this._string=value;
    }
}

class HttpError extends Error{
    constructor(status,message){
        super(message);
        this.name='HttpError';
        this.status=status;
        this.code=`ERR_HTTP_${status}`;
    }
}

const server=new Server;

module.exports=server;
