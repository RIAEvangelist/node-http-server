# Migrating to node-http-server v10

The v9-to-v10 upgrade changes the default native HTTPS listener to support HTTP/2. The earlier v8-to-v9 guidance remains below for applications upgrading across both versions.

## HTTP/2 defaults in 10.0.0

Configured HTTPS now uses Node's `Http2SecureServer` with HTTP/1.1 compatibility enabled. TLS negotiates HTTP/2 or HTTP/1.1 on the same port before requests begin. Existing key and certificate paths continue to configure HTTPS; the CLI and plain HTTP listener remain HTTP/1.1. Node.js 22.12 remains the minimum version, and no runtime dependency is added.

`https.http2` defaults to `true`. Set `https.http2:false` alongside the existing certificate configuration when an application requires the original `https.Server` listener or HTTP/1-specific native APIs. `https.only` still controls whether a separate plain HTTP listener starts; it does not select the HTTP version.

The hook names and takeover contract remain the same. HTTP/2 requests use Node's compatibility request/response objects. Use their public APIs and HTTP/2-compatible headers; raw HTTP/1 socket writes and connection-specific headers such as `Connection` and `Transfer-Encoding` cannot serve an HTTP/2 stream. `request.httpVersionMajor` identifies the negotiated request protocol.

Virtual hosts use HTTP/2 `:authority` or HTTP/1 Host values. Complete HTTP/2 request bodies reach the existing body fields without requiring `Content-Length`. Static streaming, ranges, conditional caching, compression, and manual serving share the existing pipeline.

`server.timeout` controls HTTP/2 session inactivity as well as HTTP/1 socket inactivity. `requestTimeout`, `headersTimeout`, and `keepAliveTimeout` apply only to HTTP/1 connections, including HTTPS fallback connections. They do not create HTTP/2 stream deadlines. `close()` gracefully closes HTTP/2 sessions after their active streams finish, and `lastError` includes captured HTTP/2 session failures.

See the [HTTPS guide](https://riaevangelist.github.io/node-http-server/https.html) and [Node's compatibility API](https://nodejs.org/api/http2.html#compatibility-api) for the listener and hook contracts.

## Earlier v8-to-v9 migration

The remaining sections describe the v8-to-v9 changes. Version 9 kept native HTTP and HTTPS listeners, the small server surface, default singleton, hooks, and `key=value` CLI. Its major changes made network exposure explicit, isolated multiple servers, and brought static delivery behavior up to date.

## Runtime

- Use Node.js 22.12 or newer.
- Install normally with `npm install node-http-server`.
- Published installs have zero runtime dependencies. The repository uses the exact owner-maintained `vanilla-test@2.1.1` release as its sole direct development dependency for native V8 coverage.
- CommonJS and ESM are Node.js module entry points, not browser entry points. No transpiler or TypeScript toolchain is needed.
- node-http-server is Node.js-only; native-browser execution, import maps, and browser-bundler conformance are not applicable. It serves files to browsers; the package itself does not execute in browsers. Browser-targeted bundles and `file://` are not supported runtime paths.

## CommonJS and ESM

The v8 singleton still works:

```js
const server=require('node-http-server');
server.deploy({root:'./public'});
```

ESM can use the same default shape:

```js
import server from 'node-http-server';
server.deploy({root:'./public'});
```

For new code, prefer an isolated named `Server` instance:

```js
import {Server} from 'node-http-server';

const server=new Server({
    root:'./public',
    port:8080
});

server.deploy();
```

`Server`, `Config`, and `RefString` are named exports in both module systems.

## Localhost is the new default

v8 did not pass a host to `listen()`, so Node accepted connections on available interfaces. v9 listens on `127.0.0.1` unless configured otherwise.

For a deliberately public or LAN-accessible server:

```js
new Server({
    host:'0.0.0.0',
    port:8080,
    root:'./public'
}).deploy();
```

`host` now controls the network interface. `domain` and `domains` only select accepted Host values and static roots. Audit firewall, authentication, TLS, and request-limit requirements before changing the host.

## Multiple servers and shutdown

Give each unrelated listener set its own `Server` instance:

```js
const {Server}=require('node-http-server');

const first=new Server({port:8080,root:'./one'}).deploy();
const second=new Server({port:8081,root:'./two'}).deploy();

await Promise.all([
    first.close(),
    second.close()
]);
```

`deploy()` now returns its instance. `close(callback?)` closes its HTTP and HTTPS listeners, returns a Promise, and leaves the instance ready for a later `deploy()`.

The optional deploy callback still receives the server instance. When HTTP and HTTPS are both configured, it runs as each listener becomes ready.

## Configuration changes

| v8 behavior | v9 replacement |
|---|---|
| Listen interface left to Node | `host:'127.0.0.1'` by default; set `host` explicitly to expose it |
| `Config` reads every process argument | Only the CLI parses arguments; programmatic `Config` is deterministic |
| Shallow nested assignment | Known nested objects merge into isolated defaults |
| Unknown extension returns `415` | Unknown extension uses `application/octet-stream` |
| Dotfiles are served | Dot-prefixed path segments return `403` unless `server.allowDotfiles:true` |
| Shared or mutable default objects | Every `Config` and `Server` owns a deep copy |
| No request-body limit | `server.maxRequestBodyBytes` is opt-in and set in bytes |
| No clean listener lifecycle | `await server.close()` |

The current server defaults are:

```js
{
    host:'127.0.0.1',
    port:8080,
    root:process.cwd(),
    server:{
        index:'index.html',
        noCache:true,
        allowDotfiles:false,
        timeout:30000,
        requestTimeout:300000,
        headersTimeout:60000,
        keepAliveTimeout:5000,
        maxRequestBodyBytes:false,
        compression:false,
        compressionThreshold:1024,
        spaFallback:false
    }
}
```

Timeout values are milliseconds. `false` or `0` disables an individual timeout. `maxRequestBodyBytes:false` or `0` leaves the body unlimited. Public deployments should set a finite body limit that matches the application.

### MIME configuration

A `contentType` object now overlays the built-in map instead of forcing you to reproduce it:

```js
new Server({
    contentType:{
        custom:'application/x-custom'
    }
});
```

Set `contentType:false` to remove automatic MIME mapping from the active configuration. Files then use `application/octet-stream` unless your hook sets a type. An extension explicitly set to `false` returns `415`.

## Static response behavior

The fallback file server now handles:

- `GET` and `HEAD`;
- streaming files;
- one satisfiable `GET` byte range with `206`, and `416` for valid but unsatisfiable ranges;
- weak ETags and `Last-Modified` validation;
- `304 Not Modified`;
- optional Brotli/gzip compression; and
- optional SPA fallback.

Unsupported methods run the request hooks, then receive `405` if no hook takes ownership. Code that accidentally depended on the old server treating every method like `GET` must move that behavior into `onRequest`.

Malformed, unsupported-unit, and multi-range headers are ignored and receive the full `200` response. `HEAD` ignores Range and mirrors full `GET` headers without a body.

## Replace old certificate fixtures

The local certificate and private-key fixtures tracked by older releases were removed. Any copy obtained from v8, an old package, or repository history is public and untrusted. Never deploy with it.

Generate a new development certificate when one is needed, use certificates and keys managed for the actual environment in production, and keep private keys out of source control.

## Hook compatibility

The hook names and truthy takeover contract remain:

```text
onRawRequest(request, response, serve)
onRequest(request, response, serve)
beforeServe(request, response, bodyRef, encodingRef, serve)
afterServe(request, response)
```

Existing `afterServe(request)` functions continue to work; v9 supplies an additional response argument.

`request.body` remains a UTF-8 string. Use `request.bodyBuffer` when the original bytes matter.

Static files stream when the default `beforeServe` method is untouched. Assigning or overriding `beforeServe` selects the buffered compatibility path so existing body replacement code can still modify `bodyRef.value`.

## CLI migration

The v8 form remains valid:

```sh
node-http-server port=9000 root=./public verbose=true
```

The preferred v9 form is:

```sh
node-http-server --port 9000 --root ./public --verbose
```

Run `node-http-server --help` for the complete option list. CLI parsing no longer leaks into code that imports `Config`.

## Upgrade checklist

1. Upgrade Node.js to 22.12 or newer.
2. Decide whether localhost-only is correct. Add `host` only when network access is intended.
3. Move repeated singleton deployments to separate `Server` instances.
4. Await `close()` during tests and graceful shutdown.
5. Set a finite request-body limit for an exposed service.
6. Review custom `beforeServe` hooks because they intentionally buffer static files.
7. Update tests for `HEAD`, `405`, binary fallback, ranges, and conditional responses.
8. Keep custom CLI parsing outside `Config`.
9. Delete copied v8 certificate fixtures and replace them with newly managed credentials.
10. Keep dotfiles blocked, or explicitly audit the complete root before setting `server.allowDotfiles:true` / `--allow-dotfiles`.

See the [README](README.md) for the complete configuration and API contract and [SECURITY.md](SECURITY.md) for deployment guidance.
