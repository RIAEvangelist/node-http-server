var os = require('os');
var server=require('../../server/http.js');

console.log(os.networkInterfaces());

server.deploy(
    {
        verbose: true,
        port: 6174,
        root:'./example/basicStatic/basicApp/'
    }
);
