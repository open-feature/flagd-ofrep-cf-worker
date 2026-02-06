# OFREP Worker Benchmarks

Performance benchmarks for comparing the three OFREP worker implementations using [k6](https://k6.io/).

## Overview

This benchmark suite tests **bulk flag evaluation** performance across:
- **JS Worker** (port 8787)
- **Rust Worker** (port 8788)
- **Rust Forking Worker** (port 8789)

## Test Configuration

### Flags
- **100 flags** with a mix of:
  - 40 static flags (boolean, string, number, object)
  - 30 targeted flags (JSONLogic rules)
  - 20 fractional rollout flags
  - 10 complex targeting flags (nested conditions)

### Contexts
- **Simple context**: Minimal attributes (`targetingKey` only)
- **Large context**: ~50 attributes including nested objects

### Load Profiles
- **Sequential**: 1 VU, 100 iterations (baseline latency)
- **Concurrent**: 10 VUs, 30 seconds (low concurrency)

## Prerequisites

### Install k6

**macOS:**
```bash
brew install k6
```

**Linux:**
```bash
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6
```

**Windows:**
```bash
choco install k6
# or
winget install k6
```

**Docker:**
```bash
docker pull grafana/k6
```

## Running Benchmarks

### 1. Start the Workers

Open three terminal windows:

**Terminal 1 - JS Worker:**
```bash
cd examples/js-worker
npx wrangler dev --port 8787
```

**Terminal 2 - Rust Worker:**
```bash
cd examples/rust-worker
npx wrangler dev --port 8788
```

**Terminal 3 - Rust Forking Worker:**
```bash
cd examples/rust-worker-forking
npx wrangler dev --port 8789
```

### 2. Run the Benchmark

**Benchmark JS Worker:**
```bash
k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js
```

**Benchmark Rust Worker:**
```bash
k6 run --env WORKER_URL=http://localhost:8788 benchmarks/k6/bulk-evaluation.js
```

**Benchmark Rust Forking Worker:**
```bash
k6 run --env WORKER_URL=http://localhost:8789 benchmarks/k6/bulk-evaluation.js
```

### 3. Run All Benchmarks

```bash
# Quick script to run all benchmarks
for port in 8787 8788 8789; do
  echo "=== Benchmarking worker on port $port ==="
  k6 run --env WORKER_URL=http://localhost:$port benchmarks/k6/bulk-evaluation.js
  echo ""
done
```

## Understanding Results

The benchmark outputs metrics for each scenario:

```
================================================================================
BENCHMARK RESULTS: JS Worker
Worker URL: http://localhost:8787
================================================================================

SIMPLE CONTEXT (minimal attributes):
  Requests:     100
  Average:      12.34ms
  Median (p50): 11.50ms
  p95:          18.00ms
  p99:          25.00ms
  Max:          45.00ms

LARGE CONTEXT (~50 attributes):
  Requests:     100
  Average:      15.67ms
  Median (p50): 14.20ms
  p95:          22.00ms
  p99:          32.00ms
  Max:          62.00ms

OVERALL:
  Total Requests: 8000
  Throughput:     88.80 req/s
  Failed:         0.00%
  Flags Returned: 800000
================================================================================
```

### Key Metrics

| Metric | Description |
|--------|-------------|
| **Average** | Mean request duration |
| **Median (p50)** | 50th percentile - half of requests are faster |
| **p95** | 95th percentile - 95% of requests are faster |
| **p99** | 99th percentile - 99% of requests are faster |
| **Max** | Slowest request |
| **Throughput** | Requests per second |

### Thresholds

The benchmark will **fail** if:
- Simple context p95 > 100ms
- Large context p95 > 200ms
- Error rate > 1%

## Files

```
benchmarks/
├── k6/
│   ├── bulk-evaluation.js    # Main benchmark script
│   └── config.js             # Configuration (URLs, contexts, thresholds)
├── flags/
│   └── benchmark-flags.json  # 100 flags for testing
├── results/
│   └── .gitkeep              # Results directory (gitignored)
└── README.md                 # This file
```

## Customization

### Change Worker URL

```bash
k6 run --env WORKER_URL=https://your-worker.example.com benchmarks/k6/bulk-evaluation.js
```

### Adjust Thresholds

Edit `benchmarks/k6/config.js`:
```javascript
export const THRESHOLDS = {
  simple: { p95: 100, p99: 200 },
  large: { p95: 200, p99: 400 },
  errorRate: 0.01,
};
```

### Modify Contexts

Edit `benchmarks/k6/config.js` to adjust `SIMPLE_CONTEXT` or `LARGE_CONTEXT`.

## Remote Benchmarking

You can deploy the workers to Cloudflare and run benchmarks against the deployed instances for more realistic performance data.

### Deploy to workers.dev

The simplest option -- deploy using the checked-in `wrangler.toml` configs:

```bash
# Login to your Cloudflare account
npx wrangler login

# Build JS packages first
npm run build

# Deploy all workers
npm run deploy:all
```

The deploy output will print the workers.dev URLs for each worker. Use those URLs with k6:

```bash
k6 run --env WORKER_URL=https://ofrep-flagd-js-worker.<your-subdomain>.workers.dev benchmarks/k6/bulk-evaluation.js
```

> **Note:** `workers.dev` subdomains are treated as Cloudflare's Free website tier, which may apply different DDoS mitigation behavior under heavy load. For serious load testing, consider deploying with a custom wrangler config that uses custom domain routes on a zone you control.

### Deploy with custom config

For production-like load testing, create a custom wrangler config with your account ID and domain routes:

```bash
cd examples/js-worker && npx wrangler deploy --config your-custom-wrangler.toml
cd examples/rust-worker && npx wrangler deploy --config your-custom-wrangler.toml
cd examples/rust-worker-forking && npx wrangler deploy --config your-custom-wrangler.toml
```

Then run benchmarks against the deployed URLs:

```bash
k6 run --env WORKER_URL=https://your-custom-domain.example.com benchmarks/k6/bulk-evaluation.js
```

## Troubleshooting

### "connection refused" errors
Make sure the workers are running on the expected ports.

### "k6: command not found"
Install k6 using the instructions above.

### Inconsistent results
- Ensure no other processes are using significant CPU
- Run benchmarks multiple times and average results
- Consider using `--vus` and `--duration` flags for longer tests
