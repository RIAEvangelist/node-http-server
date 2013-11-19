Node http server
================

Simple to use stand alone node HTTP Server

## Defaults
Ports  

* `` dev : 8081``  
* `` prod : 8080``

System

* `` Environment : dev ``  
* `` Server Root : Current directory where command to launch script is run from ``

## Setting System Variables
`` NODE_ENV `` = dev | prod

    export NODE_ENV=prod
    node ../server/http/http.js
    * OR *
    NODE_ENV=prod node ../server/http/http.js
    
`` SERVER_ROOT `` = path to server root 

    export SERVER_ROOT=apps/root/
    node server/http/http.js
    * OR *
    SERVER_ROOT=apps/root/ node server/http/http.js

## Starting with forever
*It is helpful especially when running multiple servers to label them*  
`` --uid `` easy to remember server name   

*when starting the same server many times you will want to append to the same log file*
`` -a `` without this forever will throw an error stating that the log file for the --uid already exists.

    NODE_ENV=prod SERVER_ROOT=apps/root/ forever --uid "prod server" -a start server/http/http.js
    *or*
    forever --uid "dev server" -a start ../server/http/http.js
    
This can be set as a ``.profile`` command or a ``.bash_rc`` command as well if you want to launch the server every time the computer boots up.