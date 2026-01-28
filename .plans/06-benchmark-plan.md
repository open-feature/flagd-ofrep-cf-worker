# Benchmark Plan: OFREP Worker Bulk Evaluation Performance

## Objective

Compare the three OFREP worker implementations on **bulk flag evaluation** performance:
- **JS Worker** (port 8787)
- **Rust Worker** (port 8788)
- **Rust Forking Worker** (port 8789)

## Focus

Bulk evaluation endpoint: `POST /ofrep/v1/evaluate/flags`

Two test scenarios:
1. **Simple context** - Minimal attributes (baseline)
2. **Large context** - ~50 attributes (stress test context parsing/handling)

## Test Configuration

### Flag Count: 100 flags

Mix of flag types:
- 40 static flags (simple boolean, string, number, object)
- 30 targeted flags (various JSONLogic rules)
- 20 fractional rollout flags
- 10 complex targeting flags (nested conditions)

### Context Definitions

**Simple Context:**
```json
{
  "context": {
    "targetingKey": "user-12345"
  }
}
```

**Large Context (~50 attributes):**
```json
{
  "context": {
    "targetingKey": "user-12345",
    "email": "user@example.com",
    "plan": "premium",
    "role": "admin",
    "accountAge": 365,
    "country": "US",
    "region": "west",
    "city": "San Francisco",
    "locale": "en-US",
    "timezone": "America/Los_Angeles",
    "deviceType": "mobile",
    "deviceOS": "iOS",
    "deviceVersion": "17.0",
    "appVersion": "2.5.0",
    "appBuild": "1234",
    "browser": "Safari",
    "browserVersion": "17.0",
    "screenWidth": 390,
    "screenHeight": 844,
    "colorDepth": 24,
    "touchSupport": true,
    "cookiesEnabled": true,
    "language": "en",
    "languages": ["en", "es", "fr"],
    "connectionType": "wifi",
    "effectiveType": "4g",
    "downlink": 10.0,
    "rtt": 50,
    "userAgent": "Mozilla/5.0 ...",
    "referrer": "https://google.com",
    "utm_source": "google",
    "utm_medium": "cpc",
    "utm_campaign": "summer_sale",
    "sessionId": "sess_abc123",
    "sessionCount": 5,
    "lastVisit": "2024-01-15T10:30:00Z",
    "firstVisit": "2023-06-01T08:00:00Z",
    "totalPurchases": 12,
    "totalSpent": 599.99,
    "loyaltyTier": "gold",
    "subscriptionStatus": "active",
    "trialExpiry": null,
    "features": ["search", "export", "analytics"],
    "preferences": {
      "theme": "dark",
      "notifications": true,
      "newsletter": false,
      "language": "en"
    },
    "metadata": {
      "source": "web",
      "version": "2.0",
      "experimental": true
    }
  }
}
```

## Load Profiles

### Phase 1: Sequential (Baseline Latency)
- 1 VU (virtual user)
- 100 iterations
- Measures: raw request latency without concurrency overhead

### Phase 2: Low Concurrency
- 10 VUs
- 30 seconds duration
- Measures: performance under light load

## Directory Structure

```
benchmarks/
├── k6/
│   ├── bulk-evaluation.js      # Main benchmark script
│   └── config.js               # Worker URLs, contexts, thresholds
├── flags/
│   └── benchmark-flags.json    # 100 flags for benchmarking
├── results/
│   └── .gitkeep
└── README.md                   # Usage instructions
```

## k6 Benchmark Script Design

```javascript
// bulk-evaluation.js
import http from 'k6/http';
import { check } from 'k6';
import { CONFIG, SIMPLE_CONTEXT, LARGE_CONTEXT } from './config.js';

export const options = {
  scenarios: {
    // Sequential baseline (1 VU, 100 iterations)
    sequential_simple: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 100,
      env: { CONTEXT_TYPE: 'simple' },
      tags: { context: 'simple', scenario: 'sequential' },
    },
    sequential_large: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 100,
      startTime: '20s',
      env: { CONTEXT_TYPE: 'large' },
      tags: { context: 'large', scenario: 'sequential' },
    },
    // Low concurrency (10 VUs, 30 seconds)
    concurrent_simple: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '45s',
      env: { CONTEXT_TYPE: 'simple' },
      tags: { context: 'simple', scenario: 'concurrent' },
    },
    concurrent_large: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '80s',
      env: { CONTEXT_TYPE: 'large' },
      tags: { context: 'large', scenario: 'concurrent' },
    },
  },
  thresholds: {
    'http_req_duration{context:simple}': ['p(95)<100'],
    'http_req_duration{context:large}': ['p(95)<200'],
    'http_req_failed': ['rate<0.01'],
  },
};

export default function () {
  const context = __ENV.CONTEXT_TYPE === 'large' ? LARGE_CONTEXT : SIMPLE_CONTEXT;
  const url = `${CONFIG.workerUrl}/ofrep/v1/evaluate/flags`;
  
  const response = http.post(url, JSON.stringify(context), {
    headers: { 'Content-Type': 'application/json' },
  });
  
  check(response, {
    'status is 200': (r) => r.status === 200,
    'has flags array': (r) => JSON.parse(r.body).flags !== undefined,
  });
}
```

## Running the Benchmark

### Prerequisites
```bash
# Install k6 (macOS)
brew install k6

# Or download from https://k6.io/docs/get-started/installation/
```

### Start Workers
```bash
# Terminal 1: JS Worker
cd examples/js-worker && npx wrangler dev --port 8787

# Terminal 2: Rust Worker  
cd examples/rust-worker && npx wrangler dev --port 8788

# Terminal 3: Rust Forking Worker
cd examples/rust-worker-forking && npx wrangler dev --port 8789
```

### Run Benchmarks
```bash
# Benchmark JS Worker
k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js

# Benchmark Rust Worker
k6 run --env WORKER_URL=http://localhost:8788 benchmarks/k6/bulk-evaluation.js

# Benchmark Rust Forking Worker
k6 run --env WORKER_URL=http://localhost:8789 benchmarks/k6/bulk-evaluation.js
```

## Metrics to Capture

| Metric | Description |
|--------|-------------|
| `http_req_duration` | Request latency (avg, p50, p95, p99, max) |
| `http_req_failed` | Error rate |
| `http_reqs` | Total requests / throughput (req/s) |
| `iterations` | Completed test iterations |

## Expected Output

```
scenarios: (4) sequential_simple, sequential_large, concurrent_simple, concurrent_large

     ✓ status is 200
     ✓ has flags array

     checks.........................: 100.00% ✓ 8000  ✗ 0
     http_req_duration{context:simple}: avg=12ms  min=8ms  med=11ms  max=45ms  p(90)=15ms  p(95)=18ms
     http_req_duration{context:large}:  avg=18ms  min=12ms med=16ms  max=62ms  p(90)=24ms  p(95)=28ms
     http_reqs......................: 8000    88.8/s
     iteration_duration.............: avg=12.5ms min=8ms  med=11ms  max=65ms  p(90)=16ms  p(95)=20ms
     iterations.....................: 8000    88.8/s
```

## Implementation Steps

1. **Create directory structure** - `benchmarks/k6/`, `benchmarks/flags/`, `benchmarks/results/`

2. **Generate benchmark-flags.json** - 100 flags with mix of types:
   - 40 static flags
   - 30 targeted flags
   - 20 fractional rollout flags
   - 10 complex targeting flags

3. **Create k6 config.js** - Worker URLs, context definitions, thresholds

4. **Create k6 bulk-evaluation.js** - Main benchmark script with 4 scenarios

5. **Update example workers** - Point to shared benchmark flags file

6. **Create benchmarks/README.md** - Usage instructions

7. **Test the setup** - Run against all 3 workers and verify results

## Future Enhancements

- [ ] Add markdown report generation via `handleSummary()`
- [ ] Add comparison script that runs all 3 workers and generates diff report
- [ ] Add deployed (non-local) worker support
- [ ] Add higher concurrency stress tests
- [ ] Add cold-start latency measurement
