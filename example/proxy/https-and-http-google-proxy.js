'use strict';

const https=require('node:https'),
    server=require('../../server/Server.js'),
    config=new server.Config;

config.verbose=true;
config.port=8000;
config.https.privateKey=`${__dirname}/../../local-certs/private/server.key`;
config.https.certificate=`${__dirname}/../../local-certs/client.crt`;
config.https.ca=`${__dirname}/../../local-certs/private/rootCA.pem`;
config.https.port=4433;

server.onRequest=gotRequest;
server.deploy(config);

function gotRequest(request,response,serve){
    const target=new URL(request.uri.path,'https://www.google.com');

    https.get(
        target,
        {
            headers:{
                'User-Agent':'node-http-server example proxy'
            },
            rejectUnauthorized:true
        },
        function(proxiedResponse){
            const chunks=[];

            proxiedResponse.on('data',chunk=>chunks.push(chunk));
            proxiedResponse.on(
                'end',
                function(){
                    const contentType=String(proxiedResponse.headers['content-type'] || 'application/octet-stream');
                    let proxiedBody=Buffer.concat(chunks);

                    response.statusCode=proxiedResponse.statusCode;
                    response.setHeader('Content-Type',contentType);

                    if(contentType.includes('text/html')){
                        const html=proxiedBody.toString('utf8');
                        proxiedBody=html.replace(
                            /<body([^>]*)>/i,
                            `$&
                            <style>
                                .proxyBanner{
                                    background:rgb(200,220,240);
                                    box-shadow:0 0 .5em rgba(0,0,0,.7);
                                    font-size:2em;
                                    line-height:5em;
                                    text-align:center;
                                }
                            </style>
                            <section class="proxyBanner">Welcome to Google!</section>`
                        );
                    }

                    serve(request,response,proxiedBody);
                }
            );
        }
    ).on(
        'error',
        function(err){
            response.statusCode=502;
            serve(request,response,`Proxy request failed: ${err.message}`);
        }
    );

    return true;
}
