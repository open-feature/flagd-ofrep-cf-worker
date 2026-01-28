/**
 * k6 Benchmark: OFREP Bulk Flag Evaluation
 * 
 * Compares performance of JS, Rust, and Rust Forking workers
 * on bulk flag evaluation with simple and large contexts.
 * 
 * Usage:
 *   k6 run --env WORKER_URL=http://localhost:8787 benchmarks/k6/bulk-evaluation.js
 *   k6 run --env WORKER_URL=http://localhost:8788 benchmarks/k6/bulk-evaluation.js
 *   k6 run --env WORKER_URL=http://localhost:8789 benchmarks/k6/bulk-evaluation.js
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Trend, Counter, Rate } from 'k6/metrics';
import { CONFIG, SIMPLE_CONTEXT, LARGE_CONTEXT, THRESHOLDS } from './config.js';

// Custom metrics for detailed tracking
const simpleDuration = new Trend('bulk_eval_simple_duration', true);
const largeDuration = new Trend('bulk_eval_large_duration', true);
const flagsReturned = new Counter('flags_returned');
const evalErrors = new Rate('evaluation_errors');

// Test configuration
export const options = {
  scenarios: {
    // Sequential baseline with simple context (1 VU, 100 iterations)
    sequential_simple: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 100,
      exec: 'simpleContext',
      tags: { context: 'simple', scenario: 'sequential' },
    },
    
    // Sequential baseline with large context (1 VU, 100 iterations)
    sequential_large: {
      executor: 'per-vu-iterations',
      vus: 1,
      iterations: 100,
      startTime: '15s', // Start after sequential_simple completes
      exec: 'largeContext',
      tags: { context: 'large', scenario: 'sequential' },
    },
    
    // Low concurrency with simple context (10 VUs, 30 seconds)
    concurrent_simple: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '35s', // Start after sequential tests
      exec: 'simpleContext',
      tags: { context: 'simple', scenario: 'concurrent' },
    },
    
    // Low concurrency with large context (10 VUs, 30 seconds)
    concurrent_large: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      startTime: '70s', // Start after concurrent_simple
      exec: 'largeContext',
      tags: { context: 'large', scenario: 'concurrent' },
    },
  },
  
  thresholds: {
    // Simple context thresholds
    'bulk_eval_simple_duration': [
      `p(95)<${THRESHOLDS.simple.p95}`,
      `p(99)<${THRESHOLDS.simple.p99}`,
    ],
    // Large context thresholds  
    'bulk_eval_large_duration': [
      `p(95)<${THRESHOLDS.large.p95}`,
      `p(99)<${THRESHOLDS.large.p99}`,
    ],
    // General thresholds
    'http_req_failed': [`rate<${THRESHOLDS.errorRate}`],
    'evaluation_errors': [`rate<${THRESHOLDS.errorRate}`],
  },
};

// Helper function to make bulk evaluation request
function bulkEvaluate(context, durationMetric) {
  const url = `${CONFIG.workerUrl}/ofrep/v1/evaluate/flags`;
  
  const response = http.post(url, JSON.stringify(context), {
    headers: { 'Content-Type': 'application/json' },
    tags: { endpoint: 'bulk_evaluate' },
  });
  
  // Record custom duration metric
  durationMetric.add(response.timings.duration);
  
  // Validate response
  const success = check(response, {
    'status is 200': (r) => r.status === 200,
    'response has flags array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.flags && Array.isArray(body.flags);
      } catch {
        return false;
      }
    },
    'returned expected flag count': (r) => {
      try {
        const body = JSON.parse(r.body);
        // We expect 100 flags (may be fewer if some are disabled)
        return body.flags && body.flags.length >= 90;
      } catch {
        return false;
      }
    },
  });
  
  // Track errors
  if (!success) {
    evalErrors.add(1);
  } else {
    evalErrors.add(0);
    // Count returned flags
    try {
      const body = JSON.parse(response.body);
      flagsReturned.add(body.flags ? body.flags.length : 0);
    } catch {
      // ignore
    }
  }
  
  return response;
}

// Scenario: Simple context
export function simpleContext() {
  bulkEvaluate(SIMPLE_CONTEXT, simpleDuration);
}

// Scenario: Large context
export function largeContext() {
  bulkEvaluate(LARGE_CONTEXT, largeDuration);
}

// Default function (not used with named scenarios, but required)
export default function () {
  simpleContext();
}

// Summary handler for custom output
export function handleSummary(data) {
  const workerUrl = CONFIG.workerUrl;
  const workerName = getWorkerName(workerUrl);
  
  // Build summary text
  let summary = `
================================================================================
BENCHMARK RESULTS: ${workerName}
Worker URL: ${workerUrl}
================================================================================

`;

  // Add scenario summaries
  if (data.metrics.bulk_eval_simple_duration) {
    const m = data.metrics.bulk_eval_simple_duration;
    summary += `
SIMPLE CONTEXT (minimal attributes):
  Requests:     ${m.values.count || 'N/A'}
  Average:      ${formatDuration(m.values.avg)}
  Median (p50): ${formatDuration(m.values.med)}
  p95:          ${formatDuration(m.values['p(95)'])}
  p99:          ${formatDuration(m.values['p(99)'])}
  Max:          ${formatDuration(m.values.max)}
`;
  }
  
  if (data.metrics.bulk_eval_large_duration) {
    const m = data.metrics.bulk_eval_large_duration;
    summary += `
LARGE CONTEXT (~50 attributes):
  Requests:     ${m.values.count || 'N/A'}
  Average:      ${formatDuration(m.values.avg)}
  Median (p50): ${formatDuration(m.values.med)}
  p95:          ${formatDuration(m.values['p(95)'])}
  p99:          ${formatDuration(m.values['p(99)'])}
  Max:          ${formatDuration(m.values.max)}
`;
  }
  
  // Add overall stats
  if (data.metrics.http_reqs) {
    summary += `
OVERALL:
  Total Requests: ${data.metrics.http_reqs.values.count}
  Throughput:     ${data.metrics.http_reqs.values.rate.toFixed(2)} req/s
  Failed:         ${data.metrics.http_req_failed ? (data.metrics.http_req_failed.values.rate * 100).toFixed(2) : 0}%
`;
  }
  
  if (data.metrics.flags_returned) {
    summary += `  Flags Returned: ${data.metrics.flags_returned.values.count}
`;
  }
  
  summary += `
================================================================================
`;

  return {
    stdout: summary,
    // Optionally write to file
    // [`results/benchmark-${workerName}-${Date.now()}.txt`]: summary,
  };
}

// Helper to format duration in ms
function formatDuration(ms) {
  if (ms === undefined || ms === null) return 'N/A';
  return `${ms.toFixed(2)}ms`;
}

// Helper to get worker name from URL
function getWorkerName(url) {
  if (url.includes(':8787')) return 'JS Worker';
  if (url.includes(':8788')) return 'Rust Worker';
  if (url.includes(':8789')) return 'Rust Forking Worker';
  return url;
}
