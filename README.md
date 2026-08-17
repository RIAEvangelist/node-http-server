![node-http-server — small server, modern HTTP](assets/node-http-server-header.webp)

# node-http-server

[![CI](https://github.com/RIAEvangelist/node-http-server/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/RIAEvangelist/node-http-server/actions/workflows/ci.yml?query=branch%3Amain)
[![npm version](https://img.shields.io/npm/v/node-http-server.svg)](https://www.npmjs.com/package/node-http-server)
[![npm downloads](https://img.shields.io/npm/dm/node-http-server.svg)](https://www.npmjs.com/package/node-http-server)
[![license](https://img.shields.io/github/license/RIAEvangelist/node-http-server.svg)](https://github.com/RIAEvangelist/node-http-server/blob/main/licence)
[![supported Node.js version](https://img.shields.io/node/v/node-http-server.svg)](https://github.com/RIAEvangelist/node-http-server/blob/main/package.json)
[![runtime dependencies](https://img.shields.io/badge/runtime_dependencies-0-2ea44f)](https://github.com/RIAEvangelist/node-http-server/blob/main/package.json)
[![line coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FRIAEvangelist%2Fnode-http-server%2Fmain%2Fbadges%2Flines.json)](https://riaevangelist.github.io/node-http-server/coverage/node/)
[![function coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FRIAEvangelist%2Fnode-http-server%2Fmain%2Fbadges%2Ffunctions.json)](https://riaevangelist.github.io/node-http-server/coverage/node/)
[![branch coverage](https://img.shields.io/endpoint?url=https%3A%2F%2Fraw.githubusercontent.com%2FRIAEvangelist%2Fnode-http-server%2Fmain%2Fbadges%2Fbranches.json)](https://riaevangelist.github.io/node-http-server/coverage/node/)

[Start](https://riaevangelist.github.io/node-http-server/) · [Docs hub](https://riaevangelist.github.io/node-http-server/guide.html) · [CLI](https://riaevangelist.github.io/node-http-server/cli.html) · [Library API](https://riaevangelist.github.io/node-http-server/api.html) · [Configuration](https://riaevangelist.github.io/node-http-server/configuration.html) · [Examples](https://riaevangelist.github.io/node-http-server/examples.html) · [Playground](https://riaevangelist.github.io/node-http-server/playground.html) · [Testing](https://riaevangelist.github.io/node-http-server/testing.html) · [Benchmarks](https://riaevangelist.github.io/node-http-server/benchmarks.html) · [Operations](https://riaevangelist.github.io/node-http-server/operations.html)

[![Sponsor RIAEvangelist to help development of node-http-server](https://img.shields.io/static/v1?label=Sponsor%20Me%20On%20GitHub&message=%E2%9D%A4&logo=GitHub)](https://github.com/sponsors/RIAEvangelist)

A small HTTP and HTTPS static server for Node.js. It has zero runtime dependencies, works from CommonJS and ESM, and binds to localhost by default. The sole direct development dependency is the owner-maintained `vanilla-test@2.1.1`, used for project-owned native V8 coverage.

Version 9 is a focused static-server toolkit with streaming files, clean multi-server lifecycle, modern cache and range behavior, optional compression and SPA fallback, configurable request limits, and strict root containment.

## Install

```sh
npm install node-http-server
```

Node.js 22.12 or newer is required.

## Start a server

### CommonJS

```js
const {Server}=require('node-http-server');

const server=new Server({
    root:'./public',
    port:8080
});

server.deploy();
```

### ESM

```js
import {Server} from 'node-http-server';

const server=new Server({
    root:'./public',
    port:8080
});

server.deploy();
```

Both module systems also expose the original default singleton:

```js
// CommonJS
const server=require('node-http-server');
server.deploy({root:'./public'});
```

```js
// ESM
import server from 'node-http-server';
server.deploy({root:'./public'});
```

The default address is `http://127.0.0.1:8080`. Set `host:'0.0.0.0'` only when other machines should be able to connect.

| Module style | Default export | Named exports |
|---|---|---|
| CommonJS | `require('node-http-server')` | `Server`, `Config`, `RefString` |
| ESM | `import server from 'node-http-server'` | `Server`, `Config`, `RefString` |

## CLI

Install globally when you want the command everywhere:

```sh
npm install --global node-http-server
node-http-server --root ./public --port 8080
```

Or run the package directly through npm:

```sh
npx node-http-server --root ./public
```

| Option | Purpose |
|---|---|
| `-p, --port <port>` | HTTP port; default `8080` |
| `-r, --root <path>` | Static root; default current directory |
| `--host <address>` | Listen address; default `127.0.0.1` |
| `--domain <hostname>` | Expected primary Host value |
| `--index <file>` | Directory index; default `index.html` |
| `--no-cache` | Send no-cache response directives |
| `--cache` | Allow client caching |
| `--allow-dotfiles` | Allow dot-prefixed path segments; blocked by default |
| `--spa[=<file>]` | Enable SPA fallback; optional fallback file |
| `--compression` | Enable negotiated Brotli or gzip responses |
| `--max-body <bytes or false>` | Set the request-body limit; `false`, `off`, or `0` is unlimited |
| `--timeout <ms or false>` | Set the socket inactivity timeout; `false`, `off`, or `0` disables |
| `--request-timeout <ms or false>` | Set the complete-request timeout; `false`, `off`, or `0` disables |
| `--headers-timeout <ms or false>` | Set the request-header timeout; `false`, `off`, or `0` disables |
| `--keep-alive-timeout <ms or false>` | Set the keep-alive timeout; `false`, `off`, or `0` disables |
| `--log <path>` | Append request records as NDJSON |
| `-v, --verbose` | Print server activity |
| `-h, --help` | Print command help |
| `--version` | Print the package version |

The v8 `key=value` form still works:

```sh
node-http-server root=./public port=9000 verbose=true
```

### CLI examples

| Use | Command |
|---|---|
| Serve the current directory locally | `node-http-server` |
| Serve another directory | `node-http-server --root ./public` |
| Use a different local port | `node-http-server --port 9000` |
| Accept LAN/network connections | `node-http-server --host 0.0.0.0` |
| Enable SPA fallback and compression | `node-http-server --spa --compression` |
| Use a custom SPA entry | `node-http-server --spa=app.html` |
| Limit bodies to 1 MiB | `node-http-server --max-body 1048576` |
| Disable the request timeout | `node-http-server --request-timeout false` |
| Disable socket inactivity timeout | `node-http-server --timeout false` |
| Allow client caching | `node-http-server --cache` |
| Deliberately serve `/.well-known` | `node-http-server --root ./public --allow-dotfiles` |
| Write NDJSON request logs | `node-http-server --log ./requests.ndjson` |

Use the module API for HTTPS certificates, virtual hosts, hooks, and custom configuration functions.

## Server lifecycle

`deploy(config?, readyCallback?)` starts the configured HTTP listener and optional HTTPS listener, then returns the `Server` instance. The callback receives the instance and its ready Node listener. It runs once for each listener when both protocols are enabled.

`close(callback?)` closes every listener owned by the instance and returns a Promise. The same instance can be deployed again after it closes.

```js
import {Server} from 'node-http-server';

const publicServer=new Server({
    port:8080,
    root:'./public'
}).deploy();

const previewServer=new Server({
    port:8081,
    root:'./preview'
}).deploy();

process.once(
    'SIGTERM',
    async()=>{
        await Promise.all([
            publicServer.close(),
            previewServer.close()
        ]);
    }
);
```

Each `Server` owns isolated configuration and listener state. The active Node listeners remain available as `server.server` and, when configured, `server.secureServer`.

### Server API

| Member | Returns | Purpose |
|---|---|---|
| `deploy(config?, callback?)` | `Server` | Start the instance's HTTP and optional HTTPS listeners |
| `close(callback?)` | `Promise<void>` | Close every listener owned by the instance |
| `address()` | address object or `null` | Read the first active listener address |
| `serve(request, response, body?, encoding?)` | `Promise` | Complete a manual response through `beforeServe` |
| `serveFile(filename, request, response)` | `Promise<boolean>` | Serve a deliberate file from custom code |
| `config` | `Config` | Isolated active configuration |
| `server` | Node HTTP server or `null` | Active HTTP listener |
| `secureServer` | Node HTTPS server or `null` | Active HTTPS listener |
| `lastError` | error or `null` | Last captured request, hook, stream, or logging error |

Node listener errors keep Node's native event contract. Attach an error handler after `deploy()` when the application needs to handle bind failures:

```js
server.deploy();
server.server.once('error',error=>console.error(error));
```

Attach the same handler to `server.secureServer` when HTTPS also runs. `serveFile()` trusts its filename and is a deliberate escape hatch from automatic routing policies, including dotfile blocking; never pass unvalidated request input to it.

## Configuration

Pass configuration to `new Server(config)` or `server.deploy(config)`. Known nested objects merge with isolated defaults, so changing one instance never changes another. Unsafe prototype keys are rejected.

```js
const config={
    host:'127.0.0.1',
    port:8080,
    root:'./public',
    verbose:false,
    server:{
        index:'index.html',
        noCache:false,
        allowDotfiles:false,
        maxRequestBodyBytes:1024*1024,
        compression:true,
        compressionThreshold:1024,
        spaFallback:false
    }
};
```

### Top-level values

| Key | Default | Description |
|---|---|---|
| `host` | `'127.0.0.1'` | Address used by `listen()` |
| `port` | `8080` | HTTP port |
| `root` | `process.cwd()` | Static file root |
| `domain` | `'0.0.0.0'` | Legacy primary Host check; `host` controls the listen address |
| `domains` | `{}` | Additional hostname-to-root mappings |
| `verbose` | `false` | Console activity output |
| `log` | `false` | NDJSON log path, or `false` to disable request logging |
| `logFunction` | built-in logger | Function used when `log` is enabled |
| `logBody` | `false` | Include the UTF-8 request body in custom/default log records |
| `contentType` | built-in map | MIME overrides/additions, or `false` to disable automatic mapping |
| `restrictedType` | `{}` | Extension keys that should return `403` |
| `errors` | built-in responses | Error headers and bodies for `400`, `403`, `404`, `405`, `413`, `415`, `416`, `421`, and `500` |
| `https` | disabled | HTTPS certificate and listener configuration |
| `server` | shown below | HTTP behavior and timeout settings |

### `server` values

| Key | Default | Description |
|---|---|---|
| `index` | `'index.html'` | File used for directory requests |
| `noCache` | `true` | Send no-cache response directives |
| `allowDotfiles` | `false` | Allow any dot-prefixed path segment; only literal `true` opts in |
| `timeout` | `30000` | Socket inactivity timeout in milliseconds |
| `requestTimeout` | `300000` | Complete-request timeout in milliseconds |
| `headersTimeout` | `60000` | Request-header timeout in milliseconds |
| `keepAliveTimeout` | `5000` | Keep-alive timeout in milliseconds |
| `maxRequestBodyBytes` | `false` | Maximum body size in bytes; `false`, `null`, or `0` means unlimited |
| `compression` | `false` | Negotiate Brotli or gzip for eligible responses |
| `compressionThreshold` | `1024` | Minimum uncompressed size in bytes |
| `spaFallback` | `false` | `true` uses `server.index`; a string selects another fallback file |

Every timeout accepts a nonnegative millisecond value. Programmatic configuration accepts `false`, `null`, or `0` to disable it. Limits and compression stay under your control; no request-body limit or compression is enabled by default.

### Disable and opt-out values

| Setting | `false` | `null` | `0` |
|---|---|---|---|
| `server.timeout` | Disabled | Disabled | Disabled |
| `server.requestTimeout` | Disabled | Disabled | Disabled |
| `server.headersTimeout` | Disabled | Disabled | Disabled |
| `server.keepAliveTimeout` | Disabled | Disabled | Disabled |
| `server.maxRequestBodyBytes` | Unlimited | Unlimited | Unlimited |
| `server.allowDotfiles` | Dotfiles blocked | Invalid | Invalid |
| `contentType` | Automatic MIME map removed; files use `application/octet-stream` | Not a supported map value | Not a supported map value |

Deployment validates port ranges, requires a nonempty listen address, verifies static roots, and rejects negative timeout or limit values before opening a listener.

### `Config`

`new Config(values?)` creates an isolated configuration. `config.merge(values)` safely merges another set and returns the same instance. `Config.defaults` and `Config.mimeTypes` each return a fresh copy.

The configuration and MIME map also have explicit package subpaths:

```js
// CommonJS
const Config=require('node-http-server/config');
const contentTypes=require('node-http-server/mime-types');
```

```js
// ESM
import Config from 'node-http-server/config';
import contentTypes from 'node-http-server/mime-types';
```

### Built-in modern MIME types

The built-in MIME map is isolated in the small `server/MimeTypes.js` file. A `contentType` object adds or overrides entries:

```js
new Server({
    contentType:{
        md:'text/markdown; charset=utf-8'
    }
});
```

Unknown extensions use `application/octet-stream`. Set `contentType:false` to remove the map from the active configuration; static files then use the same safe binary fallback unless a hook sets another type. Set one extension to `false` inside the map when that extension should return `415 Unsupported Media Type`.

### HTTPS

| Key | Default | Description |
|---|---|---|
| `https.ca` | `''` | Optional CA certificate path |
| `https.privateKey` | `''` | Private-key path |
| `https.certificate` | `''` | Certificate path |
| `https.passphrase` | `false` | Optional private-key passphrase |
| `https.port` | `443` | HTTPS port |
| `https.only` | `false` | Skip the HTTP listener when HTTPS is configured |

```js
const secureServer=new Server({
    host:'127.0.0.1',
    https:{
        privateKey:'/path/to/private.key',
        certificate:'/path/to/certificate.pem',
        ca:'/path/to/ca.pem',
        passphrase:false,
        port:8443,
        only:true
    }
});

secureServer.deploy();
```

Leave `only:false` to run HTTP and HTTPS together. `close()` closes both listeners.

### Multiple domains

```js
new Server({
    root:'./www/default',
    domain:'example.test',
    domains:{
        'docs.example.test':'./www/docs',
        'app.example.test':'./www/app'
    }
}).deploy();
```

`host` decides which network interface listens. `domain` and `domains` decide which Host headers and roots the server accepts. A wildcard primary `domain` (`'0.0.0.0'` or `'*'`) selects the primary root before the `domains` map; set a non-wildcard primary domain when using virtual hosts.

### Error responses and extension controls

| Setting | Shape | Purpose |
|---|---|---|
| `errors.headers` | header object | Headers added to built-in error responses |
| `errors[status]` | string | Body for `400`, `403`, `404`, `405`, `413`, `415`, `416`, `421`, or `500` |
| `restrictedType` | `{extension:true}` | Return `403` for selected extensions |
| `contentType` entry | `{extension:false}` | Return `415` for one selected extension |
| `domains` | `{hostname:root}` | Map accepted Host values to isolated static roots |

## Static HTTP behavior

- `GET` streams files instead of loading every file into memory.
- `HEAD` returns the same status and headers with an empty response body.
- Other methods reach the hooks first, then receive `405 Method Not Allowed` from the static fallback.
- A satisfiable single `GET` byte range returns `206 Partial Content`; a valid but unsatisfiable range returns `416`.
- Malformed, unsupported-unit, and multi-range headers are ignored, so the response remains a full `200`. `HEAD` ignores Range and mirrors the full `GET` headers with an empty body.
- Weak ETags and `Last-Modified` support conditional `304 Not Modified` responses.
- Automatic compression negotiates Brotli or gzip for eligible static responses when enabled, accepted by the client, above the threshold, and outside byte-range handling. Manual `serve()` responses retain their caller-selected encoding.
- SPA fallback is off by default. When enabled, an extensionless missing path that accepts HTML falls back to the configured index or root-relative filename.
- Requested paths are decoded and resolved inside the configured root. Traversal and filesystem escapes are rejected.
- Dot-prefixed path segments return `403` before filesystem lookup or SPA fallback. Set `server.allowDotfiles:true` only when the entire root is safe to expose, including paths such as `/.well-known`.

See [SECURITY.md](SECURITY.md) before exposing a server outside the local machine.

## Request data and limits

The parsed request passed to `onRequest` includes both body forms:

| Member | Type | Value |
|---|---|---|
| `request.body` | string | UTF-8 request body |
| `request.bodyBuffer` | Buffer | Original request bytes |
| `request.uri` | object | Parsed URL information and query |
| `request.url` | string | Processed request path |
| `request.serverRoot` | string | Selected static root |

When `maxRequestBodyBytes` is set and the request crosses it, the static lifecycle stops with `413 Payload Too Large`.

## Hooks

Subclass `Server` or assign hook functions to intercept the lifecycle. The first three hooks may return a value directly or through a Promise.

| Hook | Arguments | When it runs |
|---|---|---|
| `onRawRequest` | `request, response, serve` | Immediately after receipt, before body parsing |
| `onRequest` | `request, response, serve` | After the request body and URL helpers are ready |
| `beforeServe` | `request, response, bodyRef, encodingRef, serve` | Immediately before a buffered response is sent |
| `afterServe` | `request, response` | After a library completion path finishes |

Return a truthy value from the first three hooks when the hook is taking over that step. Complete the response with the supplied `serve` function or the Node response object.

`onRawRequest` and `onRequest` receive the public safe `serve` path. The fifth `beforeServe` argument is a one-shot completion continuation: call it after manual or asynchronous body work. It completes the response once and bypasses another `beforeServe` pass.

```js
import {Server} from 'node-http-server';

class ApiAndFiles extends Server{
    async onRequest(request,response,serve){
        if(request.url!='/health'){
            return false;
        }

        response.setHeader('Content-Type','application/json');
        await serve(request,response,JSON.stringify({ok:true}));

        return true;
    }
}

new ApiAndFiles({root:'./public'}).deploy();
```

Static files stream by default. Defining a custom `beforeServe` hook uses the compatibility buffered path for those responses so `bodyRef.value` and `encodingRef.value` can still be modified.

Static bodies reach `beforeServe` as Buffers; convert them explicitly before string replacement. A custom `beforeServe` buffers files and bypasses automatic streaming/compression. A hook that calls `response.end()` directly also bypasses `afterServe`.

The named `RefString` export remains available in CommonJS and ESM for hook compatibility.

## Logging

Set `log` to a file path for one JSON request record per line:

```js
new Server({
    log:'./requests.ndjson'
}).deploy();
```

The built-in logger preserves the supplied record, adds a timestamp to its own copy, redacts common credential headers, and reports serialization or filesystem errors. Replace `logFunction` when records need to go somewhere else. Set `logBody:true` only when storing request bodies is intentional. Treat request logs as sensitive data and protect the destination accordingly.

## Development

Install the exact workspace state once with `npm ci`. Published installs have zero runtime dependencies. The exact `vanilla-test@2.1.1` release is the sole direct development dependency and runs the Node-only native V8 coverage workflow.

Vanilla Test 2.1 uses Node's native V8 coverage path and its project-owned reporter. Node's built-in test runner and assertion module execute the behavior suite.

The suite contains 156 unique, focused leaf cases: 34 Unit, 46 Functional, 24 Integration, and 52 Regression. Each behavior has one owning case. Both the normal runner and coverage use the ordered manifest in `test/suites.js`; generated `coverage/node/test-results.json` is the authoritative ordered case evidence.

| Script | Purpose |
|---|---|
| `npm start` | Serve the current directory with the CLI |
| `npm test` | Run all 156 cases discovered by the shared suite manifest |
| `npm run test:unit` | Run 34 isolated Config and suite-discovery tests from `test/unit/` |
| `npm run test:functional` | Run 46 public HTTP behavior tests from `test/functional/` |
| `npm run test:integration` | Run 24 module, CLI, benchmark, listener, stream, and filesystem boundary tests from `test/integration/` |
| `npm run test:regression` | Run 52 owned cases for previously fixed failures and security boundaries from `test/regression/` |
| `npm run test:site` | Check docs pages, local links/fragments, IDs, label/ARIA targets, image alt text, nav state, CSS, and site JavaScript |
| `npm run coverage` | Run `vanilla-test` Node coverage gates, write `coverage/node/`, and refresh measured badge JSON |
| `npm run test:package` | Pack, install, and smoke-test the publishable package |
| `npm run verify` | Run tests, static-doc checks, coverage, and the package smoke test |
| `npm run benchmark` | Measure five validated public paths with the bounded developer profile |
| `npm run benchmark:smoke` | Run the short real-server measurement profile |
| `npm run basic` | Run the basic HTTP example |
| `npm run https` | Run the HTTPS-only example; local certificates are required |
| `npm run both` | Run the combined HTTP/HTTPS example; local certificates are required |
| `npm run template` | Run the template example |
| `npm run cluster` | Run the cluster example |

GitHub Actions tests Node.js 22.12 and Node.js 24, validates the dependency-free static docs, runs the Node-only `vanilla-test` coverage gate, smoke-tests the packed npm artifact, measures real HTTP paths on Ubuntu Node 24.18.0, and publishes the reports, badges, and latest benchmark JSON with the static project site from `main`.

When upgrading from v8, read [MIGRATION.md](MIGRATION.md). Release details are in [CHANGELOG.md](CHANGELOG.md).

## License

[MIT](licence)
