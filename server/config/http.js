var defaults={
    ports : {
        prod: 8080,
        dev : 8081
    },
    serverRoot:process.cwd()
}
var config={
    port:false,
    apps:{
        
    },
    server:{
        index   : 'index.html',
        noCache : true
    },
    contentType:{
        html: 'text/html',
        css : 'text/css',
        js  : 'text/javascript',
        json: 'application/json',
        txt : 'text/plain',
        jpeg: 'image/jpeg',
        jpg : 'image/jpeg',
        png : 'image/png',
        gif : 'image/gif',
        ico : 'image/x-icon'
    },
    restrictedType:{
        
    }
}

if(!process.env.SERVER_ROOT){
    console.log('SERVER_ROOT not specified, defaulting to '+defaults.serverRoot);
    process.env.SERVER_ROOT=defaults.serverRoot;
}

if(process.env.SERVER_PORT){
    config.port=process.env.SERVER_PORT;
}

config.rootDIR=process.env.SERVER_ROOT
console.log('config.rootDIR is '+config.rootDIR);

function prod(){
    if(!config.port)
        config.port=defaults.ports.prod;
    logLaunchData('prod');
    return config;
}

function dev(){
    if(!config.port)
        config.port=defaults.ports.dev;
    logLaunchData('dev');
    return config;
}

function logLaunchData(){
    console.log(
        'launched as '+
        (
            process.env.NODE_ENV||
            'dev'
        )
    );
    console.log(config);
}

function init(){
    switch(process.env.NODE_ENV){
        case 'dev':
            return dev();
        case 'prod':
            return prod();
        default:
            return dev();
    }
}

module.exports = {
    init:init
}