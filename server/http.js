/*jslint node: true */
'use strict';

var http    = require('http'),
    url     = require('url'),
    path    = require('path'),
    fs      = require('fs'),
    Config  = require(__dirname+'/Config.js');

var passedArgs  = process.argv.splice(2),
    argCount    = passedArgs.length,
    args        = {};

for(var i=0; i<argCount; i++){
    var data=passedArgs[i].split('=');
    args[data[0]]=data[1];
}

if(args.launch=='now'){
    var server=new Server;
    deploy();
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
    this.config.logID='### '+this.config.domain+' server';

    if(this.config.verbose){
        console.log(this.config.logID+' configured with ###\n\n',this.config);
    }

    this.server.timeout=this.config.server.timeout;
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
        if(this.config.verbose){
            console.log(this.config.logID+' 404 ###\n\n');
        }

        response.statusCode=404;

        this.serve(
            response,
            this.config.errors['404'],
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

        response.statusCode=415;

        this.serve(
            response,
            this.config.errors['415'],
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

        response.statusCode=403;

        this.serve(
            response,
            this.config.errors['403'],
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

                response.statusCode=500;

                this.serve(
                    response,
                    this.config.errors['500'].replace(/\{\{err\}\}/g,err),
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

            response.statusCode=200;

            this.serve(
                response,
                file,
                headers,
                'binary'
            );

            if(this.config.verbose){
                console.log(this.config.logID+' 200 ###\n\n',headers,'\n\n');
            }

            return;
        }.bind(this)
    );
}

function serve(response,body,headers,encoding){
    //defaults to 200
    if(!response.statusCode){
        response.statusCode=200;
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

    this.beforeServe(response,body,headers,encoding);

    if(response.finished){
        this.afterServe();
        return;
    }

    response.writeHead(
        response.statusCode,
        headers
    );
    response.end(body,encoding,this.afterServe);
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
            //executed just before response sent allowing user to modify if needed
            beforeServe:{
                value:function(){},
                writable:true,
                enumerable:true
            },
            //executed after each full response completely sent
            afterServe:{
                value:function(){},
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
                value:Config,
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
    )
}

module.exports=new Server;
