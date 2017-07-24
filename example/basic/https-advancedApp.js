//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

// instantiate ` config ` as a new ` server.config ` instance so we get all the defaults.
// This will allow us to perform deeper modifications without corrupting the default set.
const config=new server.Config;

//inspect the config
console.log(config);


//customize the 404 error body
config.errors['404']    = 'These are not the files you are looking for...';

//add support for mp4
config.contentType.mp4  = 'video/mp4';

//set the node server port to 8005
config.port             = 8005;

//set the server to be verbose so we can see detailed info on the server, it's requests and responses
config.verbose          = true;

//set the root public directory
config.root             = __dirname+'/appRoot/';

//set the node ssl privte key
config.https.privateKey = `${__dirname}/../../local-certs/private/server.key`;

//set the node ssl cert
config.https.certificate= `${__dirname}/../../local-certs/server.pub`;

//set the node ssl port
config.https.port       = 4433;

//start the server
server.deploy(config);

//take a look at the server instance
console.log(server);
