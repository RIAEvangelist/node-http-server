var server=require('../../server/http.js');

var config=new server.Config;

console.log(config);

config.errors['404']    = 'These are not the files you are looking for...';
config.contentType.mp4  = 'video/mp4';
config.port             = 8005;
config.verbose          = true;
config.root             = __dirname+'/appRoot/';
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;
config.https.port       = 4433;

server.deploy(config);

console.log(server);
