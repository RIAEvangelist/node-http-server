Node http server with https and proxy support
================
----

Simple to use stand alone node HTTP and HTTPS Server you can spin up in seconds.

- ***[TLDR; Quick start examples](#examples)***
- ***[Server Class](#server-class)***
- ***[Config Class](#config-class)***
- ***[Basic use with cluster example](#basic-cluster-server)***


Support for building proxy servers has been added. Documentation coming in next release. [For now see the node-http-server proxy examples](https://github.com/RIAEvangelist/node-http-server/tree/master/example/proxy).

` npm i node-http-server `

npm info :  [See npm trends and stats for node-http-server](http://npm-stat.com/charts.html?package=node-http-server&author=&from=&to=)  
![node-http-server npm version](https://img.shields.io/npm/v/node-http-server.svg) ![supported node version for node-http-server](https://img.shields.io/node/v/node-http-server.svg) ![total npm downloads for node-http-server](https://img.shields.io/npm/dt/node-http-server.svg) ![monthly npm downloads for node-http-server](https://img.shields.io/npm/dm/node-http-server.svg) ![npm licence for node-http-server](https://img.shields.io/npm/l/node-http-server.svg)

GitHub info :  
![node-http-server GitHub Release](https://img.shields.io/github/release/RIAEvangelist/node-http-server.svg) ![GitHub license node-http-server license](https://img.shields.io/github/license/RIAEvangelist/node-http-server.svg) ![open issues for node-http-server on GitHub](https://img.shields.io/github/issues/RIAEvangelist/node-http-server.svg)  [![Codacy Badge](https://api.codacy.com/project/badge/Grade/fbfd39a7b56643d290bb93db61b14db3)](https://www.codacy.com/app/RIAEvangelist/node-http-server?utm_source=github.com&utm_medium=referral&utm_content=RIAEvangelist/node-http-server&utm_campaign=badger)  

[![node-http-server stats](https://nodei.co/npm/node-http-server.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-http-server)

Package Quality :  
![node-http-server Package Quality](http://npm.packagequality.com/badge/node-http-server.png)

[See the code documentation on riaevangelist.github.io](http://riaevangelist.github.io/node-http-server/)

## cli use if you just want to test

Now you can also use the node-http-server cli if you just want to spin up a basic file server to test something out quickly or share on the local network.

```sh

$ sudo npm i -g node-http-server

//start a node-http-server from the current directory on the default port 8080
$ node-http-server

```

You can modify any of the config keys by passing their key value pairs as args.

```sh

//start a verbose node-http-server from the current directory on port 1942
$ node-http-server port=1942 verbose=true

```

### quick npm script tests and examples

```sh

#node ./example/basic/basicApp.js
npm run basic

#node ./example/basic/https-ONLY-basicApp.js
npm run https

#node ./example/basic/https-basicApp.js
npm run both

#node ./example/advanced/basicTemplate.js
npm run template

#node ./example/basic/cluster-basicApp.js
npm run cluster

```

## writing a node http or https server

The below table shows all of the methods available on the server when you require this module.

```javascript

    const server=require('node-http-server');

    server.deploy();

```

If you want to create a custom Server or extend the Server Class you can require just the server class.

```javascript

    const Server=require('node-http-server').Server;

    class MyCustomServer extends Server{
      constructor(){
        super();
      }
    }

    const server=new MyCustomServer;
    server.deploy();

```

## Server Class

|Server Method or member       | params                                                              | returns / should return          | description |
|------------------------------|---------------------------------------------------------------------|----------------------------------|-------------|
|[deploy](#deploy)             | `userConfig` obj (optional), `readyCallback` fn (optional)          | returns void                     | Starts the server. if a config object is passed it will shallow merge it with a clean instantion of the Config class. |
|[onRawRequest](#onrawrequest) | `request` obj, `response` obj, `serve` fn                           | should return true,false or void | Called immediately upon reciept of http(s) request. Called before any request parsing, useful for ` proxy servers ` and request modification, high speed handling, or rejection. Mildly more complex to work with because the request object has not been parsed and decorated with helper members. If this function returns true, the servers response lifecycle will be exited and you must manually call serve. this allows manual immediate and manual async serving. use the ` serve ` argument, ` server.serve ` or ` server.serveFile ` to manually serve the response. |
|[onRequest](#onrequest)       | `request` obj, `response` obj, `serve` fn                           | should return true,false or void | Called when request received. If this function returns true, the servers response lifecycle will be exited and you must manually call serve. this allows manual immediate and manual async serving. use the ` serve ` argument, ` server.serve ` or ` server.serveFile ` to manually serve the response. |
|[beforeServe](#beforeserve)   |`request` obj, `response` obj, `body` obj, `encoding` obj, `serve` fn| should return true,false or void | Called just before data is served to the client. If this function returns true, the servers response lifecycle will be exited and you must manually call serve. this allows manual immediate and manual async serving. use the ` serve ` argument, ` server.serve ` or ` server.serveFile ` to manually serve the response.   |
|[afterServe](#afterserve)     |`request` obj                                                | void                                     | Called once data has been fully sent to client. |
|[Config](#config-class)       | n/a                                                         | n/a                                      | This is a reference to the Default Config class. Use it to generate a complete config file based off of the default values and arguments passed in when launching the app. Will perform a shallow merge of default values and passed values if a config object passed.|
|[Server](#server-class)       | n/a                                                         | n/a                                      | This is a reference to the Server Class. Use it to start multiple servers on different ports or to extend the node-http-server.|

## request uri, query, and, body

For handling api requests, posts, puts patches etc with body data, we are now making that available on the request as both a ` String ` and ` Buffer ` incase you need images or videos uploaded.

|key|type |value|
|---|-----|-----|
|request.body| string | request body |
|request.url| string | processed uri |
|request.uri| object | parsed url information and query |
|request.serverRoot| string | local dir for publicly served data |

|key|type |value|
|---|-----|-----|
|uri.protocol |string| protocol of request|
|uri.host     |string| hostname for domain|
uri.hostname  |string| hostname for domain|
|uri.query    |object| parsed querystring|
|uri.port     |number| port request was received on|

### [Server Methods](http://riaevangelist.github.io/node-http-server/server/Server.js.html)

#### deploy

` server.deploy ` starts the server.

` server.deploy(userConfig,readyCallback) `

|method  | returns |
|--------|---------|
| deploy | void    |

| parameter     | required | description |
|---------------|----------|-------------|
| userConfig    | no       | if a ` userConfig ` object is passed it will decorate the [Config class](http://riaevangelist.github.io/node-http-server/server/Config.js.html) |
| readyCallback | no       | called once the server is started |

```javascript

const server=require('node-http-server');

server.deploy(
    {
        port:8000,
        root:'~/myApp/'
    },
    serverReady
);

server.deploy(
    {
        port:8888,
        root:'~/myOtherApp/'
    },
    serverReady
);

function serverReady(server){
   console.log( `Server on port ${server.config.port} is now up`);
}

```

#### onRawRequest

` server.onRawRequest `

` server.onRawRequest(request,response,serve) `

|method  | should return |
|--------|---------|
| onRawRequest | bool/void    |

| parameter  | description |
|------------|-------------|
| request    | http(s) request obj  |
| response   | http(s) response obj |
| serve      | ref to ` server.serve ` |


```javascript

const server=require('node-http-server');
const config=new server.Config;

config.port=8000;

server.onRawRequest=gotRequest;

server.deploy(config);


function gotRequest(request,response,serve){
    console.log(request.uri,request.headers);

    serve(
        request,
        response,
        JSON.stringify(
            {
                uri:request.uri,
                headers:request.headers
            }
        )
    );

    return true;
}

```

#### onRequest

` server.onRequest `

` server.onRequest(request,response,serve) `

|method  | should return |
|--------|--------------|
| onRequest | bool/void    |

| parameter  | description |
|------------|-------------|
| request    | http(s) request obj  |
| response   | http(s) response obj |
| serve      | ref to ` server.serve ` |


```javascript

const server=require('node-http-server');
const config=new server.Config;

config.port=8099;
config.verbose=true;

server.onRequest=gotRequest;

server.deploy(config);


function gotRequest(request,response,serve){
    //at this point the request is decorated with helper members lets take a look at the query params if there are any.
    console.log(request.query,request.uri,request.headers);

    //lets only let the requests with a query param of hello go through
    if(request.query.hello){
       // remember returning false means do not inturrupt the response lifecycle
       // and that you will not be manually serving
       return false;
    }

    serve(
        request,
        response,
        JSON.stringify(
            {
                success:false,
                message:'you must have a query param of hello to access the server i.e. /index.html?hello'
                uri:request.uri,
                query:request.query
            }
        )
    );

    //now we let the server know we want it to kill the normal request lifecycle
    //because we just completed it by serving above. we could also handle it async style
    //and request a meme or something from the web and put that on the page (or something...)
    return true;
}

```

#### beforeServe

` server.beforeServe `

` server.beforeServe(request,response,body,encoding,serve) `

|method  | should return |
|--------|---------|
| beforeServe | bool/void    |

| parameter  | description |
|------------|-------------|
| request    | http(s) request obj  |
| response   | http(s) response obj |
| body       | response content body RefString  |
| encoding   | response body encoding RefString |
| serve      | ref to ` server.serve ` |


type ` RefString `

|type     |keys     |description|
|---------|---------|-----------|
|RefString| `value` |a way to allow modifying a string by refrence.|

```javascript

const server=require('node-http-server');

server.beforeServe=beforeServe;

function beforeServe(request,response,body,encoding){
    //only parsing html files for this example
    if(response.getHeader('Content-Type')!=server.config.contentType.html){
        //return void||false to allow response lifecycle to continue as normal
        return;
    }

    const someVariable='this is some variable value';

    body.value=body.value.replace('{{someVariable}}',someVariable);

    //return void||false to allow response lifecycle to continue as normal
    //with modified body content
    return;
}

server.deploy(
    {
        port:8000,
        root:`${__dirname}/appRoot/`
    }
);

```

#### afterServe

` server.afterServe `

` server.afterServe(request) `

|method      | should return |
|------------|---------|
| afterServe | n/a   |

| parameter  | description |
|------------|-------------|
| request    | decorated http(s) request obj  |


```javascript

const server=require('node-http-server');

server.afterServe=afterServe;

function afterServe(request){
    console.log(`just served ${request.uri}`);
}

server.deploy(
    {
        port:8075,
        root:`${__dirname}/appRoot/`
    }
);

```


## Examples

To see the node http server in action run ` npm start ` from the root of this repo and then visit [localhost:8000](http://localhost:8000).

To start only an https example server ` npm run https ` from the root of this repo and then visit [localhost:4433](http://localhost:4433).

To spin up both an http and an https server ` npm run both ` from the root of this repo and then visit [localhost:4433](http://localhost:4433) or [localhost:8000](http://localhost:8000).

Detailed examples can be found in the [example folder](https://github.com/RIAEvangelist/node-http-server/tree/master/example) or under the example folder on the [node-http-server example docs](http://riaevangelist.github.io/node-http-server/example/readme.md.html)  The basic example directory is static http and https file servers and the advanced directory has dynamic server side rendering http and https examples including a benchmark example. The ` proxy ` examples show manual serving and response modification examples.  

# Basic http server example

```javascript

    const server=require('node-http-server');

    server.deploy(
        {
            port:8000,
            root:'~/myApp/'
        }
    );

```

# Basic https only server example

```javascript

    const server=require('node-http-server');

    server.deploy(
        {
            port:8000,
            root:'~/myApp/',
            https:{
                privateKey:`/path/to/your/certs/private/server.key`,
                certificate:`/path/to/your/certs/server.pub`,
                port:4433,
                only:true
            }
        }
    );

```

# Basic server running both http and https

```javascript

    const server=require('node-http-server');

    server.deploy(
        {
            port:8000,
            root:'~/myApp/',
            https:{
                privateKey:`/path/to/your/certs/private/server.key`,
                certificate:`/path/to/your/certs/server.pub`,
                port:4433
            }
        }
    );

```

## Basic cluster server

```javascript

//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//import cluster
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork node-http-server cluster workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on(
    'exit',
    (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
    }
  );
} else {
  server.afterServe=(request)=>{
    console.log(`${process.pid} served ${request.uri.path}`);
  }

  //start server in clustered children
  server.deploy(
      {
          verbose: false,
          port: 8000,
          root:__dirname+'/appRoot/'
      }
  );

  console.log(`Worker ${process.pid} started listening on ${server.config.port}`);
}

```

## Template filling

```javascript

    const server=require('node-http-server');

    server.beforeServe=beforeServe;

    function beforeServe(request,response,body,encoding){
        //only parsing html files for this example
        if(response.getHeader('Content-Type')!=server.config.contentType.html){
            return;
        }

        const someVariable='this is some variable value';

        body.value=body.value.replace('{{someVariable}}',someVariable);
    }

    server.deploy(
        {
            port:8000,
            root:`${__dirname}/appRoot/`
        }
    );

```

---

## Custom configuration

for http :

```javascript

    const server=require('node-http-server');

    const config=new server.Config;
    config.errors['404']    = 'These are not the files you are looking for...';
    config.contentType.mp4  = 'video/mp4';
    config.port             = 8005;
    config.verbose          = true;
    config.root             = '~/myApp/'

    server.deploy(config);

```

for https :

```javascript

    const server=require('node-http-server');

    const config=new server.Config;
    config.errors['404']    = 'These are not the files you are looking for...';
    config.contentType.mp4  = 'video/mp4';
    config.port             = 8005;
    config.verbose          = true;
    config.root             = '~/myApp/'
    config.https.privateKey = `/path/to/your/certs/private/server.key`;
    config.https.certificate= `/path/to/your/certs/server.pub`;
    config.https.port       = 4433;
    config.https.only       = true;

    server.deploy(config);

```


---

## Multiple domains or subdomains

```javascript

    const server=require('node-http-server');

    const config={
        port:8010,
        root:__dirname + '/www/myApp/',
        domain:'myapp.com',
        domains:{
            'a.myapp.com':__dirname+'/www/a-myApp/',
            'yourapp.com':__dirname+'/someFolder/yourApp/'
        }
    }

    server.deploy(config);    

```

## [Config Class](http://riaevangelist.github.io/node-http-server/server/Config.js.html)

### Default node HTTP server configuration

All of these can be modified and passed into ` new server.Server(myConfigs) ` or ` server.deploy(myConfigs) `

```javascript

const myConfig=new server.Config;
myConfig.verbose=true;
myConfig.port=9922;

const myServer=new server.Server(config);
myServer.deploy();

//or more basically
server.deploy({port:9922,verbose:true});

```

#### defaults description


```javascript

    {
        verbose     : (args.verbose=='true')||false,
        port        : args.port||defaults.port,
        root        : args.root||defaults.root,
        domain      : args.domain||defaults.domain,
        https       :{
            ca:'',
            privateKey:'',
            certificate:'',
            port:443,
            only:false
        },
        log         : false,
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
            noCache : args.noCache=='false' ? false : true,
            timeout : 30000 //30 second timeout
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

```


|key|description|
|---|-----|
|verbose| display detailed info about what server is doing via terminal. |
|port| the port on which the server should run  |
|root| the absolute path to the root dir for the domain |
|domain| the server domain. To accept incoming requests for ***ANY Applicable Domain*** use ` 0.0.0.0 ` this will allow any request that is pointed at this machine on the specified port to use this server config.  |
|https|settings for https, these wil only take effect if both a `privateKey` and a `certificate` are specified. Setting ` only ` to be true means the instance will only serve over https|
|https.privateKey|path to your servers private key like ./local-certs/private/server.key or similar|
|https.certificate|path to your servers public cert like ./local-certs/client.pub or similar|
|https.ca|path to your officially signed CA's certificate authority file servers public cert like ./local-certs/ca-bundle.crt or similar. This is often needed for officially signed and generated certs, but not for self signed certs so it is optional.|
|log| full path to log file, if specified and the file is not present, it will be created, however the dir must be there. Example path : ` /tmp/server.log ` It is recommended that you timestamp this file name with a time stamp like : ` '~/serverLogs/domain-'+new Date().getTime()+'.log' ` this will create a new log file each time the server is started/restarted/reboot etc...  |
|logFunction| the default function appends timestamps to the headers object and logs as JSON in the ` log ` file. You can assign your own function here as well. It should accepts a javascript Object as the first argument. |
|domains.*| this is a mapping of hostname to path. It can be used for multiple different domains, or for subdomains.|
|server.index| the default file to look for in a dir. if not found a **404** will be displayed   |
|server.noCache| should the server prevent caching    |
|server.timeout| the amount of time allowed for no activity on a connection before it is closed. |
|contentType.*| mapping of file extension to header Content-Type value.  |
|restrictedType.*| extensions to which access will be denied. |
|errors.headers| these are the headers that will automatically be applied to all error responses. You can add custom headers per error in the ` beforeServe ` function |
|errors.*| error headers and error strings, these can be anything you like from html to text etc. The **500** error will replace ` {{err}} ` in the specified value with the actual error message from the server.  |


#### config.domains.*

Use this object for sub domains, or hosting multiple domains on the same port. Specify the whole host i.e. "my.sub.domain.com" or "amazing-domain.com".

You may need to edit your hosts file, cnames, iptable to get this to work on your server or development environment.

You can add the below example to your hosts file to run some of the examples from the ` /example/basic ` directory which use multiple domains on occasion.

    #node-http-server examples
    127.0.0.1 myapp
    127.0.0.1 a.myapp
    127.0.0.1 yourapp.com

 ```javascript

    const server=require('node-http-server');

    const config={
        port:8000,
        root:__dirna\me+'/appRoot/',
        domain:'myapp',
        domains:{
             //subdomain
             'a.myapp':`${__dirname}/appSubDomainRoot/`,
             //totally different domain, but also on port 8000
             'yourapp.com':`${__dirname}/appOtherDomainRoot/`
        }
    }

    server.deploy(config);

```

---

## Extending the Server

If you wish to make a reusable Server Class of your own to share or for some internal use you can always extend the server class and make your own module too.

```javascript

    const os=require('os');
    const Server=require('node-http-server').Server;

    class MyAwesomeServer extends Server(){
        constructor(){
            super();
        }

        IP(){
            const networkInterfaces = os.networkInterfaces();
            const serverIPs={};
            const interfaceKeys=Object.keys(networkInterfaces);
            for(let i in interfaceKeys){
                serverIPs[
                    interfaceKeys[i]
                ]={};

                const interface=networkInterfaces[
                    interfaceKeys[i]
                ];

                for(let j in interface){
                    serverIPs[
                        interfaceKeys[i]
                    ][
                        interface[j].family
                    ]=interface[j].address;
                }
            }

            return serverIPs;
        }
    }

    module.exports=MyAwesomeServer;

```


```javascript

    const AwesomeServer=require('MyAwesomeServer');

    const server=new AwesomeServer;

    server.deploy(
        {
            port:8000,
            root:'~/myAwesomeApp'
        }
    );

    console.log(server.IP);

```
