# flagd OFREP Cloudflare Worker

Experimental repository for running flagd in-process evaluation in a JavaScript Cloudflare Worker that exposes an OFREP (OpenFeature Remote Evaluation Protocol) API.

## Overview

This repository now contains a **single JavaScript implementation**:

- **JavaScript Worker**: uses a Workers-compatible `@openfeature/flagd-core` path for in-process evaluation

The worker exposes the OFREP endpoints over HTTP:

- `POST /ofrep/v1/evaluate/flags/{key}` - evaluate a single flag
- `POST /ofrep/v1/evaluate/flags` - evaluate all flags

## Project structure

```text
flagd-ofrep-cf-worker/
├── packages/
│   └── js-ofrep-worker/                # Reusable JS package
├── examples/
│   └── js-worker/                      # Runnable JS Cloudflare Worker
├── benchmarks/                         # k6 benchmark suite (JS target)
├── shared/                             # Shared flag fixtures
├── .plans/                             # Planning notes
└── contrib/
    └── js-sdk-contrib/                 # Git submodule: JS flagd-core fork
```

## Quick start

```bash
# Install dependencies
npm install

# Build package + example
npm run build

# Run the JS worker locally
npm run dev:js
```

Default local endpoint: `http://localhost:8787`

## Example usage

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = createOfrepHandler({ flags });

export default {
  fetch: handler,
};
```

See [packages/js-ofrep-worker/README.md](packages/js-ofrep-worker/README.md) for package-level details.

## OFREP API examples

### Evaluate single flag

```bash
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags/simple-boolean \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123"}}'
```

### Bulk evaluate all flags

```bash
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123"}}'
```

## Benchmarks

Run k6 against the local JS worker:

```bash
k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js
```

See [benchmarks/README.md](benchmarks/README.md) for full instructions.

## Development

### Build

```bash
npm run build
```

### Test

```bash
npm run test
```

### Lint

```bash
npm run lint
```

### Deploy JS worker

```bash
npm run deploy:js
```

### Update JS submodule

```bash
cd contrib/js-sdk-contrib
git pull origin feat/workers-compatibility
```

## Related projects

- [flagd](https://flagd.dev/) - Feature flag evaluation engine
- [OpenFeature](https://openfeature.dev/) - Open standard for feature flags
- [OFREP specification](https://github.com/open-feature/protocol) - OpenFeature Remote Evaluation Protocol
- [js-sdk-contrib](https://github.com/open-feature/js-sdk-contrib) - OpenFeature JavaScript SDK contributions

## License

Apache-2.0
