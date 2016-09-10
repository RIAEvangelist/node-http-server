var server=require('../../server/http.js');

console.log(server);

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
