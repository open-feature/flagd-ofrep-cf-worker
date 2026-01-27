# Plan: Setup & JS Worker Implementation

## Overview

This plan covers setting up the flagd OFREP Cloudflare Workers repository and implementing the JavaScript worker.

## Goals

1. Create a monorepo with reusable packages for JS (and later Rust) OFREP workers
2. Use the existing `@openfeature/flagd-core` evaluation engine
3. Expose OFREP API endpoints for flag evaluation
4. Bundle flag configurations at build time (MVP)

## Repository Structure

```
flagd-ofrep-cf-worker/
├── .plans/                            # Planning documents
├── README.md                          # Project overview
├── package.json                       # Root (npm workspaces)
├── packages/
│   ├── js-ofrep-worker/              # Reusable JS package
│   │   ├── src/
│   │   │   ├── index.ts              # Main exports
│   │   │   ├── ofrep-handler.ts      # OFREP request handler
│   │   │   ├── flag-store.ts         # Flag configuration storage
│   │   │   └── types.ts              # OFREP types
│   │   └── package.json              # @openfeature/flagd-ofrep-cf-worker
│   │
│   └── rust-ofrep-worker/            # (Phase 2)
│
├── examples/
│   ├── js-worker/                    # Runnable JS worker
│   │   ├── src/index.ts
│   │   ├── src/flags.json
│   │   └── wrangler.toml
│   │
│   └── rust-worker/                  # (Phase 2)
│
└── shared/
    └── test-flags.json               # Shared test flags
```

## JS Package Design

### API

```typescript
import { createOfrepHandler, FlagStore } from '@openfeature/flagd-ofrep-cf-worker';

// Option 1: Simple handler creation
const handler = createOfrepHandler({
  flags: flagConfigJson,
});

// Option 2: More control
const store = new FlagStore(flagConfigJson);
const handler = createOfrepHandler({ store });

export default { fetch: handler };
```

### OFREP Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/ofrep/v1/evaluate/flags/{key}` | POST | Evaluate single flag |
| `/ofrep/v1/evaluate/flags` | POST | Bulk evaluate all flags |

### Dependencies

- `@openfeature/core` - OpenFeature types
- `json-logic-js` - Interpreter-based JSONLogic (Workers-compatible)
- `imurmurhash` - MurmurHash for fractional evaluation

> **Important**: The original `@openfeature/flagd-core` package cannot be used directly in Cloudflare Workers because it depends on:
> - `ajv` - JSON schema validation (uses `new Function()`)
> - `json-logic-engine` - JSONLogic compilation (uses `new Function()`)
> 
> We created a Workers-compatible implementation using `json-logic-js` (interpreter-based) instead.

## Implementation Steps

1. [x] Create directory structure
2. [x] Create plan documents
3. [ ] Initialize npm workspaces
4. [ ] Create shared test flags
5. [ ] Implement JS package
6. [ ] Create example worker
7. [ ] Test locally with wrangler

## Test Flags

The `shared/test-flags.json` should include:
- Simple boolean flag (no targeting)
- String flag with variants
- Flag with JSONLogic targeting rules
- Flag with fractional evaluation
- Disabled flag

## Success Criteria

- [ ] `npm install` works from root
- [ ] `npm run build` builds the package
- [ ] Example worker starts with `wrangler dev`
- [ ] OFREP endpoints return correct responses
- [ ] All targeting features work (fractional, semver, string-comp)
