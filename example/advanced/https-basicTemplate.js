const os = require( 'os' );

//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');
const config=new server.Config;

//setup basic server configs and allow http serving with https serving
config.verbose=true;
config.port=8000;
config.root=__dirname+'/appRoot/';

//add ssl certs and set ssl port
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

//set listener to process body template
server.beforeServe=beforeServe;

//just before serving process the template
function beforeServe(request,response,body,encoding){
    //only parse the /index.html request for this example
    if(request.url!='/index.html'){
        return;
    }

    //dynamically detect available interfaces
    //and build content list
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

    //replace {{some-content}} variable with the generated content list
    body.value=body.value.replace('{{some-content}}',serverIPs);
}

server.deploy(config);
