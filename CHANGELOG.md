# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [9.0.2] - 2026-08-16

### Changed

- Upgraded the sole direct development dependency to `vanilla-test@2.1.1`, including its bound comparison helpers and `strong-type` v2 runtime, while keeping published `node-http-server` installs free of runtime dependencies.

## [9.0.1] - 2026-08-16

### Added

- Blocked every dot-prefixed static path segment by default, including encoded names, nested directories, configured indexes or SPA fallbacks, and visible symlink aliases into hidden content.
- Added the explicit `server.allowDotfiles:true` and CLI `--allow-dotfiles` opt-ins for deliberate content such as `/.well-known`.

### Changed

- Upgraded the sole direct development dependency to `vanilla-test@2.1.0`, using its project-owned native V8 reporter, complete test-result artifact, and Node-only coverage configuration without c8, Playwright, Monocart, or Istanbul tooling.

## [9.0.0] - 2026-08-14

### Added

- CommonJS and native ESM package entry points with the default singleton plus named `Server`, `Config`, and `RefString` exports.
- Isolated server instances, `deploy()` chaining, Promise-based `close()`, and safe redeployment after close.
- Streaming static file responses with `GET`, `HEAD`, one satisfiable byte range, `ETag`, `Last-Modified`, and conditional `304` support.
- Optional Brotli/gzip compression, configurable compression threshold, and optional SPA fallback.
- Configurable request-body limits plus socket, request, header, and keep-alive timeouts. Every limit or timeout can be disabled explicitly.
- `request.bodyBuffer` alongside the compatible UTF-8 `request.body` string.
- A built-in modern MIME map with safe binary fallback and `contentType:false` opt-out.
- Localhost-first `host` configuration, decoded-path containment, malformed-request handling, and virtual-host validation.
- Structured NDJSON request logging with isolated records and surfaced logging errors.
- Modern CLI flags while retaining the v8 `key=value` form.
- Node.js 22.12 and Node.js 24 CI, Node-only V8 coverage through the owner-maintained `vanilla-test`, packed-package smoke tests, and GitHub Pages deployment.
- Migration, security, configuration, CLI, and lifecycle documentation.

### Changed

- Raised the minimum supported Node.js version to 22.12.
- Changed the default listen address from all available interfaces to `127.0.0.1`.
- Separated the listen address (`host`) from virtual-host selection (`domain` and `domains`).
- Deeply isolated known nested configuration objects instead of sharing or replacing default state accidentally.
- Moved CLI argument parsing out of `Config`; programmatic imports no longer read unrelated process arguments.
- Changed unknown static file extensions from `415` to `application/octet-stream` when automatic MIME handling is enabled.
- Kept static responses streamed unless a custom `beforeServe` hook requests the compatible buffered lifecycle.
- Expanded `afterServe` to receive both `request` and `response`; one-argument hooks remain valid JavaScript.

### Fixed

- Blocked encoded traversal, malformed URL escapes, absolute-path injection, and filesystem escapes outside the selected root.
- Removed singleton listener collisions that prevented clean multiple-server use.
- Preserved binary request bodies instead of only accumulating a string.
- Made `HEAD`, satisfiable/unsatisfiable range handling, unsupported methods, client aborts, and oversized bodies finish with deliberate HTTP behavior.
- Prevented configuration instances and logger records from mutating one another.

### Removed

- Support for Node.js versions older than 22.12.
- Implicit CLI parsing from the reusable configuration class.
- Legacy tooling that is not part of the zero-runtime-dependency server.
