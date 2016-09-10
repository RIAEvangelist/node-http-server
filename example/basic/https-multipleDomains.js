var server=require('../../server/http.js');
var config={
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

console.log(server);

server.deploy(config);
