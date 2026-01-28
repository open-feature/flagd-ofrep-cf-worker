# Plan: Rust OFREP Worker for Cloudflare Workers

## Overview

Create a Rust-based Cloudflare Worker that provides OFREP endpoints using the flagd evaluation engine compiled to WebAssembly (WASM).

## Cloudflare Workers Rust Stack

Based on [official documentation](https://developers.cloudflare.com/workers/languages/rust/):

- **`workers-rs` crate** (`worker`) - Rust bindings for Workers runtime APIs
- **`wasm-bindgen`** - JavaScript/Rust interop glue code  
- **`worker-build`** - Build tool that creates JS entrypoint and bundles WASM
- **Target**: `wasm32-unknown-unknown`

### Worker Entry Point Pattern

```rust
use worker::*;

#[event(fetch)]
async fn main(req: Request, env: Env, ctx: Context) -> Result<Response> {
    // Handle request
    Response::ok("Hello, World!")
}
```

### Required Setup

```bash
rustup target add wasm32-unknown-unknown
cargo install cargo-generate  # optional, for templates
```

### wrangler.toml Configuration

```toml
name = "my-worker"
main = "build/worker/shim.mjs"
compatibility_date = "2024-01-01"

[build]
command = "cargo install worker-build && worker-build --release"
```

### Binary Size Optimizations

```toml
[profile.release]
lto = true
strip = true
codegen-units = 1
opt-level = "s"
```

## Key Findings

### WASM Compatibility Assessment

| Dependency | Purpose | WASM Compatible |
|------------|---------|-----------------|
| `datalogic-rs` | JSONLogic evaluation | ✅ Yes - has `wasm` feature |
| `murmurhash3` | Fractional rollouts | ✅ Yes - pure Rust |
| `semver` | Version comparison | ✅ Yes - pure Rust |
| `tokio` | Async runtime | ⚠️ Make optional |
| `tonic`/`prost` | gRPC sync | ❌ Not needed |
| `notify` | File watching | ❌ Not needed |

### Key Difference from JS Implementation

**No `new Function()` problem!** Rust compiles to native WASM bytecode - no runtime code generation issues.

---

## Implementation Phases

### Phase 1: Add Fork as Submodule

```bash
git submodule add https://github.com/DevCycleHQ-Sandbox/rust-sdk-contrib.git contrib/rust-sdk-contrib
cd contrib/rust-sdk-contrib
git checkout -b feat/wasm-support
```

### Phase 2: Modify `crates/flagd/Cargo.toml`

#### 2.1 Make tokio optional

```toml
[dependencies]
tokio = { version = "1.48", features = ["sync", "time"], optional = true }
```

#### 2.2 Add wasm feature

```toml
[features]
# NEW: Minimal WASM feature - evaluation only, no async runtime
wasm = ["dep:datalogic-rs", "dep:murmurhash3", "dep:semver"]
```

### Phase 3: Create Simple Sync FlagStore

New file: `src/resolver/in_process/simple_store.rs`

- Synchronous flag storage (no tokio)
- Parse once from JSON string
- Evaluate using existing `Operator` (targeting)

### Phase 4: Conditional Compilation

Gate async storage/resolver behind `#[cfg(not(target_arch = "wasm32"))]`

### Phase 5: Create Rust Worker Package

```
packages/rust-ofrep-worker/
├── Cargo.toml
├── src/
│   ├── lib.rs
│   └── ofrep.rs
```

### Phase 6: Create Example Worker

```
examples/rust-worker/
├── Cargo.toml
├── src/lib.rs
├── wrangler.toml
└── flags.json -> ../../shared/flags.json
```

---

## Files to Create/Modify

### New Files
| File | Purpose |
|------|---------|
| `contrib/rust-sdk-contrib` | Git submodule |
| `crates/flagd/src/resolver/in_process/simple_store.rs` | Sync FlagStore for WASM |
| `packages/rust-ofrep-worker/` | Rust worker package |
| `examples/rust-worker/` | Example worker |

### Modified Files (in fork)
| File | Changes |
|------|---------|
| `crates/flagd/Cargo.toml` | Add `wasm` feature, make `tokio` optional |
| `crates/flagd/src/resolver/in_process/mod.rs` | Conditional compilation |
| `crates/flagd/src/lib.rs` | Export SimpleFlagStore for wasm |
| `crates/flagd/src/error.rs` | Add error variants if needed |

---

## Success Criteria

- [ ] Fork added as submodule
- [ ] `wasm` feature compiles without tokio
- [ ] SimpleFlagStore works synchronously
- [ ] Rust worker builds to WASM
- [ ] OFREP endpoints return correct responses
- [ ] Uses same flags.json as JS worker
