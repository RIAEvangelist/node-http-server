## Node HTTP and HTTPS Server examples

All of the http example servers spin up on port 8000 so you can only run one at a time.

And All of the https examples 4433 so you can only run one at a time, it is also worth noting that many of the https examples spin up both an http AND an https server. So both 8000 and 4433 will be used. This is for demonstration purposes and you can specify only to spin up a secure server with ` config.https.only=true ` or by setting it in your config object;

The servers in the [basic server folder](https://github.com/RIAEvangelist/node-http-server/tree/master/example/basic) are just static file servers, and the servers in the [advanced server folder](https://github.com/RIAEvangelist/node-http-server/tree/master/example) are dynamic server side rendering examples.
