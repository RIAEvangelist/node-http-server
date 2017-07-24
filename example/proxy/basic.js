const util = require( 'util' );

//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//I am using request for simplicty sake here, you can too.
const proxy=require('request');
const config=new server.Config;

config.verbose=true;
config.port=8000;


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
