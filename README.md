Node http server
================
----

Simple to use stand alone node HTTP Server you can spin up from node apps, bash scripts, the commandline, C or python apps etc.

` npm install node-http-server `

[![node-http-server stats](https://nodei.co/npm/node-http-server.png?downloads=true&downloadRank=true&stars=true)](https://www.npmjs.com/package/node-http-server)  

npm info :  [See npm trends and stats for node-http-server](http://npm-stat.com/charts.html?package=node-http-server&author=&from=&to=)  
![node-http-server npm version](https://img.shields.io/npm/v/node-http-server.svg) ![supported node version for node-http-server](https://img.shields.io/node/v/node-http-server.svg) ![total npm downloads for node-http-server](https://img.shields.io/npm/dt/node-http-server.svg) ![monthly npm downloads for node-http-server](https://img.shields.io/npm/dm/node-http-server.svg) ![npm licence for node-http-server](https://img.shields.io/npm/l/node-http-server.svg)

GitHub info :  
![node-http-server GitHub Release](https://img.shields.io/github/release/RIAEvangelist/node-http-server.svg) ![GitHub license node-http-server license](https://img.shields.io/github/license/RIAEvangelist/node-http-server.svg) ![open issues for node-http-server on GitHub](https://img.shields.io/github/issues/RIAEvangelist/node-http-server.svg)

Package Quality :  
![node-http-server Package Quality](http://npm.packagequality.com/badge/node-http-server.png)

---
## Default Node HTTP Server Configuration

```javascript

    {
        verbose     : (args.verbose=='true')||false,
        port        : args.port||defaults.port,
        root        : args.root||defaults.root,
        domain      : args.domain||defaults.domain,
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
        root:__dirname+'/appRoot/',
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


## Commandline / bash use

` launch ` is an argument that specifies to launch the server now with the provided arguments and defaults

    node ~/git/node-http-server/server/http.js root=~/myApp/ port=9999 launch=now

you can specify any of the variables from the config example above which use args. The order does not matter.

    node ~/git/node-http-server/server/http.js root=~/myApp/ port=8888 verbose=true launch=now



|arg|default|vaild values|
|---|-------|------------|
|verbose|false|true or false|
|port|defaults.port|any valid port on the machine|
|root|defaults.root|any valid path on the machine|
|domain|localhost|any domain which route to the machines ip. This can be done publicly or locally, as in the hosts file. ` 0.0.0.0 ` will accept requests from *** ANY *** domain pointed at the machine.|
|index|index.html|any file name|
|noCache|true|true or false|

---

## writing a node http server

** DO NOT USE launch=now ** as an argument for a node app. This will result in launching 2 servers, the one you specify with the arguments passed and then the one the node app launches too.

```javascript

    Server={
        deploy:{
            value:deploy,
            writable:false,
            enumerable:true
        },
        //executed just after request recieved allowing user to modify if needed
        onRequest:{
            value:function(request){},
            writable:true,
            enumerable:true
        },
        //executed just before response sent allowing user to modify if needed
        beforeServe:{
            value:function(request,response,body,encoding){},
            writable:true,
            enumerable:true
        },
        //executed after each full response completely sent
        afterServe:{
            value:function(){},
            writable:true,
            enumerable:true
        },
        //Config Class
        Config:{
            value:Config,
            writable:false,
            enumerable:true
        },
        //Server Class use to extend the node server
        Server:{
            value:Server,
            writable:false,
            enumerable:true
        }
    }

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

## basic app example

In the main directory enter

`npm start`

to see a basic app and see the example folder to edit and create an awesome app of your own!

---

#### node examples
can be found in the examples folder

#### basic
this app could be launched as  
` node basicApp.js verbose=true  `  
to force verbose terminal output. This can be helpful if you have many servers in a single app and want them all to be verbose right now for debugging or testing purposes.

    var server=require('node-http-server');

    console.log(server);

    server.deploy(
        {
            port:8000,
            root:'~/myApp/'
        }
    );

---

#### verbose

    var server=require('node-http-server');

    console.log(server);

    server.deploy(
        {
            verbose:true,
            port:8001,
            root:'~/myApp/'
        }
    );

---
#### advanced

    var server=require('node-http-server');

    console.log(server);

    var config=server.configTemplate();
    config.errors['404']    = 'These are not the files you are looking for...';
    config.contentType.mp4  = 'video/mp4';
    config.port             = 8005;
    config.verbose          = true;
    config.root             = '~/myApp/'

    server.deploy(config);

---
#### multiple domains or subdomains

    var server=require('node-http-server');

    console.log(server);

    server.deploy(
        {
            verbose:true,
            port:8010,
            root:process.env.HOME+'/myApp/',
            domain:'myapp',
            domains:{
                'a.myapp':process.env.HOME+'/myApp/mySubdomain/',
                'yourapp.com':process.env.HOME+'/www/yourApp/'
            }
        }
    );    

---

## Starting with forever
*It is helpful especially when running multiple servers to label them*  with ` --uid ` for easy to remember process names

*when starting the same server many times, **like every time the system boots** you will want to append to the same log file* so use ` -a `. Without ` -a ` forever will throw an error stating that the log file for the ` --uid ` already exists.

    forever --uid nodeServer -a start ~/git/node-http-server/server/http.js root=~/myApp/ port=9999 launch=now

This can be set as a ` .profile ` command or a ` .bash_rc ` command as well if you want to launch the server every time the computer boots up.
