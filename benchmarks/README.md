# OFREP Worker Benchmarks

Performance benchmarks for the JavaScript OFREP worker using [k6](https://k6.io/).

## Overview

This benchmark suite tests **bulk flag evaluation** performance for:
- **JS Worker** (default: `http://localhost:8787`)

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

## Running Benchmarks

### 1. Start the JS worker

```bash
cd examples/js-worker
npx wrangler dev --port 8787
```

### 2. Run the benchmark

```bash
k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js
```

## Understanding Results

The benchmark outputs metrics for each scenario:

```text
================================================================================
BENCHMARK RESULTS: JS Worker
Worker URL: http://localhost:8787
================================================================================
```

### Key metrics

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

```text
benchmarks/
├── k6/
│   ├── bulk-evaluation.js    # Main benchmark script
│   └── config.js             # Configuration (URL, contexts, thresholds)
├── flags/
│   └── benchmark-flags.json  # 100 flags for testing
└── README.md                 # This file
```

## Remote benchmarking

Deploy the JS worker and run k6 against the deployed URL:

```bash
npx wrangler login
npm run build
npm run deploy:js
k6 run --env WORKER_URL=https://your-worker.example.workers.dev benchmarks/k6/bulk-evaluation.js
```
