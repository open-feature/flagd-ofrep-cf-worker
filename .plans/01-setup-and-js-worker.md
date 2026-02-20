# Plan: Setup and JavaScript Worker Implementation

## Overview

This plan covers repository setup and implementation of a JavaScript OFREP Cloudflare Worker.

## Goals

1. Keep a monorepo centered on the JS implementation.
2. Use the `@openfeature/flagd-core` evaluation engine path that works in Cloudflare Workers.
3. Expose OFREP API endpoints for single and bulk evaluation.
4. Bundle flag configurations at build time for local development and deployment.

## Repository Structure

```text
flagd-ofrep-cf-worker/
├── .plans/
├── package.json
├── packages/
│   └── js-ofrep-worker/
├── examples/
│   └── js-worker/
└── shared/
    └── test-flags.json
```

## JS Package Design

### API

```typescript
import { createOfrepHandler, FlagStore } from '@openfeature/flagd-ofrep-cf-worker';

const handler = createOfrepHandler({ flags: flagConfigJson });
const store = new FlagStore(flagConfigJson);
```

### OFREP endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ofrep/v1/evaluate/flags/{key}` | POST | Evaluate single flag |
| `/ofrep/v1/evaluate/flags` | POST | Bulk evaluate all flags |

## Implementation Checklist

1. [x] Create directory structure
2. [x] Create planning docs
3. [x] Initialize npm workspaces
4. [x] Create shared test flags
5. [x] Implement JS package
6. [x] Create JS worker example
7. [ ] Verify locally with `wrangler dev`

## Success Criteria

- [ ] `npm install` works from root
- [ ] `npm run build` builds JS package and example
- [ ] Example worker starts with `wrangler dev`
- [ ] OFREP endpoints return expected responses
