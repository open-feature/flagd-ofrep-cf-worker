//! OFREP (OpenFeature Remote Evaluation Protocol) handler for Cloudflare Workers.
//!
//! This crate provides types and utilities for implementing OFREP endpoints
//! using the forking-flagd-evaluator crate compiled to WASM.
//!
//! # Example
//!
//! ```ignore
//! use rust_ofrep_worker_forking::{OfrepHandler, OfrepRequest};
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

use flagd_evaluator::{
    EvaluationResult as FlagdResult, ErrorCode as FlagdErrorCode, FlagEvaluator,
    ResolutionReason, ValidationMode,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

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
    pub custom: HashMap<String, Value>,
}

/// OFREP successful evaluation response.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OfrepSuccess {
    /// The flag key that was evaluated.
    pub key: String,
    /// The evaluated flag value.
    pub value: Value,
    /// The reason for the evaluation result (e.g., "STATIC", "TARGETING_MATCH").
    pub reason: String,
    /// The variant name that was selected.
    pub variant: String,
    /// Optional flag metadata.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, Value>>,
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
    pub metadata: Option<HashMap<String, Value>>,
}

/// Result type for single flag evaluation.
pub type EvaluateResult = Result<OfrepSuccess, OfrepError>;

/// OFREP request handler using forking-flagd-evaluator.
///
/// This handler provides OFREP-compliant flag evaluation using the
/// forking-flagd-evaluator crate compiled to WASM.
pub struct OfrepHandler {
    evaluator: FlagEvaluator,
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
    /// Returns `Ok(OfrepHandler)` on success, or an error string if the JSON is invalid.
    pub fn new(flags_json: &str) -> Result<Self, String> {
        let mut evaluator = FlagEvaluator::new(ValidationMode::Permissive);
        let response = evaluator.update_state(flags_json)?;

        if !response.success {
            return Err(response.error.unwrap_or_else(|| "Unknown error".to_string()));
        }

        Ok(Self { evaluator })
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
        let context = to_json_context(request.context.as_ref());
        let result = self.evaluator.evaluate_flag(flag_key, &context);
        to_ofrep_result(flag_key, result)
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
        let context = to_json_context(request.context.as_ref());

        let flags: Vec<OfrepSuccess> = match self.evaluator.get_state() {
            Some(state) => state
                .flags
                .keys()
                .filter_map(|key| {
                    let result = self.evaluator.evaluate_flag(key, &context);
                    to_ofrep_result(key, result).ok()
                })
                .collect(),
            None => Vec::new(),
        };

        OfrepBulkResponse {
            flags,
            metadata: self.metadata(),
        }
    }

    /// Get the list of all flag keys in the store.
    pub fn flag_keys(&self) -> Vec<&str> {
        match self.evaluator.get_state() {
            Some(state) => state.flags.keys().map(|s| s.as_str()).collect(),
            None => Vec::new(),
        }
    }

    /// Get the store-level metadata.
    pub fn metadata(&self) -> Option<HashMap<String, Value>> {
        self.evaluator.get_state().map(|state| {
            if state.flag_set_metadata.is_empty() {
                None
            } else {
                Some(state.flag_set_metadata.clone())
            }
        })?
    }
}

/// Convert OFREP context to serde_json::Value for flagd-evaluator.
fn to_json_context(ctx: Option<&OfrepContext>) -> Value {
    match ctx {
        None => Value::Object(serde_json::Map::new()),
        Some(ctx) => {
            let mut map = serde_json::Map::new();
            if let Some(key) = &ctx.targeting_key {
                map.insert("targetingKey".to_string(), Value::String(key.clone()));
            }
            for (k, v) in &ctx.custom {
                map.insert(k.clone(), v.clone());
            }
            Value::Object(map)
        }
    }
}

/// Convert flagd-evaluator result to OFREP format.
fn to_ofrep_result(flag_key: &str, result: FlagdResult) -> EvaluateResult {
    match result.reason {
        ResolutionReason::FlagNotFound => Err(OfrepError {
            key: flag_key.to_string(),
            error_code: "FLAG_NOT_FOUND".to_string(),
            error_details: result
                .error_message
                .unwrap_or_else(|| format!("Flag not found: {}", flag_key)),
        }),
        ResolutionReason::Disabled => Err(OfrepError {
            key: flag_key.to_string(),
            error_code: "FLAG_NOT_FOUND".to_string(),
            error_details: result
                .error_message
                .unwrap_or_else(|| format!("Flag disabled: {}", flag_key)),
        }),
        ResolutionReason::Error => Err(OfrepError {
            key: flag_key.to_string(),
            error_code: match result.error_code {
                Some(FlagdErrorCode::FlagNotFound) => "FLAG_NOT_FOUND",
                Some(FlagdErrorCode::TypeMismatch) => "TYPE_MISMATCH",
                Some(FlagdErrorCode::ParseError) => "PARSE_ERROR",
                _ => "GENERAL",
            }
            .to_string(),
            error_details: result
                .error_message
                .unwrap_or_else(|| "Evaluation error".to_string()),
        }),
        _ => {
            let reason = match result.reason {
                ResolutionReason::Static => "STATIC",
                ResolutionReason::Default => "DEFAULT",
                ResolutionReason::TargetingMatch => "TARGETING_MATCH",
                ResolutionReason::Fallback => "FALLBACK",
                _ => "UNKNOWN",
            };

            Ok(OfrepSuccess {
                key: flag_key.to_string(),
                value: result.value,
                reason: reason.to_string(),
                variant: result.variant.unwrap_or_default(),
                metadata: result.flag_metadata,
            })
        }
    }
}

#[cfg(test)]
mod tests;
