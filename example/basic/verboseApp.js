//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//look at the server instance
console.log(server);

//start the server
server.deploy(
    {
        verbose:true,
        port:8000,
        root:__dirname+'/appRoot/'
    }
);
