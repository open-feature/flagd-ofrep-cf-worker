# rust-ofrep-worker-forking

OFREP handler for Cloudflare Workers using the [forking-flagd-evaluator](https://github.com/open-feature-forking/flagd-evaluator) crate.

## Overview

This crate provides a ready-to-use OFREP (OpenFeature Remote Evaluation Protocol) handler for Cloudflare Workers. Unlike `rust-ofrep-worker` which uses a forked `rust-sdk-contrib`, this crate uses the standalone `flagd-evaluator` from the open-feature-forking organization.

**Key Features:**
- Full OFREP API compliance
- Native WASM (no `eval` or `new Function()` restrictions)
- Uses forking-flagd-evaluator for evaluation
- Supports flagd targeting rules (JSONLogic)
- Fractional evaluation (percentage rollouts)

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
rust-ofrep-worker-forking = { git = "https://github.com/open-feature/flagd-ofrep-cf-worker" }
```

## Quick Start

```rust
use rust_ofrep_worker_forking::{OfrepHandler, OfrepRequest};
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

## API

### `OfrepHandler`

Main entry point for OFREP flag evaluation.

```rust
use rust_ofrep_worker_forking::{OfrepHandler, OfrepRequest};

// Create handler with flags JSON
let handler = OfrepHandler::new(flags_json)?;

// Evaluate a single flag
let request = OfrepRequest::default();
let result = handler.evaluate_flag("my-flag", &request);

// Bulk evaluate all flags
let bulk_result = handler.evaluate_all(&request);

// Get flag keys
let keys = handler.flag_keys();

// Get store metadata
let metadata = handler.metadata();
```

## Comparison with rust-ofrep-worker

| Aspect | rust-ofrep-worker | rust-ofrep-worker-forking |
|--------|-------------------|---------------------------|
| Evaluation crate | Forked rust-sdk-contrib | forking-flagd-evaluator |
| Approach | Modified existing SDK | Standalone WASM-first evaluator |
| Context type | `WasmEvaluationContext` | `serde_json::Value` |

Both provide the same OFREP API and support the same flag configuration format.

## Related Projects

- [forking-flagd-evaluator](https://github.com/open-feature-forking/flagd-evaluator) - The underlying evaluation engine
- [rust-ofrep-worker](../rust-ofrep-worker/) - Alternative implementation using forked rust-sdk-contrib

## License

Apache-2.0
