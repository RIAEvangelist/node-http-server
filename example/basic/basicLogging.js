var server=require('../../server/Server.js');

server.deploy(
    {
        port:8000,
        root:__dirname+'/appRoot/',
        log:'/tmp/server-test-myApp-8000-request.log'
    }
);

console.log(server);
