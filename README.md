Node http server with https and proxy support
================
----

Simple to use stand alone node HTTP and HTTPS Server you can spin up in seconds.

Support for building proxy servers has been added. Documentation coming in next release. [For now see the node-http-server proxy examples](https://github.com/RIAEvangelist/node-http-server/tree/master/example/proxy).

` npm install node-http-server `

[![node-http-server stats](https://nodei.co/npm/node-http-server.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-http-server)  

npm info :  [See npm trends and stats for node-http-server](http://npm-stat.com/charts.html?package=node-http-server&author=&from=&to=)  
![node-http-server npm version](https://img.shields.io/npm/v/node-http-server.svg) ![supported node version for node-http-server](https://img.shields.io/node/v/node-http-server.svg) ![total npm downloads for node-http-server](https://img.shields.io/npm/dt/node-http-server.svg) ![monthly npm downloads for node-http-server](https://img.shields.io/npm/dm/node-http-server.svg) ![npm licence for node-http-server](https://img.shields.io/npm/l/node-http-server.svg)

GitHub info :  
![node-http-server GitHub Release](https://img.shields.io/github/release/RIAEvangelist/node-http-server.svg) ![GitHub license node-http-server license](https://img.shields.io/github/license/RIAEvangelist/node-http-server.svg) ![open issues for node-http-server on GitHub](https://img.shields.io/github/issues/RIAEvangelist/node-http-server.svg)

Package Quality :  
![node-http-server Package Quality](http://npm.packagequality.com/badge/node-http-server.png)

## writing a node http or https server

The below table shows all of the methods available on the server when you require this module.

```javascript

    var server=require('node-http-server');

```

If you want to create a custom Server or extend the Server Class you can require just the server class.

```javascript

    var Server=require('node-http-server').Server;

```

|Server Method| params | description |
|-------------|--------|-------------|
|deploy| config obj (optional) | starts the server. if a config object is passed it will shallow merge it with a clean instantion of the Config class|
|onRequest| request obj | called when request recieved |
|beforeServe|request obj, response obj, body obj, encoding obj| called just before data is served to the client |
|afterServe|request obj| called once data has been fully sent to client |
|Config| config object (optional) | This is a refrence to the Default Config class. Use it to generate a complete config file based off of the default values and arguments passed in when launching the app. Will perform a shallow merge of default values and passed values ig config object passed.|
|Server| none | This is a refrence to the Server Class. Use it to start multiple servers on different ports or to extend the node-http-server.|


---

## Examples

To see the node http server in action run ` npm start ` from the root of this repo and then visit [localhost:8000](http://localhost:8000).

To start only an https example server ` npm run https ` from the root of this repo and then visit [localhost:4433](http://localhost:4433).

To spin up both an http and an https server ` npm run both ` from the root of this repo and then visit [localhost:4433](http://localhost:4433) or [localhost:8000](http://localhost:8000).

Detailed examples can be found in the [example folder](https://github.com/RIAEvangelist/node-http-server/tree/master/example) The basic example directory is static http and https file servers and the advanced directory has dynamic server side rendering http and https examples including a benchmark example.

# Basic http server example

```javascript

    var server=require('node-http-server');

    server.deploy(
        {
            port:8000,
            root:'~/myApp/'
        }
    );

```

# Basic https only server example

```javascript

    var server=require('node-http-server');

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

    var server=require('node-http-server');

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

---

## Custom configuration

for http :

```javascript

    var server=require('node-http-server');

    var config=new server.Config;
    config.errors['404']    = 'These are not the files you are looking for...';
    config.contentType.mp4  = 'video/mp4';
    config.port             = 8005;
    config.verbose          = true;
    config.root             = '~/myApp/'

    server.deploy(config);

```

for https :

```javascript

    var server=require('node-http-server');

    var config=new server.Config;
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

    var server=require('node-http-server');

    var config={
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

## Template filling

```javascript

    var server=require('../../server/http.js');

    server.beforeServe=beforeServe;

    function beforeServe(request,response,body,encoding){
        //only parsing html files for this example
        if(response.getHeader('Content-Type')!=server.config.contentType.html){
            return;
        }

        var someVariable='this is some variable value';

        body.value=body.value.replace('{{someVariable}}',someVariable);
    }

    server.deploy(
        {
            port:8000,
            root:__dirname+'/appRoot/'
        }
    );

```

## Default Node HTTP Server Configuration

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

    var server=require('node-http-server');

    var config={
        port:8000,
        root:__dirna\me+'/appRoot/',
        domain:'myapp',
        domains:{
             //subdomain
             'a.myapp':__dirname+'/appSubDomainRoot/',
             //totally different domain, but also on port 8000
             'yourapp.com':__dirname+'/appOtherDomainRoot/'
        }
    }

    server.deploy(config);

```

---

## Extending the Server

If you wish to make a reusable Server Class of your own to share or for some internal use you can always extend the server class and make your own module too.

```javascript

    var os=require('os');
    var Server=require('node-http-server').Server;

   //MyAwesomeServer inherits from Server
   MyAwesomeServer.prototype = new Server;
   //Constructor will extend Server
   MyAwesomeServer.constructor = MyAwesomeServer;

   function MyAwesomeServer(){
        //extend with some stuff your app needs,
        //maybe npm publish your extention with node-http-server as a dependancy?
        Object.defineProperties(
            this,
            {
                IP:{
                    enumerable:true,
                    get:getIP,
                    //not settable so just return the IP
                    set:getIP
                }
            }
        );

        //locking down Class structure
        //no willy nilly cowboy coding
        Object.seal(this);

        function getIP(){
            var networkInterfaces = os.networkInterfaces();
            var serverIPs={};
            var interfaceKeys=Object.keys(networkInterfaces);
            for(var i in interfaceKeys){
                serverIPs[
                    interfaceKeys[i]
                ]={};

                var interface=networkInterfaces[
                    interfaceKeys[i]
                ];

                for(var j in interface){
                    serverIPs[
                        interfaceKeys[i]
                    ][
                        interface[j].family
                    ]=interface[j].address;
                }
            }

            return IPs;
        }
    }

    module.exports=MyAwesomeServer;

```


```javascript

    var AwesomeServer=require('MyAwesomeServer');

    var server=new AwesomeServer;

    server.deploy(
        {
            port:8000,
            root:'~/myAwesomeApp'
        }
    );

    console.log(server.IP);

```
