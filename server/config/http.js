var config={
    port:8081,
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
        txt : 'text/plain'
    },
    restrictedType:{
        
    }
}

if(!process.env.SERVER_ROOT){
    console.log('SERVER_ROOT not specified, defaulting to current working dir.')
    process.env.SERVER_ROOT=process.cwd();
}

config.rootDIR=process.env.SERVER_ROOT
console.log('config.rootDIR is '+config.rootDIR);

function prod(){
    console.log('launched as prod');
    config.port=8080;
    return config;
}

function dev(){
    console.log('launched as dev');
    return config;
}

function init(){
    switch(process.env.NODE_ENV){
        case 'dev':
            return dev();
        case 'prod':
            return prod();
        default:
            console.log('NODE_ENV not specified so defaulting to dev.');
            return dev();
    }
}

module.exports = {
    init:init
}