const os = require( 'os' );

//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');
const config=new server.Config;

//set configs
config.verbose=true;
config.port=8000;
config.root=__dirname+'/appRoot/';

//set listener to process body template
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

    //generate list items with the network interfaces
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

    //replace the {{some-content}} var in the body with the list created above
    body.value=body.value.replace('{{some-content}}',serverIPs);
}

//start the server
server.deploy(config);
