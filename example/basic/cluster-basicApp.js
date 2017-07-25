//import the `node-http-server` module
//` const server=require(‘node-http-server’); `
const server=require('../../server/Server.js');

//import cluster
const cluster = require('cluster');
const numCPUs = require('os').cpus().length;

if (cluster.isMaster) {
  console.log(`Master ${process.pid} is running`);

  // Fork node-http-server cluster workers.
  for (let i = 0; i < numCPUs; i++) {
    cluster.fork();
  }

  cluster.on(
    'exit',
    (worker, code, signal) => {
      console.log(`worker ${worker.process.pid} died`);
    }
  );
} else {
  server.afterServe=(request)=>{
    console.log(`${process.pid} served ${request.uri.path}`);
  }

  //start server in clustered children
  server.deploy(
      {
          verbose: false,
          port: 8000,
          root:__dirname+'/appRoot/'
      }
  );

  console.log(`Worker ${process.pid} started listening on ${server.config.port}`);
}
