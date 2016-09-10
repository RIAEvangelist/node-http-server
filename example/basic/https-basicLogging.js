var server=require('../../server/http.js');

server.deploy(
    {
        port:8000,
        root:__dirname+'/appRoot/',
        log:'/tmp/server-test-myApp-8000-request.log',
        https:{
            privateKey:`${__dirname}/../../local-certs/private/server.key`,
            certificate:`${__dirname}/../../local-certs/server.pub`,
            port:4433
        }
    }
);

console.log(server);
