## Node HTTP and HTTPS server examples

| Example group | What it demonstrates | Default ports |
|---|---|---|
| [Basic servers](https://github.com/RIAEvangelist/node-http-server/tree/main/example/basic) | Static roots, logging, domains, clustering, and HTTPS | HTTP `8000`; HTTPS `4433` |
| [Advanced servers](https://github.com/RIAEvangelist/node-http-server/tree/main/example/advanced) | Hooks, templates, dynamic responses, and benchmarks | HTTP `8000`; HTTPS `4433` |
| [Proxy examples](https://github.com/RIAEvangelist/node-http-server/tree/main/example/proxy) | Small request-forwarding examples built with Node APIs | Varies by example |

Run only one example that uses a given port at a time. Some HTTPS examples start both HTTP and HTTPS listeners. Set `config.https.only=true` when the secure listener should run alone.

See the [node-http-server documentation and playground](https://riaevangelist.github.io/node-http-server/) for current API, configuration, CLI, and copyable examples.
