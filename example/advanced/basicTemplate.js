const os = require( 'os' );

//import the `node-http-server` module
//const ` server=require(‘node-http-server’); `
const server=require('../../server/Server.js');
const config=new server.Config;

config.verbose=true;
config.port=8000;
config.root=__dirname+'/appRoot/';


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
