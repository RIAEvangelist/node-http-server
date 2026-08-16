#!/usr/bin/env node
'use strict';

const server=require('../server/Server.js'),
    packageData=require('../package.json');

const help=`node-http-server ${packageData.version}

Usage:
  node-http-server [options]
  node-http-server port=8080 root=./public

Options:
  -p, --port <port>                 HTTP port (default: 8080)
  -r, --root <path>                 Static root (default: current directory)
      --host <address>              Bind address (default: 127.0.0.1)
      --domain <hostname>           Accepted primary hostname
      --index <file>                Directory index (default: index.html)
      --no-cache                    Disable client caching
      --cache                       Allow client caching
      --allow-dotfiles              Allow dotfiles (blocked by default)
      --spa[=<file>]                Enable SPA history fallback
      --compression                 Enable Brotli/gzip responses
      --max-body <bytes|false>      Request-body limit; false or 0 disables
      --timeout <ms|false>          Socket inactivity timeout
      --request-timeout <ms|false>  Whole-request timeout
      --headers-timeout <ms|false>  Header timeout
      --keep-alive-timeout <ms|false> Keep-alive timeout
      --log <path>                  Append NDJSON request logs
  -v, --verbose                     Print operational details
  -h, --help                        Show this help
      --version                     Show the version
`;

let config;
let failurePending=false;

try{
    config=parseArgs(process.argv.slice(2));
}catch(err){
    console.error(err.message);
    console.error('Run node-http-server --help for usage.');
    process.exitCode=2;
    return;
}

if(config.help){
    process.stdout.write(help);
    return;
}

if(config.version){
    process.stdout.write(`${packageData.version}\n`);
    return;
}

try{
    server.deploy(
        config,
        function(instance,nodeServer){
            const address=nodeServer.address();
            const protocol=nodeServer===instance.secureServer ? 'https' : 'http';
            const host=address.address.includes(':') ? `[${address.address}]` : address.address;
            console.log(`node-http-server listening at ${protocol}://${host}:${address.port}`);
        }
    );
}catch(err){
    fail(err);
    return;
}

for(const nodeServer of [server.server,server.secureServer]){
    if(nodeServer){
        nodeServer.once('error',fail);
    }
}

process.once('SIGINT',()=>shutdown(130));
process.once('SIGTERM',()=>shutdown(0));

function parseArgs(input){
    const output={server:{}};
    const aliases={
        p:'port',
        r:'root',
        v:'verbose',
        h:'help',
        noCache:'no-cache',
        spaFallback:'spa',
        maxRequestBodyBytes:'max-body',
        requestTimeout:'request-timeout',
        headersTimeout:'headers-timeout',
        keepAliveTimeout:'keep-alive-timeout',
        allowDotfiles:'allow-dotfiles'
    };
    const valueOptions=new Set([
        'port',
        'root',
        'host',
        'domain',
        'index',
        'max-body',
        'timeout',
        'request-timeout',
        'headers-timeout',
        'keep-alive-timeout',
        'log'
    ]);

    for(let index=0; index<input.length; index++){
        const argument=input[index];
        let key;
        let value;

        if(argument.includes('=') && !argument.startsWith('=')){
            const parts=argument.replace(/^--?/,'').split('=');
            key=parts.shift();
            value=parts.join('=');
        }else if(argument.startsWith('--')){
            key=argument.slice(2);
        }else if(argument.startsWith('-') && argument.length==2){
            key=aliases[argument.slice(1)];
        }else if(!argument.startsWith('-') && !output.root){
            key='root';
            value=argument;
        }else{
            throw new Error(`Unknown argument: ${argument}`);
        }

        if(!key){
            throw new Error(`Unknown argument: ${argument}`);
        }

        key=aliases[key] || key;

        if(value===undefined && valueOptions.has(key)){
            value=input[++index];
            if(value===undefined || value.startsWith('-')){
                throw new Error(`Missing value for --${key}`);
            }
        }

        assignOption(output,key,value);
    }

    if(!Object.keys(output.server).length){
        delete output.server;
    }

    return output;
}

function assignOption(config,key,value){
    switch(key){
        case 'help':
        case 'version':
        case 'verbose':
            config[key]=value===undefined ? true : booleanValue(value,key);
            return;
        case 'port':
            config.port=numberValue(value,key);
            return;
        case 'root':
        case 'host':
        case 'domain':
        case 'log':
            config[key]=value;
            return;
        case 'index':
            config.server.index=value;
            return;
        case 'no-cache':
            config.server.noCache=value===undefined ? true : booleanValue(value,key);
            return;
        case 'cache':
            config.server.noCache=false;
            return;
        case 'spa':
            config.server.spaFallback=value===undefined || value==='' ? true : value;
            return;
        case 'compression':
            config.server.compression=value===undefined ? true : booleanValue(value,key);
            return;
        case 'allow-dotfiles':
            config.server.allowDotfiles=value===undefined ? true : booleanValue(value,key);
            return;
        case 'max-body':
            config.server.maxRequestBodyBytes=optionalNumber(value,key);
            return;
        case 'timeout':
            config.server.timeout=optionalNumber(value,key);
            return;
        case 'request-timeout':
            config.server.requestTimeout=optionalNumber(value,key);
            return;
        case 'headers-timeout':
            config.server.headersTimeout=optionalNumber(value,key);
            return;
        case 'keep-alive-timeout':
            config.server.keepAliveTimeout=optionalNumber(value,key);
            return;
        default:
            throw new Error(`Unknown option: ${key}`);
    }
}

function booleanValue(value,key){
    if(value===true || value=='true'){
        return true;
    }
    if(value===false || value=='false'){
        return false;
    }
    throw new Error(`${key} must be true or false`);
}

function optionalNumber(value,key){
    if(value===false || value=='false' || value=='off'){
        return false;
    }
    return numberValue(value,key);
}

function numberValue(value,key){
    const output=Number(value);
    if(!Number.isFinite(output) || output<0){
        throw new Error(`${key} must be a non-negative number`);
    }
    return output;
}

async function fail(err){
    if(failurePending){
        return;
    }
    failurePending=true;
    console.error(err.message);
    process.exitCode=1;
    try{
        await server.close();
    }catch(closeError){
        console.error(closeError.message);
    }
}

async function shutdown(code){
    try{
        await server.close();
        process.exitCode=code;
    }catch(err){
        fail(err);
    }
}
