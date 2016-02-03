'use strict';

const fs=require('fs');

const passedArgs = process.argv.splice(2),
    argCount = passedArgs.length,
    args = {},
    defaults = {
        port    : 8080,
        root    : process.cwd(),
        domain  : '0.0.0.0',
        index   : 'index.html',
        log     : false
    };

for(let i=0; i<argCount; i++){
    const data=passedArgs[i].split('=');
    args[data[0]]=data[1];
}

/**************************************\
 *
 *    These are the valid basic configs
 *    that can be passed when deploying
 *    a server, content types are dynamic
 *    so you can pass whatever you like
 *
 * ************************************/

const defaultConfigs={
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

function serverLogging(data){
    fs.exists(
        this.log,
        function serverLogExsits(exists){
            data.timestamp=new Date().getTime();

            const JSONData=JSON.stringify(data);
            let method='appendFile';
            if(!exists){
                method='writeFile';
            }
            fs[method](
                this.log,
                JSONData,
                function fsMethod(err) {
                    if(err){
                        console.log(err);
                    }
                }
            );
        }.bind(this)
    );
}


/**************************************\
 *    Config Class.
 * ************************************/

class Config{
    constructor(userConfig){
        //for backwards compatibility
        const config = {};
        Object.defineProperties(
            config,
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
        );

        if(userConfig){
            for(const k in userConfig){
                config[k]=userConfig[k];
            }
        }

        //this is to allow backwards compatibility with configTemplate
        return config;
    }
}

module.exports=Config;
