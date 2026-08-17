# Benchmarks

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
