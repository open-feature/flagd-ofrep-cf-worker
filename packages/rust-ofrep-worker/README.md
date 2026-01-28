# rust-ofrep-worker

flagd OFREP handler for Cloudflare Workers in Rust - in-process flag evaluation compiled to native WASM.

## Overview

This crate provides a ready-to-use OFREP (OpenFeature Remote Evaluation Protocol) handler for Cloudflare Workers written in Rust. It uses the [flagd Rust SDK](https://github.com/open-feature/rust-sdk-contrib) with WASM support, performing flag evaluations entirely within the worker as native WebAssembly.

**Key Features:**
- Full OFREP API compliance
- Native WASM (no `eval` or `new Function()` restrictions)
- Supports flagd targeting rules (JSONLogic via datalogic-rs)
- Fractional evaluation (percentage rollouts via murmurhash3)
- Custom operators: `starts_with`, `ends_with`, `sem_ver`, `fractional`
- Smaller bundle size compared to JS implementation

## Installation

Add to your `Cargo.toml`:

```toml
[dependencies]
rust-ofrep-worker = { git = "https://github.com/open-feature/flagd-ofrep-cf-worker" }
```

## Quick Start

```rust
use rust_ofrep_worker::{OfrepHandler, OfrepRequest};
use worker::*;

const FLAGS_JSON: &str = r#"{
  "flags": {
    "my-feature": {
      "state": "ENABLED",
      "defaultVariant": "off",
      "variants": { "on": true, "off": false },
      "targeting": {
        "if": [{ "==": [{ "var": "plan" }, "premium"] }, "on", "off"]
      }
    }
  }
}"#;

#[event(fetch)]
async fn main(mut req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    let handler = OfrepHandler::new(FLAGS_JSON)?;
    
    // Single flag evaluation
    let body: OfrepRequest = req.json().await.unwrap_or_default();
    match handler.evaluate_flag("my-feature", &body) {
        Ok(result) => Response::from_json(&result),
        Err(error) => Response::from_json(&error),
    }
}
```

## API

### `OfrepHandler`

Main entry point for OFREP flag evaluation.

```rust
use rust_ofrep_worker::{OfrepHandler, OfrepRequest};

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

### Types

```rust
// Request body
pub struct OfrepRequest {
    pub context: Option<OfrepContext>,
}

// Evaluation context
pub struct OfrepContext {
    pub targeting_key: Option<String>,
    pub custom: HashMap<String, serde_json::Value>,
}

// Success response
pub struct OfrepSuccess {
    pub key: String,
    pub value: serde_json::Value,
    pub reason: String,
    pub variant: String,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

// Error response
pub struct OfrepError {
    pub key: String,
    pub error_code: String,
    pub error_details: String,
}

// Bulk response
pub struct OfrepBulkResponse {
    pub flags: Vec<OfrepSuccess>,
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}
```

## OFREP Endpoints

Implement these endpoints in your worker:

### `POST /ofrep/v1/evaluate/flags/{key}`

Evaluate a single flag.

**Request:**
```json
{
  "context": {
    "targetingKey": "user-123",
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
  "variant": "on"
}
```

### `POST /ofrep/v1/evaluate/flags`

Bulk evaluate all flags.

**Response (200):**
```json
{
  "flags": [
    {
      "key": "my-feature",
      "value": true,
      "reason": "STATIC",
      "variant": "on"
    }
  ]
}
```

## How It Works

This crate uses the flagd Rust SDK with the `wasm` feature enabled, which:

1. **Compiles to native WASM bytecode** - no runtime code generation
2. **Uses datalogic-rs** for JSONLogic evaluation (pure Rust, no JS)
3. **Uses murmurhash3** for deterministic fractional rollouts
4. **Avoids tokio/async runtime** - synchronous evaluation suitable for Workers

This makes the package fully compatible with Cloudflare Workers' V8 isolate security restrictions while being more efficient than the JavaScript equivalent.

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/).

### Supported Features

- Boolean, string, number, and object flag values
- JSONLogic targeting rules
- Fractional evaluation (percentage rollouts)
- Semantic version comparison
- String comparison (starts_with, ends_with)
- Flag metadata

### Example Configuration

```json
{
  "flags": {
    "feature-flag": {
      "state": "ENABLED",
      "defaultVariant": "off",
      "variants": {
        "on": true,
        "off": false
      },
      "targeting": {
        "if": [
          { "in": ["@company.com", { "var": "email" }] },
          "on",
          "off"
        ]
      }
    },
    "rollout-flag": {
      "state": "ENABLED",
      "defaultVariant": "control",
      "variants": {
        "control": "control",
        "treatment": "treatment"
      },
      "targeting": {
        "fractional": [
          { "cat": [{ "var": "$flagd.flagKey" }, { "var": "targetingKey" }] },
          ["control", 90],
          ["treatment", 10]
        ]
      }
    }
  }
}
```

## License

Apache-2.0
