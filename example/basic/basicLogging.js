//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//start the server with a config
server.deploy(
    {
        port:8000,
        root:__dirname+'/appRoot/',
        log:'/tmp/server-test-myApp-8000-request.log'
    }
);

//checkout the server instance
console.log(server);
