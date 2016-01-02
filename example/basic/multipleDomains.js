var server=require('../../server/http.js');

console.log(server);

server.deploy(
    {
        verbose:true,
        port:8000,
        root:__dirname+'/appRoot/',
        domain:'myapp',
        domains:{
            'a.myapp':__dirname+'/appSubDomainRoot/',
            'yourapp.com':__dirname+'/appOtherDomainRoot/'
        }
    }
);
