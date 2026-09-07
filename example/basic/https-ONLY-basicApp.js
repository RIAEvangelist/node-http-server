//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

// HTTPS negotiates HTTP/2 or HTTP/1.1 on the same port, even with only:true.
// Generate the certificate paths first; see ../readme.md.
server.deploy(
    {
        verbose: true,
        port: 8000,
        root:__dirname+'/appRoot/',
        https:{
            // Set http2:false before deploy to use the original https.Server.
            http2:true,
            privateKey:`${__dirname}/../../local-certs/private/server.key`,
            certificate:`${__dirname}/../../local-certs/server.pub`,
            port:4433,
            // Skip the separate plain HTTP listener, not HTTP/1.1 over TLS.
            only:true
        }
    }
);
