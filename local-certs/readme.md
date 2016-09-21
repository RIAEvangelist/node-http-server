# Using TLS and SSL for Secure server

### document in progress
Still working on this. If you look at the examples and can help, please jump right in.

### Simple Self Signed Certificates

```sh

#generate you server key
openssl genrsa -out server.key 2048

#generate the server public key or client cert
openssl req -new -x509 -key server.key -out server.pub -days 365 -config openssl.cnf

```

### Creating Your Own Certificate Authority And Signing Your Cert With it.
```sh

#generate the CA key
openssl genrsa -out rootCA.key 2048

#self sign the CA key
openssl req -x509 -new -nodes -key rootCA.key -sha256 -days 1024 -out rootCA.pem

#generate you server key
openssl genrsa -out server.key 2048

#create your certificate signing request
openssl req -new -key server.key -out server.csr

#generate the server public key or client cert
openssl x509 -req -in server.csr -CA rootCA.pem -CAkey rootCA.key -CAcreateserial -out client.crt -days 500 -sha256


```


***need to add info on openssl.cnf edits**


#### using the local certs
This should **ONLY** be done on your local machine. Both the public and private certs are available here on git hub, so its not a good idea to use them over the network.

#### talk about security
- keep private keys private, don't share

#### talk about using hostname not ip for best security validation of certs
