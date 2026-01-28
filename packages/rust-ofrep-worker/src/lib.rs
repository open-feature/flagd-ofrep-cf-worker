//! OFREP (OpenFeature Remote Evaluation Protocol) handler for Cloudflare Workers.
//!
//! This crate provides types and utilities for implementing OFREP endpoints
//! using the flagd evaluation engine compiled to WASM.
//!
//! # Example
//!
//! ```ignore
//! use rust_ofrep_worker::{OfrepHandler, OfrepRequest};
//!
//! // Initialize once with your flags JSON
//! let handler = OfrepHandler::new(FLAGS_JSON)?;
//!
//! // Evaluate a single flag
//! let request = OfrepRequest { context: None };
//! let result = handler.evaluate_flag("my-flag", &request);
//!
//! // Bulk evaluate all flags
//! let bulk_result = handler.evaluate_all(&request);
//! ```

use open_feature_flagd::{SimpleFlagStore, WasmEvaluationContext};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Re-export for convenience
pub use open_feature_flagd::error::FlagdError;

/// OFREP evaluation request body.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
pub struct OfrepRequest {
    /// Evaluation context containing targeting key and custom fields.
    #[serde(default)]
    pub context: Option<OfrepContext>,
}

/// OFREP evaluation context.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OfrepContext {
    /// The targeting key used for consistent bucketing in fractional rollouts.
    #[serde(default)]
    pub targeting_key: Option<String>,
    /// Custom fields for targeting rules.
    #[serde(flatten)]
    pub custom: HashMap<String, serde_json::Value>,
}

/// OFREP successful evaluation response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfrepSuccess {
    /// The flag key that was evaluated.
    pub key: String,
    /// The evaluated flag value.
    pub value: serde_json::Value,
    /// The reason for the evaluation result (e.g., "STATIC", "TARGETING_MATCH").
    pub reason: String,
    /// The variant name that was selected.
    pub variant: String,
    /// Optional flag metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// OFREP error response.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct OfrepError {
    /// The flag key that was evaluated.
    pub key: String,
    /// The error code (e.g., "FLAG_NOT_FOUND", "GENERAL").
    pub error_code: String,
    /// Human-readable error details.
    pub error_details: String,
}

/// OFREP bulk evaluation response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfrepBulkResponse {
    /// List of successfully evaluated flags.
    pub flags: Vec<OfrepSuccess>,
    /// Optional store-level metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, serde_json::Value>>,
}

/// Result type for single flag evaluation.
pub type EvaluateResult = Result<OfrepSuccess, OfrepError>;

/// OFREP request handler using flagd evaluation engine.
///
/// This handler provides OFREP-compliant flag evaluation using the flagd
/// in-process evaluation engine compiled to WASM.
pub struct OfrepHandler {
    store: SimpleFlagStore,
}

impl OfrepHandler {
    /// Create a new OFREP handler with the given flags JSON.
    ///
    /// # Arguments
    ///
    /// * `flags_json` - JSON string containing flagd flag configuration
    ///
    /// # Returns
    ///
    /// Returns `Ok(OfrepHandler)` on success, or an error if the JSON is invalid.
    ///
    /// # Example
    ///
    /// ```ignore
    /// let handler = OfrepHandler::new(r#"{
    ///   "flags": {
    ///     "my-flag": {
    ///       "state": "ENABLED",
    ///       "defaultVariant": "on",
    ///       "variants": { "on": true, "off": false }
    ///     }
    ///   }
    /// }"#)?;
    /// ```
    pub fn new(flags_json: &str) -> Result<Self, FlagdError> {
        let store = SimpleFlagStore::new(flags_json)?;
        Ok(Self { store })
    }

    /// Evaluate a single flag.
    ///
    /// # Arguments
    ///
    /// * `flag_key` - The key of the flag to evaluate
    /// * `request` - The OFREP request containing evaluation context
    ///
    /// # Returns
    ///
    /// Returns `Ok(OfrepSuccess)` with the evaluation result, or `Err(OfrepError)`
    /// if the flag was not found or evaluation failed.
    pub fn evaluate_flag(&self, flag_key: &str, request: &OfrepRequest) -> EvaluateResult {
        let context = to_evaluation_context(request.context.as_ref());
        evaluate_flag_internal(&self.store, flag_key, &context)
    }

    /// Evaluate all enabled flags.
    ///
    /// # Arguments
    ///
    /// * `request` - The OFREP request containing evaluation context
    ///
    /// # Returns
    ///
    /// Returns an `OfrepBulkResponse` containing all successfully evaluated flags.
    /// Flags that fail evaluation (disabled, errors) are omitted from the response.
    pub fn evaluate_all(&self, request: &OfrepRequest) -> OfrepBulkResponse {
        let context = to_evaluation_context(request.context.as_ref());

        let flags: Vec<OfrepSuccess> = self
            .store
            .flag_keys()
            .iter()
            .filter_map(|key| evaluate_flag_internal(&self.store, key, &context).ok())
            .collect();

        OfrepBulkResponse {
            flags,
            metadata: if self.store.metadata().is_empty() {
                None
            } else {
                Some(self.store.metadata().clone())
            },
        }
    }

    /// Get the list of all flag keys in the store.
    pub fn flag_keys(&self) -> Vec<&str> {
        self.store.flag_keys()
    }

    /// Get the store-level metadata.
    pub fn metadata(&self) -> &HashMap<String, serde_json::Value> {
        self.store.metadata()
    }
}

/// Convert OFREP context to WasmEvaluationContext.
fn to_evaluation_context(ctx: Option<&OfrepContext>) -> WasmEvaluationContext {
    let mut eval_ctx = WasmEvaluationContext::new();

    if let Some(ctx) = ctx {
        if let Some(key) = &ctx.targeting_key {
            eval_ctx = eval_ctx.with_targeting_key(key.clone());
        }

        for (key, value) in &ctx.custom {
            eval_ctx = match value {
                serde_json::Value::String(s) => eval_ctx.with_custom_field(key.clone(), s.clone()),
                serde_json::Value::Bool(b) => eval_ctx.with_custom_field(key.clone(), *b),
                serde_json::Value::Number(n) => {
                    if let Some(i) = n.as_i64() {
                        eval_ctx.with_custom_field(key.clone(), i)
                    } else if let Some(f) = n.as_f64() {
                        eval_ctx.with_custom_field(key.clone(), f)
                    } else {
                        eval_ctx
                    }
                }
                _ => eval_ctx, // Skip complex types for now
            };
        }
    }

    eval_ctx
}

/// Internal flag evaluation function.
fn evaluate_flag_internal(
    store: &SimpleFlagStore,
    flag_key: &str,
    context: &WasmEvaluationContext,
) -> EvaluateResult {
    match store.evaluate(flag_key, context) {
        Ok(result) => Ok(OfrepSuccess {
            key: flag_key.to_string(),
            value: result.value,
            reason: result.reason,
            variant: result.variant,
            metadata: if result.flag_metadata.is_empty() {
                None
            } else {
                Some(result.flag_metadata)
            },
        }),
        Err(e) => {
            let (code, details) = match &e {
                FlagdError::FlagNotFound(_) => ("FLAG_NOT_FOUND", e.to_string()),
                FlagdError::FlagDisabled(_) => ("FLAG_NOT_FOUND", e.to_string()),
                _ => ("GENERAL", e.to_string()),
            };
            Err(OfrepError {
                key: flag_key.to_string(),
                error_code: code.to_string(),
                error_details: details,
            })
        }
    }
}

#[cfg(test)]
mod tests;
