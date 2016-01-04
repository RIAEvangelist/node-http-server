var os = require( 'os' );
var server=require('../../server/http.js');

console.log(server);

server.beforeServe=function(request,response,body,encoding){
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


    body.value=body.value.replace('{{server-ips}}',serverIPs);


}

server.deploy(
    {
        verbose: true,
        port: 8000,
        root:__dirname+'/appRoot/'
    }
);
