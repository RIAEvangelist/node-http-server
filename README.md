Node http server
================
----

Simple to use stand alone node HTTP Server you can spin up from node apps, bash scripts, the commandline, C or python apps etc.

----


## Defaults
---
####currently modifiable via any interface, commandline, bash, node etc.

    port    : 8080
    root    : Current Working Directory (where you execute the command from)
    domain  : localhost
    index   : index.html
    verbose : false
    noCache : true

`` port `` the port on which the server should run
`` root `` the absolute location to the root dir for the public file system
`` domain `` the domain which this server applies to - ***this is not yet implemented***
`` index `` the default file to look for in a dir. if not found a **404** will be displayed 
`` verbose `` should the server display detailed info about what it is doing
`` noCache `` should the server prevent caching

---
####currently modifiable via node

    contentType :   {
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
                    }
    
    restrictedType: {}
    
    errors  :   {
                    headers : {
                        'Content-Type' : 'text/plain'
                    },
                    404: '404 MIA',
                    415: '415 File type not supported',
                    403: '403 Access Denied',
                    500: '500 {{err}}'
                }

`` contentType `` mapping of file extension to header content type
`` restrictedType `` extensions to which external access will be denied
`` errors `` error headers and error strings, these can be anything you like from html to text etc. just make sure they all can use the same headers. The **500** error will replace `` {{err}} `` in the specified value with the actual error message from the server.

---

##Start from node app
*documentation coming soon*

---

## Commandline / bash use
`` launch `` is an argument that specifies to launch the server now with the provided arguments and defaults

    node ~/git/node-http-server/server/http.js root=~/myApp/ port=9999 launch=now

you can specify any of the variables frpom the ***currently modifiable via any interface, commandline, bash, node etc.*** section above. The order does not matter.

    node ~/git/node-http-server/server/http.js root=~/myApp/ port=8888 verbose=true launch=now

---

## Starting with forever
*It is helpful especially when running multiple servers to label them*  with `` --uid `` for easy to remember process names

*when starting the same server many times, **like every time the system boots** you will want to append to the same log file* so use `` -a ``. Without `` -a `` forever will throw an error stating that the log file for the `` --uid `` already exists.

    forever --uid nodeServer -a start ~/git/node-http-server/server/http.js root=~/myApp/ port=9999 launch=now
    
This can be set as a ``.profile`` command or a ``.bash_rc`` command as well if you want to launch the server every time the computer boots up.
