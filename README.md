# flagd OFREP Edge Runtime Handler

> **Warning:** This project is under active development and is not yet ready for production use.

An edge-runtime package for running flagd in-process evaluation and exposing an OFREP (OpenFeature Remote Evaluation Protocol) API.

## Overview

This project enables feature flag evaluation inside Fetch-compatible runtimes using the flagd evaluation engine. It uses a workers-compatible fork of `@openfeature/flagd-core` and exposes the [OFREP API](https://github.com/open-feature/protocol), allowing clients to evaluate flags via HTTP.

## Supported runtimes

- Cloudflare Workers
- Vercel Edge Functions
- Fastly Compute
- Deno Deploy

```
┌─────────────────────────────────────────────────────────────────┐
│                       Edge Runtime                              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                    OFREP Handler                          │  │
│  │  POST /ofrep/v1/evaluate/flags/{key}  → Single eval       │  │
│  │  POST /ofrep/v1/evaluate/flags        → Bulk eval         │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              flagd Evaluation Engine                      │  │
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
│   └── js-ofrep-worker/           # Reusable JS package (@openfeature/flagd-ofrep-cf-worker)
├── examples/
│   ├── js-worker/                 # Cloudflare Workers example
│   ├── vercel-edge/               # Vercel Edge Functions example
│   ├── fastly-compute/            # Fastly Compute example
│   └── deno-deploy/               # Deno Deploy example
├── contrib/
│   └── js-sdk-contrib/            # Git submodule: forked JS flagd-core
└── shared/
    └── test-flags.json            # Shared test flag definitions
```

---

## Runtime compatibility

Some edge runtimes do not allow dynamic code generation (`new Function`). This project currently uses a [fork](https://github.com/DevCycleHQ-Sandbox/js-sdk-contrib/tree/feat/workers-compatibility) (as a git submodule) with compatibility patches. Work to upstream these changes is tracked in [open-feature/js-sdk-contrib#1480](https://github.com/open-feature/js-sdk-contrib/issues/1480). Once those changes land, the submodule will be removed in favor of the published `@openfeature/flagd-core` package.

---

## Quick Start

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Run the default Cloudflare example locally
npm run dev
```

### Runtime example commands

```bash
# Cloudflare Workers
npm run dev:cloudflare

# Vercel Edge Functions
npm run dev:vercel

# Fastly Compute
npm run dev:fastly

# Deno Deploy-compatible runtime
npm run dev:deno
```

### Smoke checks

Run smoke checks against whichever runtime is currently running:

```bash
npm run smoke:cloudflare
npm run smoke:vercel
npm run smoke:fastly
npm run smoke:deno
```

## Package Usage

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = createOfrepHandler({ flags });

export default {
  fetch: handler,
};

// For runtimes with direct handler exports:
// export default handler;
```

See [packages/js-ofrep-worker/README.md](packages/js-ofrep-worker/README.md) for full documentation.
See [examples/README.md](examples/README.md) for runtime-specific example details.

---

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
    }
  ],
  "metadata": {
    "flagSetId": "production",
    "version": "1.0.0"
  }
}
```

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

---

## Supported Targeting Features

| Feature               | Description                | Example                                                       |
| --------------------- | -------------------------- | ------------------------------------------------------------- |
| JSONLogic rules       | Complex conditional logic  | `{"if": [{"==": [{"var": "plan"}, "premium"]}, "on", "off"]}` |
| Fractional evaluation | Percentage-based rollouts  | `{"fractional": [["control", 50], ["treatment", 50]]}`        |
| String comparison     | `starts_with`, `ends_with` | `{"starts_with": [{"var": "email"}, "admin"]}`                |
| Semantic versioning   | Version comparison         | `{"sem_ver": [{"var": "version"}, ">=", "2.0.0"]}`            |

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/). See [examples/js-worker/src/flags.json](examples/js-worker/src/flags.json) for examples.

---

## Roadmap / Future Enhancements

- [x] **JavaScript package**: Workers-compatible flagd-core fork
- [ ] **Upstream PRs**: Contribute Workers compatibility back to upstream repos
- [ ] **Multi-runtime examples**: Vercel Edge, Fastly Compute, Deno Deploy
- [ ] **Cloudflare KV**: Load flag configurations from KV at runtime
- [ ] **Durable Objects**: Real-time flag updates with WebSocket sync
- [ ] **External Sync**: Fetch flags from external HTTP endpoint
- [ ] **Cache API**: Cache evaluated results for performance
- [ ] **ETag Support**: Bulk evaluation caching with ETags

---

## Development

### Build All

```bash
npm run build
```

### Run Tests

```bash
npm test
```

### Lint

```bash
npm run lint
```

### Format

```bash
# Check formatting
npm run format

# Auto-fix formatting
npm run format:fix
```

### Run Worker Locally

```bash
npm run dev
```

### Deploy

```bash
npm run deploy
```

### Update Submodule

```bash
cd contrib/js-sdk-contrib
git pull origin feat/workers-compatibility
```

### Regenerate Pre-compiled Validators

If the flagd JSON schemas change:

```bash
cd contrib/js-sdk-contrib/libs/shared/flagd-core
npm run build:validators
```

### Build Tooling

The library is built with [tsup](https://tsup.egoist.dev/) (which uses [esbuild](https://esbuild.github.io/) under the hood), outputting both CJS and ESM formats. This aligns with the [js-sdk](https://github.com/open-feature/js-sdk) repo which uses esbuild directly. In the future, we may switch to direct esbuild + [rollup-plugin-dts](https://github.com/nicolo-ribaudo/rollup-plugin-dts) for type bundling to fully match the js-sdk pattern.

---

## Related Projects

- [flagd](https://flagd.dev/) - Feature flag evaluation engine
- [OpenFeature](https://openfeature.dev/) - Open standard for feature flags
- [OFREP Specification](https://github.com/open-feature/protocol) - OpenFeature Remote Evaluation Protocol
- [js-sdk-contrib](https://github.com/open-feature/js-sdk-contrib) - OpenFeature JavaScript SDK contributions

## Package naming

The published package name remains `@openfeature/flagd-ofrep-cf-worker` for compatibility with existing users.
A neutral rename or alias can be handled in a separate follow-up release.

### Fork Used

This fork adds Workers compatibility features that aren't yet upstream:

- [DevCycleHQ-Sandbox/js-sdk-contrib](https://github.com/DevCycleHQ-Sandbox/js-sdk-contrib) - `feat/workers-compatibility` branch

## License

Apache-2.0
