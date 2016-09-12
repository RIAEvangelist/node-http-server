const util = require( 'util' );
const server=require('../../server/http.js');
//I am using request for simplicty sake here, you can too.
const proxy=require('request');
const config=new server.Config;

config.verbose=true;
config.port=8000;
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

//lets ignore ssl issues and make a giant security hole since we are proxying https too...
//be careful when proxying ssl. you should actually set your ca and certs properly.
//this is just an example
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function gotRequest(request,response,serve){
    //google proxy!
    console.log(request.uri,request.headers);

    serve(
        request,
        response,
        JSON.stringify(
            {
                uri:request.uri,
                headers:request.headers
            }
        )
    );

    return true;
}

server.deploy(config);
server.onRawRequest=gotRequest;
