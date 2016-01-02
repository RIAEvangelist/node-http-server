/*jslint node: true */
'use strict';

var http    = require('http'),
    url     = require('url'),
    path    = require('path'),
    fs      = require('fs');

var passedArgs  = process.argv.splice(2),
    argCount    = passedArgs.length,
    args        = {},
    defaults    = {
        port    : 8080,
        root    : process.cwd(),
        domain  : '0.0.0.0',
        index   : 'index.html',
        log     : false
    };

for(var i=0; i<argCount; i++){
    var data=passedArgs[i].split('=');
    args[data[0]]=data[1];
}

if(args.launch=='now'){
    deploy();
}

/**************************************\
 *
 *    These are the valid basic configs
 *    that can be passed when deploying
 *    a server, content types are dynamic
 *    so you can pass whatever you like
 *
 * ************************************/

var defaultConfigs={
    verbose     : (args.verbose=='true')||false,
    port        : args.port||defaults.port,
    root        : args.root||defaults.root,
    domain      : args.domain||defaults.domain,
    log         : false,
    //pass this as config for custom logging
    logFunction : serverLogging,
    domains   : {
        /*******************\
         * domain  : /that/domains/root/dir
         *
         * for sub domains, specify the whole host i.e. "my.sub.domain"
         * you may need to edit your hosts file, cnames or iptable
         * domain or my.domain etc. goes to 127.0.0.1 for local development
         * *****************/
    },
    server      : {
        index   : args.index||defaults.index,
        noCache : (args.noCache=='false')||true
    },
    contentType : {
        html    : 'text/html',
        css     : 'text/css',
        js      : 'text/javascript',
        json    : 'application/json',
        txt     : 'text/plain',
        jpeg    : 'image/jpeg',
        jpg     : 'image/jpeg',
        png     : 'image/png',
        gif     : 'image/gif',
        ico     : 'image/x-icon',
        appcache: 'text/cache-manifest'
    },
    restrictedType: {

    },
    errors:{
        headers : {
            'Content-Type' : 'text/plain'
        },
        404: '404 MIA',
        415: '415 File type not supported',
        403: '403 Access Denied',
        500: '500 {{err}}'
    }
};

function deploy(userConfig, readyCallback){
    console.log('deploying');
    Object.defineProperty(
        this,
        'server',
        {
            value:http.createServer(
                requestRecieved.bind(this)
            ),
            writable:false,
            enumerable:true
        }
    );

    this.config=new this.Config(userConfig);
    this.config.logID='### '+this.config.domain+' server';

    if(this.config.verbose){
        console.log(this.config.logID+' configured with ###\n\n',this.config);
    }

    this.server.listen(
        this.config.port,
        function() {
            if(this.config.verbose){
                console.log(this.config.logID+' listening on port '+this.config.port+' ###\n\n');
            }
            if (readyCallback){
                //passes the current Server class instance for refrence.
                //this allows multiple servers to use the same ready callback if desired
                readyCallback(this);
            }
        }.bind(this)
    );
}

function serveFile(filename,exists,response) {
    if(!exists) {
        if(this.config.verbose)
            console.log(this.config.logID+' 404 ###\n\n');
        this.serve(
            response,
            this.config.errors['404'],
            404,
            this.config.errors.headers
        );
        return;
    }

    var contentType = path.extname(filename).slice(1);

    //Only serve specified file types
    if(!this.config.contentType){
        if(this.config.verbose){
            console.log(this.config.logID+' 415 ###\n\n');
        }

        this.serve(
            response,
            this.config.errors['415'],
            415,
            this.config.errors.headers
        );
        return;
    }

    //default
    if (
        fs.statSync(filename).isDirectory()
    ){
        filename+='/'+this.config.server.index;
    }

    //Do not allow access to restricted file types
    if (
        this.config.restrictedType[contentType]
    ){
        if(this.config.verbose){
            console.log(this.config.logID+' 403 ###\n\n');
        }

        this.serve(
            response,
            this.config.errors['403'],
            403,
            this.config.errors.headers
        );
        return;
    }

    fs.readFile(
        filename,
        'binary',
        function(err, file) {
            if(err) {
                if(this.config.verbose){
                    console.log(this.config.logID+' 500 ###\n\n',err,'\n\n');
                }
                this.serve(
                    response,
                    this.config.errors['500'].replace(/\{\{err\}\}/g,err),
                    500,
                    this.config.errors.headers
                );
                return;
            }

            var headers = {
                'Content-Type' : this.config.contentType[contentType]
            };

            if(this.config.server.noCache){
                headers['Cache-Control']='no-cache, no-store, must-revalidate';
            }

            this.serve(
                response,
                file,
                200,
                headers,
                'binary'
            );

            if(this.config.verbose){
                console.log(this.config.logID+' 200 ###\n\n',headers,'\n\n');
            }

            return;
        }
    );
}

function serve(response,body,status,headers,encoding){
    //defaults to 200
    if(!status){
        status=200;
    }

    //defaults to text/plain
    if(!headers){
        headers={
            'Content-type':'text/plain'
        };

        if(this.config.verbose){
            console.log(this.config.logID+' headers not specified ###\n\nheaders set to:\n',headers,'\n\n');
        }
    }

   //defaults to utf8
    if(!encoding){
        encoding='utf8';

        if(this.config.verbose){
            console.log(this.config.logID+' encoding not specified ###\n\encoding set to:\n',encoding,'\n\n');
        }
    }

    response.writeHead(
        status,
        headers
    );
    response.write(body,encoding);
    response.end();
    return;
}

function requestRecieved(request,response){
    if(this.config.log){
        var logData={
            method  : request.method,
            url     : request.url,
            headers : request.headers
        };

        this.config.logFunction(
            logData
        );
    }
    var uri = url.parse(request.url);
    uri=uri.pathname;
    if (uri=='/'){
        uri='/'+this.config.server.index;
    }

    var hostname= [];

    if (request.headers.host !== undefined){
        hostname = request.headers.host.split(':');
    }

    var root    = this.config.root;

    if(this.config.verbose){
        console.log(this.config.logID+' REQUEST ###\n\n',
            request.headers,'\n',
            uri,'\n\n',
            hostname,'\n\n'
        );
    }

    if(this.config.domain!='0.0.0.0' && hostname.length > 0 && hostname[0]!=this.config.domain){
        if(!this.config.domains[hostname[0]]){
            if(this.config.verbose){
                console.log(this.config.logID+' INVALID HOST ###\n\n');
            }
            this.serveFile(hostname[0],false,response);
            return;
        }
        root=this.config.domains[hostname[0]];
    }

    if(this.config.verbose){
        console.log(this.config.logID+' USING ROOT : '+root+'###\n\n');
    }

    if(uri.slice(-1)=='/')
        uri+=this.config.server.index;

    var filename = path.join(
        root,
        uri
    );

    fs.exists(
        filename,
        function(exists){
            this.serveFile(filename,exists,response);
        }.bind(this)
    );
}

function serverLogging(data){
    fs.exists(
        this.log,
        function(exists){
            data.timestamp=new Date().getTime();

            var JSONData=JSON.stringify(data);
            var method='appendFile';
            if(!exists)
                method='writeFile';

            fs[method](
                this.log,
                JSONData,
                function (err) {
                    if(err)
                        console.log(err);
                }
            );
        }.bind(this)
    );
}

/**************************************\
 *    Config Class.
 * ************************************/

function Config(userConfig){
    Object.defineProperties(
        this,
        {
            verbose     : {
                value:defaultConfigs.verbose,
                enumerable:true,
                writable:true
            },
            port        : {
                value:defaultConfigs.port,
                enumerable:true,
                writable:true
            },
            root        : {
                value:defaultConfigs.root,
                enumerable:true,
                writable:true
            },
            domain      : {
                value:defaultConfigs.domain,
                enumerable:true,
                writable:true
            },
            log         : {
                value:defaultConfigs.log,
                enumerable:true,
                writable:true
            },
            //pass this as config for custom logging
            logFunction : {
                value:defaultConfigs.logFunction,
                enumerable:true,
                writable:true
            },
            domains     : {
                value:defaultConfigs.domains,
                enumerable:true,
                writable:true
            },
            server      : {
                value:defaultConfigs.server,
                enumerable:true,
                writable:true
            },
            contentType : {
                value:defaultConfigs.contentType,
                enumerable:true,
                writable:true
            },
            restrictedType: {
                value:defaultConfigs.restrictedType,
                enumerable:true,
                writable:true
            },
            errors      : {
                value:defaultConfigs.errors,
                enumerable:true,
                writable:true
            }
        }
    )

    if(userConfig){
        for(var k in userConfig){
            this[k]=userConfig[k];
        }
    }

    //this is to allow backwards compatibility with configTemplate
    return this;
}

/*********************
*  SERVER CLASS
*********************/
function Server(){
    Object.defineProperties(
        this,
        {
            deploy:{
                value:deploy,
                writable:false,
                enumerable:true
            },
            serveFile:{
                value:serveFile,
                writable:false,
                enumerable:false
            },
            serve:{
                value:serve,
                writable:false,
                enumerable:false
            },
            //kept for backwards compatibility
            configTemplate  :{
                value:Config,
                writable:true,
                enumerable:true
            },
            Config:{
                value:Config,
                writable:false,
                enumerable:true
            },
            Server:{
                value:Server,
                writable:false,
                enumerable:true
            }
        }
    )
}

module.exports=new Server;
