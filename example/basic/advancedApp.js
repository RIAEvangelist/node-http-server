var server=require('../../server/http.js');

var config=new server.Config;
config.errors['404']    = 'These are not the files you are looking for...';
config.contentType.mp4  = 'video/mp4';
config.port             = 8005;
config.verbose          = true;
config.root             = __dirname+'/appRoot/';

server.deploy(config);

console.log(server);
