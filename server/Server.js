'use strict';

const http = require('http'),
    https = require('https'),
    url = require('url'),
    path = require('path'),
    fs = require('fs'),
    querystring=require('querystring'),
    Config = require(`${__dirname}/Config.js`);

//
// # [SERVER CLASS](https://github.com/RIAEvangelist/node-http-server#server-class)
// ---------------
//
// You can pass a ` userConfig `  object to shallow merge and/or decorate the ` server.config `
// when instatiating if you desire.
// ```javascript
//
// const server=require('node-http-server');
// // server is a Server instation already so to modify or decorate its config, you
// // must call the server.deploy method.
//
// server.deploy({verbose:true})
//
//
// const Server=server.Server;
// // Server is a refrence to the Server class so you can extend or instatiate it.
//
// const myServer=new Server({verbose:true});
// // this is the instatiated server which now contains your desired defaults.
// // like the first example, it too can still be modified on deployment
//
// myServer.deploy({port:8888},(server)=>{console.log(server)});
//
// ```

class Server{
    // ` server.config ` is where the servers configuration will reside.
    // It is a new instance of the [Config class](http://riaevangelist.github.io/node-http-server/server/Config.js.html) which will be shallow merged and/or decorated by with
    // the passed ` userConfig ` if one is passed upon construction of the Server class, or to the ` server.deploy ` method.
    //
    // [Detailed info on the server.config or userConfig](https://github.com/RIAEvangelist/node-http-server#custom-configuration)
    //
    constructor(userConfig){
      this.config=new this.Config(userConfig);
    }

    // #### deploy
    //
    // ` server.deploy ` starts the server.
    //
    // ` server.deploy(userConfig,readyCallback) `
    //
    // |method  | returns |
    // |--------|---------|
    // | deploy | void    |
    //
    // | parameter     | required | description |
    // |---------------|----------|-------------|
    // | userConfig    | no | if a ` userConfig ` object is passed it will decorate the [Config class](http://riaevangelist.github.io/node-http-server/Config.js.html) |
    // | readyCallback | no | called once the server is started |
    //
    // ```javascript
    //
    // const server=require('node-http-server');
    //
    // server.deploy(
    //     {
    //         port:8000,
    //         root:'~/myApp/'
    //     },
    //     serverReady
    // );
    //
    // server.deploy(
    //     {
    //         port:8888,
    //         root:'~/myOtherApp/'
    //     },
    //     serverReady
    // );
    //
    // function serverReady(server){
    //    console.log( `Server on port ${server.config.port} is now up`);
    // }
    //
    // ```
    //
    // See the example folder for more detailed examples, or check the node-http-server readme for some [Quickstart Examples for deploying a node server](https://github.com/RIAEvangelist/node-http-server#examples)
    //
    get deploy(){
      return deploy;
    }

    // #### onRawRequest
    //
    // ` server.onRawRequest `
    //
    // ` server.onRawRequest(request,response,serve) `
    //
    // |method  | should return |
    // |--------|---------|
    // | onRawRequest | bool/void    |
    //
    // | parameter  | description |
    // |------------|-------------|
    // | request    | http(s) request obj  |
    // | response   | http(s) response obj |
    // | serve      | ref to ` server.serve ` |
    //
    //
    // ```javascript
    //
    // const server=require('node-http-server');
    // const config=new server.Config;
    //
    // config.port=8000;
    //
    // server.onRawRequest=gotRequest;
    //
    // server.deploy(config);
    //
    //
    // function gotRequest(request,response,serve){
    //     console.log(request.uri,request.headers);
    //
    //     serve(
    //         request,
    //         response,
    //         JSON.stringify(
    //             {
    //                 uri:request.uri,
    //                 headers:request.headers
    //             }
    //         )
    //     );
    //
    //     return true;
    // }
    //
    // ```
    //
    onRawRequest(request,response,serve){

    }

    // #### onRequest
    //
    // ` server.onRequest `
    //
    // ` server.onRequest(request,response,serve) `
    //
    // |method  | should return |
    // |--------|--------------|
    // | onRequest | bool/void    |
    //
    // | parameter  | description |
    // |------------|-------------|
    // | request    | raw http(s) request obj  |
    // | response   | http(s) response obj |
    // | serve      | ref to ` server.serve ` |
    //
    //
    // ```javascript
    //
    // const server=require('node-http-server');
    // const config=new server.Config;
    //
    // config.port=8099;
    // config.verbose=true;
    //
    // server.onRequest=gotRequest;
    //
    // server.deploy(config);
    //
    //
    // function gotRequest(request,response,serve){
    //     //at this point the request is decorated with helper members lets take a look at the query params if there are any.
    //     console.log(request.query,request.uri,request.headers);
    //
    //     //lets only let the requests with a query param of hello go through
    //     if(request.query.hello){
    //        // remember returning false means do not inturrupt the response lifecycle
    //        // and that you will not be manually serving
    //        return false;
    //     }
    //
    //     serve(
    //         request,
    //         response,
    //         JSON.stringify(
    //             {
    //                 success:false,
    //                 message:'you must have a query param of hello to access the server i.e. /index.html?hello'
    //                 uri:request.uri,
    //                 query:request.query
    //             }
    //         )
    //     );
    //
    //     //now we let the server know we want it to kill the normal request lifecycle
    //     //because we just completed it by serving above. we could also handle it async style
    //     //and request a meme or something from the web and put that on the page (or something...)
    //     return true;
    // }
    //
    // ```
    //
    onRequest(request,response,serve){

    }

    // #### beforeServe
    //
    // ` server.beforeServe `
    //
    // ` server.beforeServe(request,response,body,encoding,serve) `
    //
    // |method  | should return |
    // |--------|---------|
    // | beforeServe | bool/void    |
    //
    // | parameter  | description |
    // |------------|-------------|
    // | request    | decorated http(s) request obj  |
    // | response   | http(s) response obj |
    // | body       | response content body RefString  |
    // | encoding   | response body encoding RefString |
    // | serve      | ref to ` server.serve ` |
    //
    //
    // `type RefString`
    //
    // |type     |keys     |description|
    // |---------|---------|-----------|
    // |RefString| `value` |a way to allow modifying a string by refrence.|
    //
    // ```javascript
    //
    // const server=require('node-http-server');
    //
    // server.beforeServe=beforeServe;
    //
    // function beforeServe(request,response,body,encoding){
    //     //only parsing html files for this example
    //     if(response.getHeader('Content-Type')!=server.config.contentType.html){
    //         //return void||false to allow response lifecycle to continue as normal
    //         return;
    //     }
    //
    //     const someVariable='this is some variable value';
    //
    //     body.value=body.value.replace('{{someVariable}}',someVariable);
    //
    //     //return void||false to allow response lifecycle to continue as normal
    //     //with modified body content
    //     return;
    // }
    //
    // server.deploy(
    //     {
    //         port:8000,
    //         root:`${__dirname}/appRoot/`
    //     }
    // );
    //
    // ```
    //
    beforeServe(request,response,body,encoding,serve){

    }

    // #### afterServe
    //
    // ` server.afterServe `
    //
    // ` server.afterServe(request) `
    //
    // |method      | should return |
    // |------------|---------|
    // | afterServe | n/a   |
    //
    // | parameter  | description |
    // |------------|-------------|
    // | request    | decorated http(s) request obj  |
    //
    //
    // ```javascript
    //
    // const server=require('node-http-server');
    //
    // server.afterServe=afterServe;
    //
    // function afterServe(request){
    //     console.log(`just served ${request.uri}`);
    // }
    //
    // server.deploy(
    //     {
    //         port:8075,
    //         root:`${__dirname}/appRoot/`
    //     }
    // );
    //
    // ```
    //
    afterServe(request){

    }

    get serve(){
      return serve;
    }

    get serveFile(){
      return serveFile;
    }

    get Config(){
      return Config
    }

    get Server(){
      return Server
    }
}

function deploy(userConfig, readyCallback=function(){}){
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

    if(userConfig){
      Object.assign(this.config,userConfig);
    }

    if(this.config.https && this.config.https.privateKey && this.config.https.certificate){
        if(!this.config.https.port){
            this.config.https.port=443;
        }
        this.config.httpsOptions = {
            key: fs.readFileSync(this.config.https.privateKey),
            cert: fs.readFileSync(this.config.https.certificate),
            passphrase: this.config.https.passphrase
        };

        if(this.config.https.ca){
            this.config.httpsOptions.ca=fs.readFileSync(this.config.https.ca);
        }

        Object.defineProperty(
            this,
            'secureServer',
            {
                value:https.createServer(
                    this.config.httpsOptions,
                    requestRecieved.bind(this)
                ),
                writable:false,
                enumerable:true
            }
        );
    }else{
        this.config.https={
            only:false
        };
    }

    this.config.logID=`### ${this.config.domain} server`;

    if(this.config.verbose){
        console.log(
            `${this.config.logID} configured with ###\n\n`,this.config);
    }

    this.server.timeout=this.config.server.timeout;

    if(!this.config.https.only){
        this.server.listen(
            this.config.port,
            function() {
                if(this.config.verbose){
                    console.log(`${this.config.logID} listening on port ${this.config.port} ###\n\n`);
                }

                //The ` readyCallback ` is passed the full server instance
                // so that you may use the same callback to handle multiple
                // server instances in the same code instead of writing an inline
                // callback... think about it ;)
                //
                readyCallback(this);

            }.bind(this)
        );
    }

    if(this.config.httpsOptions){
        this.secureServer.listen(
            this.config.https.port,
            function() {
                if(this.config.verbose){
                    console.log(`HTTPS: ${this.config.logID} listening on port ${this.config.https.port} ###\n\n`);
                }
                // for example the same ready callback could handle both the
                // https and http servers with a simple test for the servers port
                //
                readyCallback(this);
            }.bind(this)
        );
    }
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

    if (
        fs.statSync(filename).isDirectory()
    ){
        filename+=`/${this.config.server.index}`;
    }

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
    if(!response.statusCode){
        response.statusCode=200;
    }

    if(!response.getHeader('Content-Type')){
        response.setHeader(
            'Content-Type',
            'text/plain'
        );

        if(this.config.verbose){
            console.log(`${this.config.logID} response content-type header not specified ###\n\nContent-Type set to: text/plain\n\n`);
        }
    }

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

    //return any value to force or specify delayed or manual serving
    if(
        this.beforeServe(
            request,
            response,
            refBody,
            refEncoding,
            completeServing.bind(this)
        )
    ){
        return;
    };

    completeServing.bind(this)(request,response,refBody,encoding);

    return;
}

function completeServing(request,response,refBody,refEncoding){
    if(!(refBody instanceof RefString)){
        refBody=new RefString(refBody);
    }

    if(!(refEncoding instanceof RefString)){
        refEncoding=new RefString(refEncoding||'binary');
    }

    if(response.finished){
        this.afterServe(request);
        return;
    }

    response.end(
        refBody.value,
        refEncoding.value,
        this.afterServe.bind(this,request)
    );
}

class RefString{
  constructor(value){
    if(value){
      this._string=value;
    }
  }

  get value(){
    return this._string;
  }

  set value(value){
    this._string=value;
    return this._string;
  }
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
    uri.protocol='http';
    uri.host=uri.hostname=request.headers.host;
    uri.port=80;
    uri.query=querystring.parse(uri.query);

    if(request.connection.encrypted){
        uri.protocol='https';
        uri.port=443;
    }

    (
        function(){
            if(!uri.host){
                return;
            }
            const host=uri.host.split(':');

            if(!host[1]){
                return;
            }
            uri.host=uri.hostname=host[0];
            uri.port=host[1];
        }
    )();

    for(let key in uri){
        if(uri[key]!==null){
            continue;
        }
        uri[key]='';
    }

    request.uri=uri;

    if(
        this.onRawRequest(
            request,
            response,
            completeServing.bind(this)
        )
    ){
        return;
    };

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

    request.body='';

    request.on(
      'data',
      function(chunk){
        request.body+=chunk;
      }.bind(this)
    ).on(
      'end',
      function(){
        if(this.config.verbose){
            console.log(`###REQUEST BODY :
${request.body}
###
            `);
        }

        requestBodyComplete.bind(this,request,response)();
      }.bind(this)
    );
}

function requestBodyComplete(request,response){
  //return any value to force or specify delayed or manual serving
  if(
      this.onRequest(
          request,
          response,
          completeServing.bind(this)
      )
  ){
      return;
  };

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

module.exports=new Server;
