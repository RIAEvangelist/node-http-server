//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//checkout the server in the console
console.log(server);

//start the server with a config
server.deploy(
    {
        verbose: true,
        port: 8000,
        root:__dirname+'/appRoot/'
    }
);
