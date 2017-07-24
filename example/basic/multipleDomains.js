//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//set up a config with multiple domains on just http
const config={
    verbose:true,
    port:8000,
    root:__dirname+'/appRoot/',
    domain:'myapp',
    domains:{
        'a.myapp':__dirname+'/appSubDomainRoot/',
        'yourapp.com':__dirname+'/appOtherDomainRoot/'
    }
}

//examine the server instance
console.log(server);

//start the server
server.deploy(config);
