# Benchmark Plan: OFREP Worker Bulk Evaluation Performance

## Objective

Measure bulk flag evaluation performance for the JavaScript OFREP worker:

- **JS Worker** (`http://localhost:8787`)

## Focus

Endpoint under test:

- `POST /ofrep/v1/evaluate/flags`

Scenarios:
1. **Simple context** - minimal attributes
2. **Large context** - ~50 attributes to stress context handling

## Load Profiles

### Phase 1: Sequential
- 1 VU
- 100 iterations
- Baseline latency

### Phase 2: Low concurrency
- 10 VUs
- 30 seconds
- Light-load behavior

## Runbook

### Start worker

```bash
cd examples/js-worker
npx wrangler dev --port 8787
```

### Run benchmark

```bash
k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js
```

## Metrics

| Metric | Description |
|--------|-------------|
| `http_req_duration` | Request latency (avg, p50, p95, p99, max) |
| `http_req_failed` | Error rate |
| `http_reqs` | Throughput (requests/second) |
| `iterations` | Completed iterations |

## Pass Criteria

- Simple context p95 < 100ms
- Large context p95 < 200ms
- Error rate < 1%
