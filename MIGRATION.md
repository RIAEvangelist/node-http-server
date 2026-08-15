# Migrating from node-http-server v8 to v9

Version 9 keeps the small server, default singleton, hooks, HTTPS configuration, and `key=value` CLI. The major changes make network exposure explicit, isolate multiple servers, and bring static HTTP behavior up to date.

## Runtime

- Use Node.js 22.12 or newer.
- Install normally with `npm install node-http-server`.
- Published installs have zero runtime dependencies. The repository uses the exact owner-maintained `vanilla-test@2.0.0` release as its sole direct development dependency for coverage.
- CommonJS and ESM are both supported. No transpiler or TypeScript toolchain is needed.

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

Do not call `deploy()` repeatedly on the imported singleton to create unrelated listeners. Give each listener set its own instance:

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

Generate a new development certificate when one is needed, and use certificates and keys managed for the actual environment in production. Do not commit private keys.

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

See the [README](README.md) for the complete configuration and API contract and [SECURITY.md](SECURITY.md) for deployment guidance.
