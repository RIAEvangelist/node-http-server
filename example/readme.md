## Node HTTP, HTTPS, and HTTP/2 examples

node-http-server is Node.js-only; native-browser execution, import maps, and browser-bundler conformance are not applicable. Every example in this directory is a Node.js program; any browser paths shown are content served by that program. CommonJS and ESM are Node.js module entry points, not browser entry points.

| Example group | What it demonstrates | Default ports |
|---|---|---|
| [Basic servers](https://github.com/RIAEvangelist/node-http-server/tree/main/example/basic) | Static roots, logging, domains, clustering, and HTTPS | HTTP `8000`; HTTPS `4433` |
| [Advanced servers](https://github.com/RIAEvangelist/node-http-server/tree/main/example/advanced) | Hooks, templates, dynamic responses, and benchmarks | HTTP `8000`; HTTPS `4433` |
| [Proxy examples](https://github.com/RIAEvangelist/node-http-server/tree/main/example/proxy) | Small request-forwarding examples built with Node APIs | Varies by example |
| [HTTP/2 and HTTP/1.1 on one HTTPS port](#http2-and-http11-on-one-https-port) | Protocol negotiation, native hooks, concurrent streams, and shutdown | HTTP `8000`; HTTPS `4433` |

Run only one example that uses a given port at a time. Some HTTPS examples start both HTTP and HTTPS listeners. Set `config.https.only=true` when the secure listener should run alone.

For a public deployment domain, use the [Let's Encrypt certificate walkthrough](https://riaevangelist.github.io/node-http-server/https.html#letsencrypt), including renewal and application restart. The session below uses a local development certificate.

### HTTP/2 and HTTP/1.1 on one HTTPS port

Use Node.js 22.12.0 or newer and run the commands below from the repository root. These examples are repository files; they are not included in the npm package.

Start with the existing [HTTPS echo server](https://github.com/RIAEvangelist/node-http-server/blob/main/example/proxy/https-and-http-basic.js) and the [HTTP/2 client](https://github.com/RIAEvangelist/node-http-server/blob/main/example/advanced/https-http2-client.js). The client uses built-in `node:http2` and `node:https` APIs.

For this local session, create the certificate paths described in the [local certificate guide](https://github.com/RIAEvangelist/node-http-server/blob/main/local-certs/readme.md). The `v3_req` extension in the existing configuration includes both `localhost` and `127.0.0.1`:

```sh
openssl genrsa -out local-certs/private/server.key 2048
openssl req -new -x509 -key local-certs/private/server.key -out local-certs/server.pub -days 30 -config local-certs/private/openssl.cnf -extensions v3_req -subj /CN=localhost
```

In the first terminal, start the server:

```sh
node example/proxy/https-and-http-basic.js
```

After its listeners are ready, run the client in a second terminal:

```sh
node example/advanced/https-http2-client.js
```

The default origin is `https://127.0.0.1:4433`. The client reads `local-certs/server.pub` once and supplies it through Node's native `ca` option. To use another HTTPS origin and its certificate authority file, pass them in that order:

```sh
node example/advanced/https-http2-client.js https://127.0.0.1:4433 ./local-certs/server.pub
```

Expected observations:

- Three HTTP/2 requests to `/one?request=1`, `/two?request=2`, and `/three?request=3` start concurrently on one session. Each has its own stream ID and complete response body; completion order may vary.
- An independent HTTP/1.1 request to `/one?request=http1` uses the same HTTPS port. The client prints the negotiated protocol, status, and complete body for each response.
- The echoed JSON retains the request URI and headers and adds the native `httpVersion` and `httpVersionMajor`. HTTP/2 echoes also include `streamId`; their headers include HTTP/2 pseudo-headers such as `:path` and `:authority`.
- The separate plain HTTP listener remains on port `8000`. `https.only:true` removes that listener; HTTP/1.1 fallback on the HTTPS port remains available.

The hook uses the same public `serve(request,response,body)` path for both protocols. Native objects differ: HTTP/1.1 uses `IncomingMessage` and `ServerResponse`, while HTTP/2 uses `Http2ServerRequest` and `Http2ServerResponse`. Use shared methods such as `response.setHeader()` and inspect `request.httpVersionMajor===2` before accessing `request.stream`. Do not send HTTP/1.1 connection-specific headers such as `Connection` or `Transfer-Encoding` through an HTTP/2 response. See [Node's HTTP/2 compatibility API](https://nodejs.org/docs/latest-v22.x/api/http2.html#compatibility-api) for the native differences.

To demonstrate an HTTPS listener limited to HTTP/1.1, replace the server example's current `http2` assignment with the following before its existing `deploy()` call:

```js
config.https.http2 = false;
```

Restart the server after changing its configuration. With HTTP/2 disabled, this client reports the HTTP/2 connection/request failure while its independent HTTP/1.1 request can still complete. Restore `http2:true` or remove the override to negotiate both protocols again.

The client closes its HTTP/2 session after its requests settle. Stop the server with Ctrl+C; its signal handler awaits `server.close()` to close the owned listeners and HTTP/2 sessions. Active requests may finish before shutdown completes.

### Text response hooks

The [advanced template, CSS, and request-timing examples](https://github.com/RIAEvangelist/node-http-server/tree/main/example/advanced) decode the static response Buffer with `body.value.toString('utf8')` before replacing text and set `encoding.value='utf8'` for the resulting string. Keep that conversion in the text hook; binary responses do not need text decoding.

See the [node-http-server documentation and playground](https://riaevangelist.github.io/node-http-server/) for current API, configuration, CLI, and copyable examples.
