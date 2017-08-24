'use strict';

const fs=require('fs');

const passedArgs = process.argv.slice(2),
    argCount = passedArgs.length,
    args = {};

const defaults = {
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

// # Config Class
//
// [Detailed default config docs and explination](https://github.com/RIAEvangelist/node-http-server/#config-class)
//
class Config{
    constructor(userConfig){
      Object.assign(this,defaultConfigs);

      if(userConfig){
          for(const k in userConfig){
              this[k]=userConfig[k];
          }
      }
    }
}

// ### Default node HTTP server config values
//
// All of these can be modified and passed into ` new server.Server(myConfigs) ` or ` server.deploy(myConfigs) `
//
// ```javascript
//
// const myConfig=new server.Config;
// myConfig.verbose=true;
// myConfig.port=9922;
//
// const myServer=new server.Server(config);
// myServer.deploy();
//
// //or more basically
// server.deploy({port:9922,verbose:true});
//
// ```
// [Detailed default config docs and explination](https://github.com/RIAEvangelist/node-http-server/#default-node-http-server-configuration)
//
//
const defaultConfigs={
    verbose     : (args.verbose=='true')||false,
    port        : args.port||defaults.port,
    root        : args.root||defaults.root,
    domain      : args.domain||defaults.domain,
    log         : false,
    logFunction : serverLogging,
    domains   : {

    },
    server      : {
        index   : args.index||defaults.index,
        noCache : args.noCache=='false' ? false : true,
        timeout : 30000
    },
    https:{
        ca:'',
        privateKey:'',
        certificate:'',
        passphrase:false,
        port:443,
        only:false
    },
    contentType : {
        html    : 'text/html',
        css     : 'text/css',
        js      : 'application/javascript',
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

module.exports=Config;
