//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//examine the server instance
console.log(server);

//start the server
server.deploy(
    {
        verbose:true,
        port:8000,
        root:__dirname+'/appRoot/',
        https:{
            privateKey:`${__dirname}/../../local-certs/private/server.key`,
            certificate:`${__dirname}/../../local-certs/server.pub`,
            port:4433
        }
    }
);
