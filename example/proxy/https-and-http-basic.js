//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

const config=new server.Config;

config.verbose=true;
config.port=8000;
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

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

server.onRequest=gotRequest;
server.deploy(config);
