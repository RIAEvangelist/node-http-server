# Benchmarks

Two dependency-free harnesses answer two different engineering questions.

| Harness | Question | Command |
| --- | --- | --- |
| Operational | How does the current package handle representative public HTTP paths on this machine? | `npm run benchmark` |
| Core comparison | How does the working tree compare with an exact Git release on targeted hot paths and lifecycle contracts? | `npm run benchmark:core` from a Git checkout containing tag `9.0.2` |

## Operational benchmark

The benchmark starts `node-http-server` in a child process on `127.0.0.1` with an ephemeral port. The parent process creates temporary static files and drives real requests through Node's HTTP client. Separate event loops keep server work and client measurement independent. IPC carries readiness, the selected port, and a bounded shutdown handshake. Every response is checked for its expected status, headers, and body before its measurement is accepted.

## Processes

| File | Responsibility |
| --- | --- |
| `benchmark/run.js` | Parse options, create fixtures, drive concurrent HTTP requests, validate responses, calculate metrics, and clean up. |
| `benchmark/server.js` | Run the package Server, expose the dynamic hook, report readiness and port over IPC, and close on command. |

## Commands

| Command | Purpose |
| --- | --- |
| `npm run benchmark` | Run the bounded developer benchmark defaults. |
| `npm run benchmark:smoke` | Run the short benchmark used for integration verification. |
| `node benchmark/run.js --json` | Emit structured results for another tool. |

## Options

| Option | Default | Smoke | Meaning |
| --- | ---: | ---: | --- |
| `--requests <count>` | `250` | `8` | Measured requests for each scenario. |
| `--warmup <count>` | `25` | `2` | Validated warmup requests for each scenario. |
| `--concurrency <count>` | `10` | `2` | Concurrent HTTP clients. |
| `--json` | off | off | Write one JSON result document to standard output. |
| `--smoke` | off | on | Select the short request profile. |

Explicit request, warmup, and concurrency values override the selected profile. Concurrency must be less than or equal to measured requests.

## Scenarios

| ID | Public path | Validation |
| --- | --- | --- |
| `static-get-small` | `GET /small.txt` | `200`, content length, exact bytes. |
| `static-head-small` | `HEAD /small.txt` | `200`, content length, empty response body. |
| `static-range-large` | `GET /large.bin` with a byte range | `206`, content range, exact 64 KiB slice from a 1 MiB file. |
| `spa-fallback-gzip` | `GET /dashboard/settings` | `200`, gzip headers, exact decompressed SPA document. |
| `dynamic-hook` | `GET /dynamic` | `200`, JSON content type, exact hook response. |

## Measurements

| Field | Meaning |
| --- | --- |
| `requestsPerSecond` | Validated measured requests divided by scenario wall time. |
| `latencyMilliseconds.p50` | Median request latency. |
| `latencyMilliseconds.p95` | 95th-percentile request latency. |
| `latencyMilliseconds.p99` | 99th-percentile request latency. |
| `durationMilliseconds` | Scenario wall time after warmup. |

Results are written to standard output. Hardware, operating system load, Node.js version, and filesystem behavior affect the values, so compare runs made under equivalent conditions.

## Core release comparison

`benchmark/core.js` exports the baseline `Server.js`, `Config.js`, and `MimeTypes.js` directly from Git into an OS temporary directory. The working tree stays in the canonical checkout. Baseline and candidate servers run in separate child processes; Config and lifecycle samples run in fresh `node --expose-gc` workers.

| Property | Contract |
| --- | --- |
| Baseline | Exact `9.0.2` Git tag by default; override with `--baseline <ref>`. |
| Order | Baseline-first and candidate-first order alternates for every recorded sample. |
| Aggregation | Median, minimum, maximum, and every raw sample retained. |
| HTTP isolation | One child server per source with validated preflight and warmup before timing. |
| Worker isolation | One fresh garbage-collection-enabled process per source and sample. |
| Timing boundary | Fixture creation, process startup, preflight, warmup, validation after receipt, and cleanup stay outside the recorded action interval. |
| Correctness | Exact status, headers, bytes, hook counts, query order, Config isolation, and listener state are asserted. |
| Dependencies | Node.js built-ins, this repository, and the selected Git ref. |

### Commands

| Command | Purpose |
| --- | --- |
| `npm run benchmark:core` | Run the standard nine-sample comparison against `9.0.2`. |
| `npm run benchmark:core:smoke` | Run the short three-sample correctness profile. |
| `node --expose-gc benchmark/core.js --only repeated-query-hook` | Run one scenario. Repeat `--only` to select several. |
| `node --expose-gc benchmark/core.js --json` | Emit the complete result document to standard output. |
| `node --expose-gc benchmark/core.js --output site/benchmarks/core-9.0.2-vs-9.1.0.json` | Record the raw result for GitHub Pages while keeping it outside the npm artifact. |

### Core scenarios

| ID | Workload | Validation |
| --- | --- | --- |
| `default-static-get` | Repeated small static GET with prototype hooks. | Exact `200` body. |
| `bodyless-static-head` | Repeated small static HEAD. | Exact headers and empty wire body. |
| `bodyless-request-hook` | Bodyless GET through a custom request hook. | Empty string/Buffer request body contract. |
| `repeated-query-hook` | 1,000 ordered values for one query key. | Array length, first value, and last value. |
| `virtual-host-miss` | Unknown Host with 1,000 configured domains. | Exact `421` response. |
| `virtual-host-hit` | Mixed-case Host with 1,000 configured domains. | Exact selected-root body. |
| `range-custom-before-serve` | 16-byte range from an 8 MiB file through custom `beforeServe`. | Selected hook bytes, transformed body, `206`, `Content-Range`, and one `afterServe`. |
| `head-default-hook-control` | HEAD for an 8 MiB file through prototype hooks. | Full-response metadata and an empty wire body. |
| `head-custom-before-serve-control` | HEAD for an 8 MiB file through custom `beforeServe`. | Full representation Buffer reaches the compatibility hook; wire body stays empty. |
| `brotli-static-default` | 2.5 MiB deterministic structured-text response with default Brotli quality. | Brotli header, compressed bytes, and exact decompressed bytes. |
| `brotli-static-quality-11-control` | Same response with `server.brotliQuality:11`. | Configurable quality control and exact decompressed bytes. |
| `config-construction` | 100,000 Config instances without reading the MIME map. | Defaults checksum and construction throughput. |
| `config-retained-cold` | 10,000 retained Config instances without a MIME read. | Heap bytes per instance and isolated map semantics. |
| `config-overlay-retained-cold` | 10,000 retained Config instances with one MIME overlay. | Deferred overlay memory and restored defaults. |
| `config-materialized-control` | 10,000 retained Config instances with `.contentType.html` read. | Materialized-map compatibility and memory control. |
| `immediate-close-correctness` | Deploy on port `0`, then close immediately. | Live-listener count and ready-callback count. |

### Core options

| Option | Standard | Smoke | Meaning |
| --- | ---: | ---: | --- |
| `--samples` | `9` | `3` | Alternating recorded samples per source. |
| `--concurrency` | `10` | `2` | Concurrent HTTP clients. |
| `--requests` | `400` | `12` | Small HTTP requests per sample. |
| `--query-requests` | `40` | `3` | Repeated-query requests per sample. |
| `--large-requests` | `8` | `1` | Range and custom-HEAD requests per sample. |
| `--brotli-requests` | `2` | `1` | Brotli requests per sample. |
| `--config-constructions` | `100000` | `1000` | Config constructions per worker. |
| `--config-retained` | `10000` | `200` | Retained Config instances per memory worker. |
| `--lifecycle-cycles` | `20` | `3` | Immediate deploy/close cycles per worker. |
| `--query-values` | `1000` | `25` | Duplicate values in each query request. |
| `--domains` | `1000` | `5` | Configured virtual-host routes. |
| `--large-bytes` | `8388608` | `65536` | Range and HEAD fixture size. |
| `--range-bytes` | `16` | `16` | Selected range size. |
| `--brotli-bytes` | `2621440` | `131072` | Compressible fixture size. |

Numeric options accept positive integers. `--output` accepts a `.json` path inside `site/benchmarks/`. The result records source commits and SHA-256 hashes, Node/V8, platform, processor, logical cores, memory, configuration, summaries, and every raw sample.

The operational harness uses the installed package and Node built-ins. The core comparison additionally reads Git history, so run it from a repository checkout that contains the baseline tag.
