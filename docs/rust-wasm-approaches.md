# Rust WASM Approaches for flagd Evaluation

This document compares two approaches for running flagd evaluation in WebAssembly environments.

## Overview

There are two independent efforts to enable flagd flag evaluation in WASM:

1. **This repository** (`flagd-ofrep-cf-worker`) - Fork of rust-sdk-contrib with `wasm` feature
2. **flagd-evaluator** - Standalone WASM-first evaluator written from scratch

| Project | Repository | Approach |
|---------|------------|----------|
| flagd-ofrep-cf-worker | [open-feature/flagd-ofrep-cf-worker](https://github.com/open-feature/flagd-ofrep-cf-worker) | Fork existing SDK, add WASM support |
| flagd-evaluator | [open-feature/flagd-evaluator](https://github.com/open-feature/flagd-evaluator) | New standalone WASM-first crate |

---

## Architecture Comparison

### This Repository (Fork Approach)

```
┌─────────────────────────────────────────────────────────────────┐
│                 Cloudflare Worker (workers-rs)                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              rust-ofrep-worker crate                      │  │
│  │  • OfrepHandler, OFREP types                              │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │      rust-sdk-contrib/flagd (wasm feature)                │  │
│  │  • SimpleFlagStore, WasmEvaluationContext                 │  │
│  │  • Forked from upstream, ~500 lines changed               │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Shared Dependencies                          │  │
│  │  • datalogic-rs, murmurhash3, semver                      │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### flagd-evaluator (Standalone Approach)

```
┌─────────────────────────────────────────────────────────────────┐
│                    Any WASM Host Runtime                        │
│              (Chicory, Wasmtime, Cloudflare, etc.)              │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │                Language Bindings                          │  │
│  │  • Java wrapper (Chicory)                                 │  │
│  │  • Python wrapper (PyO3)                                  │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              flagd-evaluator.wasm                         │  │
│  │  • C-style FFI exports (alloc, dealloc, evaluate)         │  │
│  │  • Global singleton state (RefCell/Mutex)                 │  │
│  │  • Written from scratch, ~1300+ lines                     │  │
│  └───────────────────────────────────────────────────────────┘  │
│                            │                                    │
│                            ▼                                    │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │              Shared Dependencies                          │  │
│  │  • datalogic-rs, murmurhash3, semver, boon                │  │
│  └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Feature Comparison

### Core Libraries (Identical)

Both projects use the same core Rust libraries:

| Library | Purpose |
|---------|---------|
| `datalogic-rs` | JSONLogic rule evaluation |
| `murmurhash3` | Consistent hashing for fractional rollouts |
| `semver` | Semantic version comparison |
| `serde_json` | JSON serialization/deserialization |

### Implementation Differences

| Feature | This Repo | flagd-evaluator |
|---------|-----------|-----------------|
| **Strategy** | Fork existing SDK | Write from scratch |
| **Code changes** | ~500 lines modified | ~1300+ lines new |
| **Memory management** | Automatic (workers-rs) | Manual `alloc`/`dealloc` FFI |
| **State management** | Per-request instantiation | Global singleton |
| **Host functions** | None | `get_current_time_unix_seconds` import |
| **API style** | Rust library | C-style FFI exports |
| **Schema validation** | Inherited from flagd-core | `boon` crate (JSON Schema) |
| **Change detection** | Not implemented | Tracks changed flags |
| **Type-specific eval** | Generic `evaluate()` | `evaluate_bool()`, `evaluate_int()`, etc. |
| **Language bindings** | Rust only | Java, Python included |
| **Target runtime** | Cloudflare Workers | Any WASM host |

---

## API Comparison

### This Repository

```rust
use rust_ofrep_worker::{OfrepHandler, OfrepRequest};

// Create handler with flags JSON (per-request)
let handler = OfrepHandler::new(flags_json)?;

// Evaluate
let request = OfrepRequest { context: Some(ctx) };
let result = handler.evaluate_flag("my-flag", &request);
```

### flagd-evaluator

```rust
use flagd_evaluator::{FlagEvaluator, ValidationMode};

// Create evaluator (singleton pattern)
let mut evaluator = FlagEvaluator::new(ValidationMode::Strict);

// Update state (can detect changes)
let response = evaluator.update_state(config)?;
println!("Changed flags: {:?}", response.changed_flags);

// Evaluate with type checking
let bool_result = evaluator.evaluate_bool("my-flag", &json!({}));
let string_result = evaluator.evaluate_string("other-flag", &context);
```

### WASM FFI (flagd-evaluator only)

```c
// C-style exports for any WASM host
extern "C" {
    fn alloc(len: u32) -> *mut u8;
    fn dealloc(ptr: *mut u8, len: u32);
    fn update_state(config_ptr: *const u8, config_len: u32) -> u64;
    fn evaluate(flag_key_ptr: *mut u8, flag_key_len: u32, 
                context_ptr: *mut u8, context_len: u32) -> u64;
}
```

---

## When to Use Each

### Use This Repository (flagd-ofrep-cf-worker) When:

- Building specifically for **Cloudflare Workers**
- Want to stay close to **upstream rust-sdk-contrib**
- Need **workers-rs** integration (KV, Durable Objects, etc.)
- Prefer **minimal code changes** over a rewrite

### Use flagd-evaluator When:

- Need **portable WASM** that works with any runtime
- Building for **Java** (Chicory) or **Python** environments
- Want **explicit memory management** for FFI
- Need **change detection** for flag updates
- Want **type-specific evaluation** methods

---

## Potential Consolidation

Long-term, these approaches could be consolidated:

1. **flagd-evaluator as core** - Use as the portable WASM evaluation engine
2. **Thin wrappers** - Create runtime-specific wrappers:
   - `flagd-evaluator-cf-worker` - Cloudflare Workers wrapper
   - `flagd-evaluator-java` - Java/Chicory wrapper (already exists)
   - `flagd-evaluator-python` - Python wrapper (already exists)

This would:
- ✅ Eliminate duplicate evaluation logic
- ✅ Ensure consistent behavior across all platforms
- ✅ Reduce maintenance burden
- ❌ Require refactoring this repository

---

## References

- [flagd-evaluator repository](https://github.com/open-feature/flagd-evaluator)
- [rust-sdk-contrib wasm feature](https://github.com/DevCycleHQ-Sandbox/rust-sdk-contrib/tree/feat/wasm-support)
- [Cloudflare Workers Rust documentation](https://developers.cloudflare.com/workers/languages/rust/)
- [Chicory - Pure Java WASM runtime](https://github.com/nicknisi/chicory)
