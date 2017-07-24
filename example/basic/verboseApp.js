var server=require('../../server/Server.js');

console.log(server);

server.deploy(
    {
        verbose:true,
        port:8000,
        root:__dirname+'/appRoot/'
    }
);
