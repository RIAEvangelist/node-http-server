var server=require('../../server/http.js');

server.deploy(
    {
        verbose: true,
        port: 6174,
        root:'./example/basic/basicApp/'
    }
);
