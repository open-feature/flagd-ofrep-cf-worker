# Deploy OFREP Example Workers for Remote Load Testing

## Context

There are 3 example workers in this repo that need to be deployed for remote load testing:

- **JS Worker** - [examples/js-worker/wrangler.toml](examples/js-worker/wrangler.toml)
- **Rust Worker** - [examples/rust-worker/wrangler.toml](examples/rust-worker/wrangler.toml)
- **Rust Forking Worker** - [examples/rust-worker-forking/wrangler.toml](examples/rust-worker-forking/wrangler.toml)

This is a **public repo**, so no internal account IDs, domain names, or infrastructure details should appear in checked-in files.

### Two deployment modes

1. **Public (workers.dev)** -- Uses checked-in `wrangler.toml`. Anyone with a CF account can deploy. Note: `workers.dev` is treated as Cloudflare's Free website tier, which may interfere with heavy load tests.
2. **Custom config** -- Uses a gitignored `wrangler.devcycle.toml` with an org-specific account_id and custom domain routes. More representative for serious load testing.

## 1. Update public wrangler.toml files (checked in)

Clean up each worker's `wrangler.toml` -- no account_id, updated names and compat date (`2026-01-29`). These stay generic.

### JS Worker (`examples/js-worker/wrangler.toml`)

```toml
name = "ofrep-js-worker"
main = "src/index.ts"
compatibility_date = "2026-01-29"

[dev]
port = 8787
```

### Rust Worker (`examples/rust-worker/wrangler.toml`)

```toml
name = "ofrep-rust-worker"
main = "build/worker/shim.mjs"
compatibility_date = "2026-01-29"

[build]
command = "cargo install -q worker-build && worker-build --release"

[dev]
port = 8788
```

### Rust Forking Worker (`examples/rust-worker-forking/wrangler.toml`)

```toml
name = "ofrep-rust-forking-worker"
main = "build/worker/shim.mjs"
compatibility_date = "2026-01-29"

[build]
command = "cargo install -q worker-build && worker-build --release"
```

## 2. Create gitignored wrangler.devcycle.toml files

Create a `wrangler.devcycle.toml` in each example directory. These are full standalone configs (wrangler `--config` replaces the entire config, it does not merge). They contain the org-specific account_id, `workers_dev = false`, and custom routes.

These files will NOT be checked in.

## 3. Update .gitignore

Add `wrangler.devcycle.toml` pattern.

## 4. Update k6 benchmark config (public -- keep generic)

The existing config already supports `WORKER_URL` env var. Update `getWorkerName()` to handle remote URLs gracefully.

## 5. Add deploy scripts to root package.json (public -- generic only)

```json
"deploy:js": "npm run deploy --workspace=examples/js-worker",
"deploy:rust": "npx wrangler deploy --config examples/rust-worker/wrangler.toml",
"deploy:rust-forking": "npx wrangler deploy --config examples/rust-worker-forking/wrangler.toml",
"deploy:all": "npm run deploy:js && npm run deploy:rust && npm run deploy:rust-forking"
```

## 6. Update benchmarks README (public -- generic)

Add a "Remote Benchmarking" section with generic deployment and run instructions.

## 7. First-time deployment prerequisites

1. `npx wrangler login`
2. `npm run build` from root
3. `rustup target add wasm32-unknown-unknown` for Rust workers
4. Deploy with appropriate config
