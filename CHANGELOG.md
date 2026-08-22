# Changelog

All notable changes to this project are documented here.

## [Unreleased]

## [9.1.0] - 2026-08-21

### Added

- Added configurable `server.brotliQuality` with a responsive quality-4 default for on-demand compression.
- Added reproducible `9.0.2`-versus-`9.1.0` core benchmarks with alternating samples, raw JSON evidence, environment metadata, and correctness checks.
- Added focused Performance and Why documentation for engineering evaluation and adoption.

### Changed

- Replaced quadratic repeated-query array copying with linear accumulation while preserving ordered string-or-array values.
- Bypassed unchanged request and response hooks, empty request-body collectors, empty query iteration, repeated virtual-host scans, and redundant stream wrappers on ordinary static requests.
- Shared the frozen MIME defaults until a Config consumer requests a mutable snapshot, reducing cold Config construction time and retained memory while preserving isolated direct mutation.
- Cached validated document-root canonical paths per deployment while retaining candidate real-path containment checks and fallback validation for hook-selected roots.
- Read only the selected byte range before a custom `beforeServe` hook instead of buffering the complete source file.

### Fixed

- Cancelled pending listeners when `close()` runs immediately after `deploy()`, preventing an untracked listener from becoming active after closure resolves.
- Set on-demand Brotli compression to an operational quality level instead of Node's maximum-CPU default.

## [9.0.2] - 2026-08-17

### Changed

- Upgraded the sole direct development dependency to `vanilla-test@2.1.1`, including its bound comparison helpers and `strong-type` v2 runtime, while keeping published `node-http-server` installs free of runtime dependencies.
- Reorganized the development tests into 156 focused cases across selectable Unit, Functional, Integration, and Regression suites. Each behavior has one owning case, and direct runs and coverage share the same discovery manifest.
- Added validated real-HTTP benchmarks for static GET, HEAD, byte ranges, compressed SPA fallback, and dynamic hooks, with separate server/driver processes, throughput, latency percentiles, and published CI JSON evidence.

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
- Legacy tooling outside the zero-runtime-dependency server.
