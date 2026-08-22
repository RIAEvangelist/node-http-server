# Security

## Reporting a vulnerability

Please report suspected vulnerabilities privately through [GitHub Security Advisories](https://github.com/RIAEvangelist/node-http-server/security/advisories/new). Include the affected version, configuration, request or proof of concept, impact, and any known workaround.

Send exploit details through the private advisory first so they can be reviewed safely.

## Supported versions

Security fixes target the current supported major release. Upgrade to the latest published release before reporting behavior that may already be fixed.

## Security model

node-http-server provides native Node HTTP and HTTPS static listeners with extension hooks. Add authentication, authorization, application-firewall rules, secret storage, and reverse proxying at the application or edge.

Version 9 starts from these boundaries:

- The default listen address is `127.0.0.1`.
- Static requests are decoded and resolved inside the selected root.
- Dot-prefixed path segments are blocked before filesystem lookup and SPA fallback unless literal `server.allowDotfiles:true` is configured.
- Malformed URL escapes, traversal attempts, absolute-path injection, and filesystem escapes are rejected.
- `host` selects the listen interface; virtual-host lookup selects accepted Host values and document roots.
- The static fallback accepts `GET` and `HEAD`; other methods receive `405` unless a hook handles them.
- A configured body limit stops oversized requests with `413`.
- One satisfiable `GET` byte range is honored. Valid but unsatisfiable ranges receive `416`; malformed, unsupported-unit, and multi-range headers are ignored and receive the full representation.
- Unknown file extensions use `application/octet-stream` instead of guessing an executable type.
- Configuration objects are isolated and unsafe prototype keys are blocked.

These controls reduce common mistakes. Publish only a deliberately prepared public directory.

## Before exposing a server

The request-body limit is intentionally disabled by default for compatibility. Set it for any server that accepts untrusted traffic:

```js
new Server({
    host:'0.0.0.0',
    root:'./public',
    server:{
        maxRequestBodyBytes:1024*1024,
        requestTimeout:30000,
        headersTimeout:10000,
        keepAliveTimeout:5000
    }
}).deploy();
```

Also:

- Use a dedicated public root. Never point `root` at a home directory, repository containing secrets, credentials, private keys, or an upload directory.
- Keep `server.allowDotfiles:false` unless every hidden path in every configured root is intended to be public. Enabling it permits all dot-prefixed segments, including `/.git`, `/.env`, and `/.well-known`.
- Treat `domains` roots with the same care as the default root.
- Put authentication and authorization in a reviewed hook or, preferably, a dedicated front-end service.
- Terminate TLS with maintained infrastructure or protect the configured key and certificate files with narrow filesystem permissions.
- Run the process as a low-privilege account and use firewall rules appropriate to the bind address.
- Keep Node.js and node-http-server current.
- Set operational limits based on measured traffic. Setting a timeout or limit to `false` or `0` disables that protection.
- Protect NDJSON logs. URLs and request metadata can be sensitive even when application bodies are not logged.

## Old certificate fixtures

Version 9 removes the local certificate and private-key fixtures tracked by older releases. Treat any copy from v8, an old npm package, or repository history as public material and generate a fresh deployment credential.

Generate a fresh development certificate for local testing. Use certificates and private keys issued and stored for the real environment in production, rotate any key that was copied from the old fixtures, and never commit a private key.

## Hooks and dynamic responses

Returning a truthy value from `onRawRequest`, `onRequest`, or `beforeServe` transfers response ownership to that hook. Code in the hook is responsible for validation, headers, completion, and error handling.

The automatic dotfile policy applies to built-in static routing. `serveFile()` remains a deliberate trusted-file API, so never construct its filename from raw request input.

Review hook code for:

- authorization before serving user-specific data;
- header injection and reflected input;
- unbounded body or response buffering;
- accidental exposure of request headers or bodies in logs; and
- open proxy or server-side request forgery behavior.

Enabling compression for dynamic responses that mix secrets with attacker-controlled text can create compression side channels. Leave compression off for those responses or design the application so secrets are not reflected into the same compressed context.

## MIME and downloads

The built-in MIME map assigns an automatic type from the file extension. Validate uploaded content before it reaches the public root and set `Content-Disposition` in a hook when content should download instead of render.

Set `contentType:false` when automatic types are unwanted. The server then uses `application/octet-stream` unless a hook supplies a type.

`restrictedType` blocks selected extensions. Enforce authorization separately and serve from a carefully selected public root.
