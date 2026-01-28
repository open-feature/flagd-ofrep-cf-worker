# flagd OFREP Cloudflare Workers

Experimental repository for running flagd in-process evaluation in Cloudflare Workers, exposing an OFREP (OpenFeature Remote Evaluation Protocol) API.

## Overview

This project enables feature flag evaluation entirely within Cloudflare Workers using the flagd evaluation engine. It includes two implementations:

- **JavaScript Worker**: Uses a Workers-compatible fork of `@openfeature/flagd-core`
- **Rust Worker**: Uses the flagd Rust SDK compiled to native WebAssembly

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
│   ├── js-ofrep-worker/       # Reusable JS package
│   └── rust-ofrep-worker/     # Reusable Rust crate
├── examples/
│   ├── js-worker/             # JS Cloudflare Worker example
│   └── rust-worker/           # Rust Cloudflare Worker example
├── contrib/
│   ├── js-sdk-contrib/        # Git submodule: forked JS flagd-core
│   └── rust-sdk-contrib/      # Git submodule: forked Rust flagd SDK
└── .plans/                    # Planning documents
```

---

## JavaScript Worker

### The Challenge

The standard `@openfeature/flagd-core` package cannot run in Cloudflare Workers because it depends on libraries that use dynamic code generation:

| Library | Usage | Problem |
|---------|-------|---------|
| `ajv` | JSON Schema validation | Uses `new Function()` to compile validators at module load time |
| `json-logic-engine` | Targeting rule evaluation | Uses `new Function()` in `.build()` compilation mode |

Cloudflare Workers run in V8 isolates with strict security restrictions that block `eval()` and `new Function()`.

### The Solution

This repository includes a **fork of `@openfeature/flagd-core`** (as a git submodule) with an optional `workers` compatibility mode that:

1. **Pre-compiled ajv validators**: Generated at build time using `ajv-standalone`, avoiding runtime code generation
2. **Interpreter mode for JSONLogic**: Uses `.run()` instead of `.build()`, which interprets rules without code generation

#### Fork Details

The fork is maintained at [`DevCycleHQ-Sandbox/js-sdk-contrib`](https://github.com/DevCycleHQ-Sandbox/js-sdk-contrib) on the `feat/workers-compatibility` branch.

**Files modified in `libs/shared/flagd-core/`:**

| File | Changes |
|------|---------|
| `src/lib/options.ts` | New `FlagdCoreOptions` interface with `workers?: boolean` |
| `src/lib/targeting/targeting.ts` | Conditionally uses `.run()` interpreter when `workers: true` |
| `src/lib/parser.ts` | Uses pre-compiled validators when `workers: true` |
| `src/lib/feature-flag.ts` | Passes options through to Targeting |
| `src/lib/storage.ts` | Passes options through to parser |
| `src/lib/flagd-core.ts` | Accepts `FlagdCoreOptions` in constructor |
| `scripts/build-validators.js` | Generates pre-compiled ajv validators |
| `src/lib/generated/validators.js` | Auto-generated pre-compiled validators |

#### Direct Usage

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

### Quick Start (JS)

```bash
# Install dependencies
npm install

# Build packages
npm run build

# Run the JS worker
npm run dev:js
```

### Package Usage

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = createOfrepHandler({ flags });

export default {
  fetch: handler,
};
```

See [packages/js-ofrep-worker/README.md](packages/js-ofrep-worker/README.md) for full documentation.

---

## Rust Worker

### The Challenge

The standard flagd Rust SDK (`open-feature-flagd` crate) cannot compile to WASM for Cloudflare Workers.

**Important clarification:** Cloudflare Workers *do* support async Rust via [`wasm-bindgen-futures`](https://rustwasm.github.io/wasm-bindgen/api/wasm_bindgen_futures/), which bridges Rust Futures to JavaScript Promises. The `workers-rs` crate uses this automatically. **The problem is specifically `tokio`, not async in general.**

The `open-feature` Rust crate **unconditionally** depends on `tokio`, which depends on `mio` for I/O polling:

```
open-feature v0.2.7
└── tokio v1.49.0
    └── mio v1.1.1  ← Uses system calls (epoll/kqueue) not available in WASM
```

Even with `--no-default-features`, the `open-feature` crate still pulls in tokio. This is a limitation of the upstream crate design.

| Dependency | Usage | Problem |
|------------|-------|---------|
| `tokio` | Async runtime | Uses `mio` for I/O which requires system calls |
| `open-feature` crate | OpenFeature SDK | Unconditionally depends on tokio |
| `mio` | I/O polling | Uses `epoll`/`kqueue`/etc. not available in WASM |

### The Solution

Since we cannot use the `open-feature` crate at all (it unconditionally pulls in tokio), we created a **fork of the flagd Rust SDK** with a new `wasm` feature that bypasses it entirely:

1. **Makes `open-feature` dependency optional**: The core evaluation logic doesn't need the full OpenFeature SDK
2. **Creates `WasmEvaluationContext`**: A lightweight context type replacing `open_feature::EvaluationContext`
3. **Adds `SimpleFlagStore`**: Synchronous flag evaluation using `serde_json::Value` directly
4. **Gates async code**: All tokio-dependent code is behind `#[cfg(feature = "tokio")]`

The evaluation logic itself is synchronous (JSONLogic rules, fractional rollouts, etc.), so avoiding tokio doesn't limit functionality - it just requires alternative types for the evaluation context.

#### Fork Details

The fork is maintained at [`DevCycleHQ-Sandbox/rust-sdk-contrib`](https://github.com/DevCycleHQ-Sandbox/rust-sdk-contrib/tree/feat/wasm-support) on the `feat/wasm-support` branch.

**Key changes to the `flagd` crate:**

| File | Changes |
|------|---------|
| `Cargo.toml` | Added `wasm` feature, made `open-feature` optional |
| `src/lib.rs` | Gated `FlagdProvider`, `FlagdOptions` behind `#[cfg(feature = "tokio")]` |
| `src/wasm_context.rs` | New `WasmEvaluationContext` type for WASM environments |
| `src/resolver/in_process/simple_store.rs` | New `SimpleFlagStore` for sync evaluation |
| `src/resolver/in_process/targeting/mod.rs` | Updated to use `WasmEvaluationContext` in WASM mode |
| `src/resolver/in_process/model/mod.rs` | Gated `value_converter` module |
| `src/error.rs` | Added `FlagNotFound`, `FlagDisabled` error variants |

#### Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Rust Worker (WASM)                           │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              rust-ofrep-worker crate                      │  │
│  │  • OfrepHandler - HTTP request/response handling          │  │
│  │  • OFREP types (Request, Response, Error)                 │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │         open-feature-flagd (wasm feature)                 │  │
│  │  • SimpleFlagStore - sync flag evaluation                 │  │
│  │  • WasmEvaluationContext - lightweight context            │  │
│  │  • No tokio, no open-feature crate dependencies           │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Pure Rust Dependencies                       │  │
│  │  • datalogic-rs - JSONLogic evaluation                    │  │
│  │  • murmurhash3 - fractional rollout bucketing             │  │
│  │  • semver - semantic version comparison                   │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Key Benefits

- **Native WASM**: Compiles to WebAssembly bytecode, no `new Function()` restrictions
- **Smaller bundle**: ~562 KB gzipped vs JS implementation
- **Type safety**: Full Rust type checking at compile time
- **Same flag format**: Uses identical flagd JSON configuration

### Quick Start (Rust)

**Prerequisites:**
- Rust toolchain via `rustup`
- `wasm32-unknown-unknown` target: `rustup target add wasm32-unknown-unknown`
- Node.js 25+ (for wrangler)

```bash
# Build the Rust worker
cd examples/rust-worker
npx wrangler build

# Run locally
npx wrangler dev --port 8788
```

### Package Usage

```rust
use rust_ofrep_worker::{OfrepHandler, OfrepRequest};
use worker::*;

const FLAGS_JSON: &str = include_str!("flags.json");

#[event(fetch)]
async fn main(mut req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    let handler = OfrepHandler::new(FLAGS_JSON)?;
    
    let body: OfrepRequest = req.json().await.unwrap_or_default();
    match handler.evaluate_flag("my-flag", &body) {
        Ok(result) => Response::from_json(&result),
        Err(error) => Response::from_json(&error),
    }
}
```

See [packages/rust-ofrep-worker/README.md](packages/rust-ofrep-worker/README.md) for full documentation.

---

## OFREP API Reference

Both JS and Rust workers expose identical OFREP endpoints:

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

Both implementations support all flagd targeting features:

| Feature | Description | Example |
|---------|-------------|---------|
| JSONLogic rules | Complex conditional logic | `{"if": [{"==": [{"var": "plan"}, "premium"]}, "on", "off"]}` |
| Fractional evaluation | Percentage-based rollouts | `{"fractional": [["control", 50], ["treatment", 50]]}` |
| String comparison | `starts_with`, `ends_with` | `{"starts_with": [{"var": "email"}, "admin"]}` |
| Semantic versioning | Version comparison | `{"sem_ver": [{"var": "version"}, ">=", "2.0.0"]}` |

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/). See [examples/js-worker/src/flags.json](examples/js-worker/src/flags.json) for examples.

---

## Comparison: JS vs Rust

| Aspect | JavaScript Worker | Rust Worker |
|--------|-------------------|-------------|
| Bundle size (gzip) | ~180 KB | ~562 KB |
| Evaluation engine | json-logic-engine (interpreted) | datalogic-rs (native) |
| Build time | Fast (~2s) | Slower (~10s) |
| Type safety | Runtime | Compile-time |
| Dependencies | Fork of flagd-core | Fork of flagd Rust SDK |
| Code generation | None (interpreter mode) | None (native WASM) |

Both implementations pass the same OFREP compliance tests and support identical flag configurations.

---

## Roadmap / Future Enhancements

- [x] **JavaScript Worker**: Workers-compatible flagd-core fork
- [x] **Rust Worker**: WASM-compatible flagd Rust SDK fork
- [ ] **Upstream PRs**: Contribute Workers/WASM compatibility back to upstream repos
- [ ] **Performance Benchmarks**: Compare JS vs Rust evaluation performance
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

### Run JS Worker

```bash
npm run dev:js
```

### Run Rust Worker

```bash
cd examples/rust-worker
npx wrangler dev --port 8788
```

### Update Submodules

```bash
# JS SDK contrib
cd contrib/js-sdk-contrib
git pull origin feat/workers-compatibility

# Rust SDK contrib
cd contrib/rust-sdk-contrib
git pull origin feat/wasm-support
```

### Regenerate JS Pre-compiled Validators

If the flagd JSON schemas change:

```bash
cd contrib/js-sdk-contrib/libs/shared/flagd-core
npm run build:validators
```

---

## Related Projects

- [flagd](https://flagd.dev/) - Feature flag evaluation engine
- [OpenFeature](https://openfeature.dev/) - Open standard for feature flags
- [OFREP Specification](https://github.com/open-feature/protocol) - OpenFeature Remote Evaluation Protocol
- [js-sdk-contrib](https://github.com/open-feature/js-sdk-contrib) - OpenFeature JavaScript SDK contributions
- [rust-sdk-contrib](https://github.com/open-feature/rust-sdk-contrib) - OpenFeature Rust SDK contributions
- [flagd-evaluator](https://github.com/open-feature-forking/flagd-evaluator) - Standalone WASM-first flagd evaluator (alternative approach, see [comparison](docs/rust-wasm-approaches.md))

## License

Apache-2.0
