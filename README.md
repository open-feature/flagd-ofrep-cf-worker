# flagd OFREP Cloudflare Workers

Experimental repository for running flagd in-process evaluation in Cloudflare Workers, exposing an OFREP (OpenFeature Remote Evaluation Protocol) API.

## Overview

This project explores the feasibility and performance of running feature flag evaluation entirely within Cloudflare Workers using:

- **JavaScript Worker**: Uses a Workers-compatible flagd evaluation implementation
- **Rust Worker** (planned): Uses the Rust flagd evaluation engine compiled to WASM

> **Note**: The standard `@openfeature/flagd-core` package uses libraries (`ajv`, `json-logic-engine`) that rely on dynamic code generation (`eval`/`new Function()`), which is not allowed in Cloudflare Workers. This package includes a Workers-compatible reimplementation using `json-logic-js` (interpreter-based) for targeting rules.

Both implementations expose the same [OFREP API](https://github.com/open-feature/protocol), allowing clients to evaluate flags via HTTP.

```
┌─────────────────────────────────────────────────────────────────┐
│                     Cloudflare Worker                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    OFREP Handler                          │  │
│  │  POST /ofrep/v1/evaluate/flags/{key}  → Single eval       │  │
│  │  POST /ofrep/v1/evaluate/flags        → Bulk eval         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              flagd-core Evaluation Engine                 │  │
│  │  • JSONLogic targeting rules                              │  │
│  │  • Fractional evaluation (percentage rollouts)            │  │
│  │  • Semantic version comparison                            │  │
│  │  • String operations (starts_with, ends_with)             │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                  Flag Configuration                       │  │
│  │             (bundled JSON at build time)                  │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Project Structure

```
flagd-ofrep-cf-worker/
├── packages/
│   └── js-ofrep-worker/       # Reusable JS package (@openfeature/flagd-ofrep-cf-worker)
├── examples/
│   ├── js-worker/             # Runnable JS Cloudflare Worker example
│   └── rust-worker/           # Runnable Rust Cloudflare Worker example (planned)
├── shared/
│   └── test-flags.json        # Shared test flag definitions
└── .plans/                    # Planning documents
```

## Quick Start

### Prerequisites

- Node.js 20+
- npm 8+

### Setup

```bash
# Install dependencies
npm install

# Build packages
npm run build
```

### Run the JS Worker Example

```bash
# Start the worker locally
npm run dev:js

# Or from the examples directory
cd examples/js-worker
npm run dev
```

The worker will be available at `http://localhost:8787`.

### Test the API

```bash
# Health check
curl http://localhost:8787/

# Evaluate a single flag
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags/simple-boolean \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123"}}'

# Evaluate with targeting context
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags/targeted-boolean \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123", "email": "user@openfeature.dev"}}'

# Bulk evaluate all flags
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123"}}'
```

## Packages

### @openfeature/flagd-ofrep-cf-worker

Reusable package for adding OFREP endpoints to your Cloudflare Worker.

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = createOfrepHandler({ flags });

export default {
  fetch: handler,
};
```

See [packages/js-ofrep-worker/README.md](packages/js-ofrep-worker/README.md) for full documentation.

## OFREP API Reference

### Evaluate Single Flag

```
POST /ofrep/v1/evaluate/flags/{key}
```

**Request:**
```json
{
  "context": {
    "targetingKey": "user-123",
    "email": "user@example.com",
    "plan": "premium"
  }
}
```

**Response (200):**
```json
{
  "key": "my-feature",
  "value": true,
  "reason": "TARGETING_MATCH",
  "variant": "on",
  "metadata": {
    "flagSetId": "production"
  }
}
```

### Bulk Evaluate All Flags

```
POST /ofrep/v1/evaluate/flags
```

**Request:**
```json
{
  "context": {
    "targetingKey": "user-123"
  }
}
```

**Response (200):**
```json
{
  "flags": [
    {
      "key": "feature-a",
      "value": true,
      "reason": "STATIC",
      "variant": "on"
    },
    {
      "key": "feature-b",
      "value": "variant-1",
      "reason": "TARGETING_MATCH",
      "variant": "treatment"
    }
  ],
  "metadata": {
    "flagSetId": "production",
    "version": "1.0.0"
  }
}
```

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/). See [shared/test-flags.json](shared/test-flags.json) for examples.

## Roadmap / Future Enhancements

- [ ] **Rust Worker**: Compile flagd Rust evaluation engine to WASM
- [ ] **Performance Benchmarks**: Compare JS vs Rust evaluation performance
- [ ] **Cloudflare KV**: Load flag configurations from KV at runtime
- [ ] **Durable Objects**: Real-time flag updates with WebSocket sync
- [ ] **External Sync**: Fetch flags from external HTTP endpoint
- [ ] **Cache API**: Cache evaluated results for performance
- [ ] **ETag Support**: Bulk evaluation caching with ETags

## Development

### Build

```bash
npm run build
```

### Test (planned)

```bash
npm test
```

## Related Projects

- [flagd](https://flagd.dev/) - Feature flag evaluation engine
- [OpenFeature](https://openfeature.dev/) - Open standard for feature flags
- [OFREP Specification](https://github.com/open-feature/protocol) - OpenFeature Remote Evaluation Protocol

## License

Apache-2.0
