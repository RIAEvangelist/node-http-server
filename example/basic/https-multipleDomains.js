//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//set up a config with multiple domains over ssl
const config={
    verbose:true,
    port:8000,
    root:__dirname+'/appRoot/',
    domain:'myapp',
    domains:{
        'a.myapp':__dirname+'/appSubDomainRoot/',
        'yourapp.com':__dirname+'/appOtherDomainRoot/'
    },
    https:{
        privateKey:`${__dirname}/../../local-certs/private/server.key`,
        certificate:`${__dirname}/../../local-certs/server.pub`,
        port:4433
    }
}

//checkout the multi domain server instance
console.log(server);

//start the server
server.deploy(config);
