# Deploy OFREP JavaScript Worker for Remote Load Testing

## Context

The repository deploy target is the JavaScript worker:

- **JS Worker** - [examples/js-worker/wrangler.toml](examples/js-worker/wrangler.toml)

This is a public repo, so checked-in config must remain generic and avoid account-specific values.

## Deployment Modes

1. **Public workers.dev deployment**
   - Uses checked-in `wrangler.toml`
   - Easiest way to run remote benchmark checks
2. **Custom deployment config**
   - Use local, gitignored config files for account ID and routes
   - Better for production-like load testing

## Steps

1. Authenticate with Cloudflare:
   ```bash
   npx wrangler login
   ```

2. Build from repository root:
   ```bash
   npm run build
   ```

3. Deploy JS worker:
   ```bash
   npm run deploy:js
   ```

4. Run benchmark against deployed URL:
   ```bash
   k6 run --env WORKER_URL=https://your-worker.example.workers.dev benchmarks/k6/bulk-evaluation.js
   ```
