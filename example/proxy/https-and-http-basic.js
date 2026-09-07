// Echo requests through the same public hook over HTTP and HTTPS.
// For an installed application, require('node-http-server') uses this API.
const server=require('../../server/Server.js');

const config=new server.Config;

config.verbose=true;
config.port=8000;
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

// HTTP/2 with HTTP/1.1 negotiation is the default. Set this to false before
// deploy when an application needs the original native https.Server APIs.
config.https.http2=true;

async function gotRequest(request,response,serve){
    // request.uri is available in onRequest for both protocols. The raw hook
    // runs before these helpers and complete request bodies are populated.
    const details={
        uri:request.uri,
        headers:request.headers,
        httpVersion:request.httpVersion,
        httpVersionMajor:request.httpVersionMajor
    };

    // HTTP/1 requests have no HTTP/2 stream. Keep each response's state here,
    // rather than on a shared connection or server instance.
    if(request.httpVersionMajor===2){
        details.streamId=request.stream.id;
    }

    const body=JSON.stringify(details,null,2);
    console.log(body);

    // Use the compatibility response API and supplied continuation for either
    // protocol; do not write raw HTTP/1 data or connection headers to a stream.
    response.setHeader('Content-Type','application/json; charset=utf-8');
    await serve(
        request,
        response,
        body
    );

    return true;
}

server.onRequest=gotRequest;
server.deploy(config);

if(server.server){
    server.server.once('error',listenerFailed);
}
if(server.secureServer){
    server.secureServer.once('error',listenerFailed);
}
process.once('SIGINT',closeServer);
process.once('SIGTERM',closeServer);

async function listenerFailed(error){
    console.error(error);
    process.exitCode=1;
    await closeServer();
}

async function closeServer(){
    console.log('Closing HTTP and HTTPS listeners after active requests finish.');
    try {
        // The public close operation also closes the owned HTTP/2 sessions.
        await server.close();
        console.log('HTTP and HTTPS listeners closed.');
    } catch(error) {
        console.error(error);
        process.exitCode=1;
    }
}
