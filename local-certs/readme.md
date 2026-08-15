# Local TLS certificates

Private keys are intentionally not stored in this repository or published with the npm package. Generate disposable development certificates locally and never reuse them in production.

Run these commands from the repository root.

## Simple self-signed certificate

```sh
openssl genrsa -out local-certs/private/server.key 2048
openssl req -new -x509 -key local-certs/private/server.key -out local-certs/server.pub -days 30 -config local-certs/private/openssl.cnf
```

This creates the paths used by most HTTPS examples:

- `local-certs/private/server.key`
- `local-certs/server.pub`

## Local certificate authority

```sh
openssl genrsa -out local-certs/private/rootCA.key 2048
openssl req -x509 -new -nodes -key local-certs/private/rootCA.key -sha256 -days 30 -out local-certs/private/rootCA.pem
openssl genrsa -out local-certs/private/server.key 2048
openssl req -new -key local-certs/private/server.key -out local-certs/private/server.csr -config local-certs/private/openssl.cnf
openssl x509 -req -in local-certs/private/server.csr -CA local-certs/private/rootCA.pem -CAkey local-certs/private/rootCA.key -CAcreateserial -out local-certs/client.crt -days 30 -sha256 -extfile local-certs/private/openssl.cnf -extensions v3_req
```

The repository ignores all generated key and certificate material. Treat generated private keys as secrets even when they are only for localhost.
