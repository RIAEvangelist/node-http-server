'use strict';

const http2=require('node:http2'),
    https=require('node:https'),
    fs=require('node:fs/promises'),
    path=require('node:path');

// Start ../proxy/https-and-http-basic.js in another terminal first.
// Usage: node example/advanced/https-http2-client.js [origin] [CA-file]
// See ../readme.md for the matching local certificate setup.
main().catch(reportFailure);

async function main(){
    const origin=process.argv[2] || 'https://127.0.0.1:4433';
    const certificate=process.argv[3] || path.join(__dirname,'../../local-certs/server.pub');
    console.log(`Requesting ${origin} with HTTP/2 and HTTP/1.1 clients.`);

    // Read the shared certificate once. The native TLS client checks the
    // certificate and hostname using this local certificate as its CA.
    const ca=await fs.readFile(certificate);
    const session=http2.connect(
        origin,
        {ca}
    );
    const sessionClosed=new Promise(
        function observeSessionClose(resolve){
            session.once('close',resolve);
        }
    );
    session.on('error',reportFailure);

    try {
        const requestPaths=[
            '/one?request=1',
            '/two?request=2',
            '/three?request=3'
        ];

        // All three streams belong to this one session. Start every independent
        // request before waiting, including the HTTP/1.1 request to the same port.
        const requests=requestPaths.map(
            function startHttp2Request(requestPath){
                return requestHttp2(session,requestPath).then(printResponse);
            }
        );
        requests.push(requestHttp1(origin,ca).then(printResponse));

        // One failed request must not conceal the other requests' responses.
        const results=await Promise.allSettled(requests);
        for(const result of results){
            if(result.status==='rejected'){
                reportFailure(result.reason);
            }
        }
    } finally {
        if(!session.closed && !session.destroyed){
            session.close();
        }
        await sessionClosed;
    }
}

function requestHttp2(session,requestPath){
    return new Promise(
        function collectHttp2Response(resolve,reject){
            const request=session.request(
                {
                    ':path':requestPath
                }
            );
            let headers;
            let body='';
            let settled=false;

            function failHttp2Response(error){
                if(settled){
                    return;
                }
                settled=true;
                // Preserve any received content while identifying an incomplete response.
                printResponse(
                    {
                        client:'node:http2',
                        path:requestPath,
                        streamId:request.id,
                        complete:false,
                        headers:headers,
                        body:body
                    }
                );
                reject(error);
            }

            request.setEncoding('utf8');
            request.once('error',failHttp2Response);
            request.once(
                'response',
                function receiveHttp2Headers(responseHeaders){
                    headers=responseHeaders;
                }
            );
            request.on(
                'data',
                function receiveHttp2Content(content){
                    body+=content;
                }
            );
            request.once(
                'end',
                function completeHttp2Response(){
                    if(settled){
                        return;
                    }
                    if(!headers || (request.rstCode!==undefined && request.rstCode!==http2.constants.NGHTTP2_NO_ERROR)){
                        failHttp2Response(new Error(`HTTP/2 response ended without completion: ${requestPath}`));
                        return;
                    }
                    settled=true;
                    resolve(
                        {
                            client:'node:http2',
                            alpnProtocol:session.alpnProtocol,
                            path:requestPath,
                            streamId:request.id,
                            complete:true,
                            status:headers[':status'],
                            headers:headers,
                            body:body
                        }
                    );
                }
            );
            request.once(
                'close',
                function closeHttp2Response(){
                    if(!settled){
                        failHttp2Response(new Error(`HTTP/2 response closed before completion: ${requestPath}`));
                    }
                }
            );
            request.end();
        }
    );
}

function requestHttp1(origin,ca){
    return new Promise(
        function collectHttp1Response(resolve,reject){
            const target=new URL('/one?request=http1',origin);
            const request=https.get(
                target,
                {
                    ca:ca,
                    ALPNProtocols:['http/1.1'],
                    agent:false
                },
                function receiveHttp1Response(response){
                    const alpnProtocol=response.socket.alpnProtocol;
                    let body='';
                    let settled=false;

                    function failHttp1Response(error){
                        if(settled){
                            return;
                        }
                        settled=true;
                        printResponse(
                            {
                                client:'node:https',
                                path:target.pathname+target.search,
                                complete:false,
                                headers:response.headers,
                                body:body
                            }
                        );
                        reject(error);
                    }

                    response.setEncoding('utf8');
                    response.once('error',failHttp1Response);
                    response.on(
                        'data',
                        function receiveHttp1Content(content){
                            body+=content;
                        }
                    );
                    response.once(
                        'end',
                        function completeHttp1Response(){
                            if(settled){
                                return;
                            }
                            settled=true;
                            resolve(
                                {
                                    client:'node:https',
                                    alpnProtocol:alpnProtocol,
                                    httpVersion:response.httpVersion,
                                    path:target.pathname+target.search,
                                    complete:true,
                                    status:response.statusCode,
                                    headers:response.headers,
                                    body:body
                                }
                            );
                        }
                    );
                    response.once(
                        'close',
                        function closeHttp1Response(){
                            if(!settled){
                                failHttp1Response(new Error(`HTTP/1.1 response closed before completion: ${target}`));
                            }
                        }
                    );
                }
            );
            request.once('error',reject);
        }
    );
}

function printResponse(response){
    // Stringify explicitly so console inspection does not abbreviate the body.
    console.log(JSON.stringify(response,null,2));
}

function reportFailure(error){
    console.error(error);
    process.exitCode=1;
}
