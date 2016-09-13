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
process.env.NODE_TLS_REJECT_UNAUTHORIZED = 0;

function gotRequest(request,response,serve){
    //google proxy!
    //handle things fast
    let encoding='binary';

    proxy(
        {
            url: `${request.uri.protocol}://www.google.com${request.uri.path}${request.uri.search}`,
            encoding:encoding
        },
        function (error, proxiedResponse, proxiedBody) {
            if (error) {
                request.statusCode=500;
                serve(request,response,JSON.stringify(error));
                return;
            }

            if(!proxiedResponse.headers['content-type']&&proxiedResponse.headers['Content-Type']){
                proxiedResponse.headers['content-type']=proxiedResponse.headers['Content-Type'];
            }

            if(!proxiedResponse.headers['content-type']){
                proxiedResponse.headers['content-type']='';
            }

            if(proxiedResponse.headers['content-type'].indexOf('text/html')>-1){
                const position=proxiedBody.match(/<body([^>]*)>/i);

                if(position&&position.index){
                    proxiedBody=proxiedBody.slice(0, position.index+position[0].length) + `
                        <style>
                            .proxyBanner{
                                height:5em;
                                background:rgb(200,220,240);
                                font-size:2em;
                                line-height:5em;
                                box-shadow:0 0 .5em rgba(0,0,0,.7);
                                text-align:center;
                            }
                        </style>
                        <section class='proxyBanner'>Welcome to Google!</section>
                    `+ proxiedBody.slice(position.index+position[0].length)
                }
            }

            response.headers=proxiedResponse.headers;

            serve(request,response,proxiedBody);

            return;
        }
    );

    return true;
}

server.deploy(config);
server.onRawRequest=gotRequest;
