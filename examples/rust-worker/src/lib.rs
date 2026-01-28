//! Example Rust Cloudflare Worker providing OFREP endpoints.
//!
//! This example demonstrates using the `rust-ofrep-worker` package to create
//! an OFREP-compliant feature flag evaluation service on Cloudflare Workers.

use rust_ofrep_worker::{OfrepHandler, OfrepRequest};
use worker::*;

// Include flags at compile time from the shared benchmark flags (100 flags)
const FLAGS_JSON: &str = include_str!("../../../benchmarks/flags/benchmark-flags.json");

#[event(fetch)]
async fn main(mut req: Request, _env: Env, _ctx: Context) -> Result<Response> {
    // Set up panic hook for better error messages
    console_error_panic_hook::set_once();

    // Initialize the OFREP handler with flags
    let handler = match OfrepHandler::new(FLAGS_JSON) {
        Ok(h) => h,
        Err(e) => {
            return Response::error(format!("Failed to initialize flag store: {}", e), 500);
        }
    };

    let url = req.url()?;
    let path = url.path();
    let method = req.method();

    // CORS headers helper
    let cors_headers = |mut resp: Response| -> Result<Response> {
        let headers = resp.headers_mut();
        headers.set("Access-Control-Allow-Origin", "*")?;
        headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")?;
        headers.set("Access-Control-Allow-Headers", "Content-Type")?;
        Ok(resp)
    };

    // Handle CORS preflight
    if method == Method::Options {
        return cors_headers(Response::empty()?);
    }

    // Route requests
    match (method, path.as_ref()) {
        // Health check
        (Method::Get, "/") => {
            cors_headers(Response::ok("flagd OFREP Rust Worker is running")?)
        }

        // Single flag evaluation
        (Method::Post, p) if p.starts_with("/ofrep/v1/evaluate/flags/") => {
            let flag_key = p.strip_prefix("/ofrep/v1/evaluate/flags/").unwrap_or("");

            if flag_key.is_empty() {
                return cors_headers(Response::error("Flag key required", 400)?);
            }

            let body: OfrepRequest = req.json().await.unwrap_or_default();

            match handler.evaluate_flag(flag_key, &body) {
                Ok(result) => cors_headers(Response::from_json(&result)?),
                Err(error) => {
                    let status = if error.error_code == "FLAG_NOT_FOUND" { 404 } else { 400 };
                    let mut resp = Response::from_json(&error)?;
                    resp = resp.with_status(status);
                    cors_headers(resp)
                }
            }
        }

        // Bulk flag evaluation
        (Method::Post, "/ofrep/v1/evaluate/flags") => {
            let body: OfrepRequest = req.json().await.unwrap_or_default();
            let result = handler.evaluate_all(&body);
            cors_headers(Response::from_json(&result)?)
        }

        // 404 for unknown routes
        _ => cors_headers(Response::error("Not Found", 404)?),
    }
}
