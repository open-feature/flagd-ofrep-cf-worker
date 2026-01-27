# Plan: Rust Worker Research

## Overview

This document outlines the research needed before implementing the Rust-based Cloudflare Worker for OFREP flag evaluation.

## Goal

Create a Rust package that compiles to WASM and runs in Cloudflare Workers, using the existing `open-feature-flagd` Rust evaluation engine.

## Key Challenges

### 1. Tokio Runtime Dependency

The `open-feature-flagd` crate uses tokio extensively:

```rust
// Current architecture uses async throughout
#[async_trait]
impl FeatureProvider for FileResolver {
    async fn resolve_bool_value(...) -> Result<...> { ... }
}
```

**Cloudflare Workers don't support tokio.** The Workers runtime has its own async executor.

**Research needed:**
- [ ] Identify which parts of evaluation actually require async
- [ ] Can we extract a sync-only evaluation core?
- [ ] Does the `worker` crate provide compatible async primitives?

### 2. WASM Compatibility of Dependencies

| Dependency | Purpose | WASM Status | Notes |
|------------|---------|-------------|-------|
| `datalogic-rs` | JSONLogic engine | **Unknown** | Need to test compilation |
| `murmurhash3` | Fractional hashing | Likely OK | Pure computation |
| `semver` | Version comparison | Likely OK | Pure computation |
| `serde_json` | JSON parsing | OK | Works with WASM |
| `notify` | File watching | Not needed | Only for file sync mode |
| `tonic`/`prost` | gRPC | Not needed | Only for remote sync |
| `tokio` | Async runtime | **Incompatible** | Workers have own runtime |

**Research needed:**
- [ ] Test `datalogic-rs` compilation to `wasm32-unknown-unknown`
- [ ] Identify any other problematic dependencies
- [ ] Check if alternatives exist for incompatible deps

### 3. Relevant Code to Extract

From `rust-sdk-contrib/crates/flagd/src/`:

```
resolver/in_process/
├── model/
│   ├── feature_flag.rs    # Flag struct definitions
│   └── flag_parser.rs     # JSON → Flag parsing
├── targeting/
│   ├── mod.rs             # JSONLogic operator
│   ├── fractional.rs      # Fractional targeting
│   └── semver.rs          # Semver comparison
└── storage/
    └── mod.rs             # FlagStore (simplified needed)
```

**These components have minimal external dependencies and should be extractable.**

### 4. Architecture Options

#### Option A: Extract into `flagd-core-wasm` crate

Create a new crate with only the evaluation logic:

```rust
// flagd-core-wasm/src/lib.rs
pub struct FlagdCore { ... }

impl FlagdCore {
    pub fn new(config: &str) -> Result<Self, Error> { ... }
    pub fn resolve_bool(&self, key: &str, ctx: &Context) -> Result<bool, Error> { ... }
    // Sync API, no tokio
}
```

**Pros:** Clean separation, optimized for WASM
**Cons:** Code duplication, maintenance burden

#### Option B: Contribute upstream changes

Add feature flags to `open-feature-flagd` for WASM compatibility:

```toml
[features]
wasm = []  # Excludes tokio, uses sync APIs
```

**Pros:** No fork, benefits community
**Cons:** More complex, requires upstream buy-in

#### Option C: Minimal reimplementation

Reimplement only what's needed for OFREP in a Workers-native way:

```rust
// Simplified, Workers-specific implementation
pub fn evaluate_flag(config: &Value, key: &str, ctx: &Value) -> Result<Value, Error>
```

**Pros:** Simplest, most optimized
**Cons:** May diverge from flagd spec compliance

### 5. Recommended Approach

**Start with Option A** for this experimental repo:

1. Create `packages/rust-ofrep-worker/` as a standalone crate
2. Copy/adapt the evaluation logic from `open-feature-flagd`
3. Remove all async/tokio dependencies
4. Use sync APIs throughout
5. Expose a simple API for the OFREP handler

If successful, consider contributing back to upstream (Option B).

## Research Tasks

### Phase 1: Feasibility

- [ ] Create minimal Rust worker that compiles and deploys
- [ ] Test `datalogic-rs` WASM compilation
- [ ] Test `murmurhash3` WASM compilation
- [ ] Test `semver` WASM compilation

### Phase 2: Extraction

- [ ] Copy `FeatureFlag` struct and parser
- [ ] Copy targeting `Operator` logic
- [ ] Remove tokio/async dependencies
- [ ] Create sync evaluation API

### Phase 3: Integration

- [ ] Create OFREP handler using `worker` crate
- [ ] Handle request/response serialization
- [ ] Test against same flags as JS worker

### Phase 4: Optimization

- [ ] Enable LTO in release builds
- [ ] Run `wasm-opt` on output
- [ ] Measure binary size
- [ ] Compare performance with JS worker

## Lessons Learned from JS Worker

The JS implementation revealed that many JSONLogic libraries use dynamic code generation (`eval`/`new Function()`) which is **not allowed in Cloudflare Workers**. We had to use `json-logic-js` which is interpreter-based.

For Rust, we should verify that `datalogic-rs` doesn't use any `eval`-like patterns that would fail in WASM.

## Open Questions

1. **Does `datalogic-rs` work in WASM?**
   - This is the biggest unknown
   - If not, we may need an alternative JSONLogic implementation
   - Need to verify it doesn't use patterns that fail in WASM (dynamic code gen, file I/O, etc.)

2. **What's the WASM binary size budget?**
   - Cloudflare has limits on worker size
   - Need to measure and optimize

3. **How does the `worker` crate handle async?**
   - Does it provide async primitives we can use?
   - Or do we need fully sync code?

4. **Should we share flag config format with JS?**
   - Same JSON file for both workers?
   - Or allow platform-specific optimizations?

## Success Criteria

- [ ] Rust worker compiles to WASM
- [ ] Deploys successfully to Cloudflare
- [ ] Passes same OFREP compliance tests as JS worker
- [ ] Binary size under 1MB (ideally under 500KB)
- [ ] Performance is measurably different from JS (the point of comparison)

## Resources

- [Cloudflare Workers Rust docs](https://developers.cloudflare.com/workers/languages/rust/)
- [`worker` crate](https://crates.io/crates/worker)
- [datalogic-rs](https://crates.io/crates/datalogic-rs)
- [open-feature-flagd source](https://github.com/open-feature/rust-sdk-contrib/tree/main/crates/flagd)
