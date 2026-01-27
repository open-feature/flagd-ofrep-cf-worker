# flagd OFREP Cloudflare Workers

Experimental repository for running flagd in-process evaluation in Cloudflare Workers, exposing an OFREP (OpenFeature Remote Evaluation Protocol) API.

## Overview

This project enables feature flag evaluation entirely within Cloudflare Workers using the flagd evaluation engine. It includes:

- **JavaScript Worker**: Uses a Workers-compatible flagd evaluation implementation
- **Rust Worker** (planned): Uses the Rust flagd evaluation engine compiled to WASM

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

## Cloudflare Workers Compatibility

### The Challenge

The standard `@openfeature/flagd-core` package cannot run in Cloudflare Workers because it depends on libraries that use dynamic code generation:

| Library | Usage | Problem |
|---------|-------|---------|
| `ajv` | JSON Schema validation | Uses `new Function()` to compile validators at module load time |
| `json-logic-engine` | Targeting rule evaluation | Uses `new Function()` in `.build()` compilation mode |

Cloudflare Workers run in V8 isolates with strict security restrictions that block `eval()` and `new Function()`.

### The Solution

This repository includes a **fork of `@openfeature/flagd-core`** with an optional `workers` compatibility mode that:

1. **Pre-compiled ajv validators**: Generated at build time using `ajv-standalone`, avoiding runtime code generation
2. **Interpreter mode for JSONLogic**: Uses `.run()` instead of `.build()`, which interprets rules without code generation

#### Usage

```typescript
import { FlagdCore } from '@openfeature/flagd-core';

// For Cloudflare Workers (no dynamic code generation)
const core = new FlagdCore(undefined, undefined, { workers: true });

// For Node.js (default, uses compilation for better performance)
const core = new FlagdCore();
```

#### Performance Trade-off

| Mode | JSONLogic | Performance | Environment |
|------|-----------|-------------|-------------|
| `workers: false` (default) | Compiled (`.build()`) | ~10-20x faster | Node.js |
| `workers: true` | Interpreted (`.run()`) | Slower but compatible | Cloudflare Workers |

For typical OFREP usage (a few flag evaluations per request), the interpreter mode is fast enough. The absolute times are still in microseconds.

### Fork Details

The fork is maintained at [`DevCycleHQ-Sandbox/js-sdk-contrib`](https://github.com/DevCycleHQ-Sandbox/js-sdk-contrib) on the `feat/workers-compatibility` branch.

**Files modified in `libs/shared/flagd-core/`:**

| File | Changes |
|------|---------|
| `src/lib/options.ts` | New `FlagdCoreOptions` interface with `workers?: boolean` |
| `src/lib/targeting/targeting.ts` | Conditionally uses `.run()` interpreter when `workers: true` |
| `src/lib/parser.ts` | Uses pre-compiled validators when `workers: true`, lazy-loads ajv otherwise |
| `src/lib/feature-flag.ts` | Passes options through to Targeting |
| `src/lib/storage.ts` | Passes options through to parser |
| `src/lib/flagd-core.ts` | Accepts `FlagdCoreOptions` in constructor |
| `scripts/build-validators.js` | Generates pre-compiled ajv validators |
| `src/lib/generated/validators.js` | Auto-generated pre-compiled validators |

To regenerate the pre-compiled validators after schema changes:

```bash
cd contrib/js-sdk-contrib/libs/shared/flagd-core
npm run build:validators
```

## Project Structure

```
flagd-ofrep-cf-worker/
├── packages/
│   └── js-ofrep-worker/       # Reusable JS package (@openfeature/flagd-ofrep-cf-worker)
├── examples/
│   ├── js-worker/             # Runnable JS Cloudflare Worker example
│   └── rust-worker/           # Runnable Rust Cloudflare Worker example (planned)
├── contrib/
│   └── js-sdk-contrib/        # Git submodule: forked flagd-core with Workers compatibility
├── shared/
│   └── test-flags.json        # Shared test flag definitions
└── .plans/                    # Planning documents
```

## Quick Start

### Prerequisites

- Node.js 25+
- npm 11+

### Setup

```bash
# Clone with submodules
git clone --recurse-submodules https://github.com/open-feature/flagd-ofrep-cf-worker.git
cd flagd-ofrep-cf-worker

# Or if already cloned, initialize submodules
git submodule update --init --recursive

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

# Test fractional rollout
curl -X POST http://localhost:8787/ofrep/v1/evaluate/flags/fractional-rollout \
  -H "Content-Type: application/json" \
  -d '{"context": {"targetingKey": "user-123"}}'

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

## Supported Targeting Features

All flagd targeting features are supported in Workers mode:

| Feature | Description | Example |
|---------|-------------|---------|
| JSONLogic rules | Complex conditional logic | `{"if": [{"==": [{"var": "plan"}, "premium"]}, "on", "off"]}` |
| Fractional evaluation | Percentage-based rollouts | `{"fractional": [["control", 50], ["treatment", 50]]}` |
| String comparison | `starts_with`, `ends_with` | `{"starts_with": [{"var": "email"}, "admin"]}` |
| Semantic versioning | Version comparison | `{"sem_ver": [{"var": "version"}, ">=", "2.0.0"]}` |

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/). See [examples/js-worker/src/flags.json](examples/js-worker/src/flags.json) for examples including:

- Simple static flags (boolean, string, number, object)
- Targeted flags with JSONLogic rules
- Fractional rollouts for A/B testing
- Complex multi-condition targeting

## Roadmap / Future Enhancements

- [ ] **Upstream PR**: Contribute Workers compatibility back to `open-feature/js-sdk-contrib`
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

### Run Locally

```bash
npm run dev:js
```

### Update flagd-core Submodule

```bash
cd contrib/js-sdk-contrib
git pull origin feat/workers-compatibility
cd ../..
git add contrib/js-sdk-contrib
git commit -m "chore: update js-sdk-contrib submodule"
```

### Regenerate Pre-compiled Validators

If the flagd JSON schemas change:

```bash
cd contrib/js-sdk-contrib/libs/shared/flagd-core
npm run build:validators
git add src/lib/generated/
git commit -m "chore: regenerate pre-compiled validators"
```

## Related Projects

- [flagd](https://flagd.dev/) - Feature flag evaluation engine
- [OpenFeature](https://openfeature.dev/) - Open standard for feature flags
- [OFREP Specification](https://github.com/open-feature/protocol) - OpenFeature Remote Evaluation Protocol
- [js-sdk-contrib](https://github.com/open-feature/js-sdk-contrib) - OpenFeature JavaScript SDK contributions

## License

Apache-2.0
