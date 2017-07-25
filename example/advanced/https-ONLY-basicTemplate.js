const os = require( 'os' );

//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');
const config=new server.Config;

//setup basic server configs and allow http serving with https serving
config.verbose=true;
config.root=__dirname+'/appRoot/';
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;
config.https.only       = true

server.beforeServe=beforeServe;

function beforeServe(request,response,body,encoding){
    //only parse the /index.html request
    if(request.url!='/index.html'){
        return;
    }

    //dynamically detect available interfaces
    var networkInterfaces = os.networkInterfaces();
    var serverIPs='';
    var interfaceKeys=Object.keys(networkInterfaces);
    for(var i in interfaceKeys){
        serverIPs+='<li><strong>'+interfaceKeys[i]+' : </strong><br>';

        var interface=networkInterfaces[
            interfaceKeys[i]
        ];

        for(var j in interface){
            var fam=interface[j].family;
            var address=interface[j].address;
            serverIPs+=fam+' -> '+address+'<br>';
        }
        serverIPs+='</li>';
    }


    body.value=body.value.replace('{{some-content}}',serverIPs);
}

server.deploy(config);
