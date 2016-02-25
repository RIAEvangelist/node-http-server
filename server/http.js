'use strict';

const http = require('http'),
    url = require('url'),
    path = require('path'),
    fs = require('fs'),
    Config = require(`${__dirname}/Config.js`);

const passedArgs = process.argv.splice(2),
    argCount = passedArgs.length,
    args = {};

for(let i=0; i<argCount; i++){
    const data=passedArgs[i].split('=');
    args[data[0]]=data[1];
}

if(args.launch=='now'){
    const server=new Server;
    server.deploy();
}

function deploy(userConfig, readyCallback){
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
    this.config.logID=`### ${this.config.domain} server`;

    if(this.config.verbose){
        console.log(
            `${this.config.logID} configured with ###\n\n`,this.config);
    }

    this.server.timeout=this.config.server.timeout;
    this.server.listen(
        this.config.port,
        function() {
            if(this.config.verbose){
                console.log(`${this.config.logID} listening on port ${this.config.port} ###\n\n`);
            }
            if (readyCallback){
                //passes the current Server class instance for refrence.
                //this allows multiple servers to use the same ready callback if desired
                readyCallback(this);
            }
        }.bind(this)
    );
}

function setHeaders(response,headers){
    const keys=Object.keys(headers);
    for(const i in keys){
        response.setHeader(
            keys[i],
            headers[keys[i]]
        );
    }
}

function serveFile(filename,exists,request,response) {
    if(!exists) {
        if(this.config.verbose){
            console.log(`${this.config.logID} 404 ###\n\n`);
        }

        if(!response){
            return false;
        }

        response.statusCode=404;
        setHeaders(response, this.config.errors.headers);

        this.serve(
            request,
            response,
            this.config.errors['404']
        );
        return;
    }

    const contentType = path.extname(filename).slice(1);

    //Only serve specified file types
    if(!this.config.contentType[contentType]){
        if(this.config.verbose){
            console.log(`${this.config.logID} 415 ###\n\n`);
        }

        response.statusCode=415;
        setHeaders(response, this.config.errors.headers);

        this.serve(
            request,
            response,
            this.config.errors['415']
        );
        return;
    }

    //default
    if (
        fs.statSync(filename).isDirectory()
    ){
        filename+=`/${this.config.server.index}`;
    }

    //Do not allow access to restricted file types
    if (
        this.config.restrictedType[contentType]
    ){
        if(this.config.verbose){
            console.log(`${this.config.logID} 403 ###\n\n`);
        }

        response.statusCode=403;
        setHeaders(response, this.config.errors.headers);

        this.serve(
            request,
            response,
            this.config.errors['403']
        );
        return;
    }

    fs.readFile(
        filename,
        'binary',
        function(err, file) {
            if(err) {
                if(this.config.verbose){
                    console.log(`${this.config.logID} 500 ###\n\n`,err,'\n\n');
                }

                response.statusCode=500;
                setHeaders(response, this.config.errors.headers);

                this.serve(
                    request,
                    response,
                    this.config.errors['500'].replace(/\{\{err\}\}/g,err)
                );
                return;
            }

            response.setHeader(
                'Content-Type',
                this.config.contentType[contentType]
            );

            if(this.config.server.noCache){
                response.setHeader(
                    'Cache-Control',
                    'no-cache, no-store, must-revalidate'
                );
            }

            response.statusCode=200;

            this.serve(
                request,
                response,
                file,
                'binary'
            );

            if(this.config.verbose){
                console.log(`${this.config.logID} 200 ###\n\n`);
            }

            return;
        }.bind(this)
    );
}

function serve(request,response,body,encoding){
    //defaults to 200
    if(!response.statusCode){
        response.statusCode=200;
    }

    //defaults to text/plain
    if(!response.getHeader('Content-Type')){
        response.setHeader(
            'Content-Type',
            'text/plain'
        );

        if(this.config.verbose){
            console.log(`${this.config.logID} response content-type header not specified ###\n\nContent-Type set to: text/plain\n\n`);
        }
    }

    //defaults to utf8
    if(!encoding){
        encoding='utf8';

        if(this.config.verbose){
            console.log(`${this.config.logID} encoding not specified ###\nencoding set to:\n`,encoding,'\n\n');
        }
    }

    const refBody=new RefString;
    const refEncoding=new RefString;

    refBody.value=body;
    refEncoding.value=encoding;

    this.beforeServe(request,response,refBody,refEncoding);

    if(response.finished){
        this.afterServe(request);
        return;
    }

    response.end(
        refBody.value,
        refEncoding.value,
        this.afterServe.bind(this,request)
    );

    return;
}

function RefString(){
    Object.defineProperties(
        this,
        {
            value:{
                value:'',
                enumerable:true,
                writable:true
            }
        }
    );
}

function requestRecieved(request,response){
    if(this.config.log){
        const logData={
            method  : request.method,
            url     : request.url,
            headers : request.headers
        };

        this.config.logFunction(
            logData
        );
    }
    let uri = url.parse(request.url);
    uri=uri.pathname;
    if (uri=='/'){
        uri=`/${this.config.server.index}`;
    }

    let hostname= [];

    if (request.headers.host !== undefined){
        hostname = request.headers.host.split(':');
    }

    let root = this.config.root;

    if(this.config.verbose){
        console.log(`${this.config.logID} REQUEST ###\n\n`,
            request.headers,'\n',
            uri,'\n\n',
            hostname,'\n\n'
        );
    }

    if(this.config.domain!='0.0.0.0' && hostname.length > 0 && hostname[0]!=this.config.domain){
        if(!this.config.domains[hostname[0]]){
            if(this.config.verbose){
                console.log(`${this.config.logID} INVALID HOST ###\n\n`);
            }
            this.serveFile(hostname[0],false,response);
            return;
        }
        root=this.config.domains[hostname[0]];
    }


    if(this.config.verbose){
        console.log(`${this.config.logID} USING ROOT : ${root}###\n\n`);
    }

    if(uri.slice(-1)=='/'){
        uri+=this.config.server.index;
    }

    request.url=uri;
    request.serverRoot=root;

    this.onRequest(
        request,
        response
    );

    const filename = path.join(
        request.serverRoot,
        request.url
    );

    fs.exists(
        filename,
        function fileExists(exists){
            this.serveFile(filename,exists,request,response);
        }.bind(this)
    );
}


/*********************
*  SERVER CLASS
*********************/
class Server{
    constructor(){
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
                //executed just after request recieved allowing user to modify if needed
                onRequest:{
                    value:function(request,response){},
                    writable:true,
                    enumerable:true
                },
                //executed just before response sent allowing user to modify if needed
                beforeServe:{
                    value:function beforeServe(request,response,body,encoding){},
                    writable:true,
                    enumerable:true
                },
                //executed after each full response completely sent
                afterServe:{
                    value:function afterServe(request){},
                    writable:true,
                    enumerable:true
                },
                serve:{
                    value:serve,
                    writable:false,
                    enumerable:false
                },
                //kept for backwards compatibility
                configTemplate  :{
                    value:function configTemplate(config){
                        return new Config(config);
                    },
                    writable:false,
                    //not visible because this is just for backwards compatibility
                    enumerable:false
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
        );
    }
}

module.exports=new Server;
