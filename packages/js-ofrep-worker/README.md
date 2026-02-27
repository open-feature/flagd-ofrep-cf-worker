# @openfeature/flagd-ofrep-cf-worker

flagd OFREP handler for Fetch-compatible edge runtimes with in-process flag evaluation.

## Overview

This package provides a ready-to-use OFREP (OpenFeature Remote Evaluation Protocol) handler for Fetch-compatible runtimes. It uses a [forked version of `@openfeature/flagd-core`](https://github.com/DevCycleHQ-Sandbox/js-sdk-contrib/tree/feat/workers-compatibility) with workers compatibility mode, performing flag evaluations entirely in-process at the edge.

**Key Features:**

- Full OFREP API compliance
- Isolate-compatible (no `eval` or `new Function()`)
- Supports flagd targeting rules (JSONLogic)
- Fractional evaluation (percentage rollouts)
- Custom operators: `starts_with`, `ends_with`, `sem_ver`, `fractional`

## Installation

```bash
npm install @openfeature/flagd-ofrep-cf-worker
```

## Quick Start

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';

// Your flag configuration (flagd format)
const flags = {
  flags: {
    'my-feature': {
      state: 'ENABLED',
      defaultVariant: 'off',
      variants: {
        on: true,
        off: false,
      },
      targeting: {
        if: [{ '==': [{ var: 'plan' }, 'premium'] }, 'on', 'off'],
      },
    },
  },
};

// Create the handler
const handler = createOfrepHandler({ flags });

// Cloudflare Workers
export default {
  fetch: handler,
};

// Vercel Edge, Deno Deploy, or standard Fetch handlers
// export default handler;
```

## Runtime Compatibility

This package uses standard Fetch APIs (`Request`, `Response`, `URL`, and `Headers`) and works in runtimes that expose those APIs. Runtime-specific setup and entrypoint wiring are shown in the [examples](../../examples).

## API

### `createOfrepHandler(options)`

Creates a fetch handler for OFREP endpoints.

**Options:**

- `flags` (required): Flag configuration in flagd format (string or object)
- `basePath` (optional): Base path for OFREP endpoints. Default: `/ofrep/v1`
- `cors` (optional): Enable CORS headers. Default: `true`
- `corsOrigin` (optional): CORS origin. Default: `*`

### `FlagStore`

Lower-level API for flag evaluation if you need more control.

```typescript
import { FlagStore } from '@openfeature/flagd-ofrep-cf-worker';

const store = new FlagStore(flags);

// Evaluate specific flag types
const boolResult = store.resolveBooleanValue('my-flag', false, context);
const stringResult = store.resolveStringValue('my-flag', 'default', context);

// Evaluate all flags
const allFlags = store.resolveAll(context);
```

### `OfrepHandler`

Class-based API for more control over the handler.

```typescript
import { OfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';

const handler = new OfrepHandler({ flags });

// Update flags at runtime
handler.setFlags(newFlags);

// Handle requests
const response = await handler.handleRequest(request);
```

## OFREP Endpoints

The handler exposes two OFREP endpoints:

### `POST /ofrep/v1/evaluate/flags/{key}`

Evaluate a single flag.

**Request:**

```json
{
  "context": {
    "targetingKey": "user-123",
    "plan": "premium"
  }
}
```

**Response (200):**

```json
{
  "key": "my-feature",
  "value": true,
  "reason": "TARGETING_MATCH",
  "variant": "on"
}
```

### `POST /ofrep/v1/evaluate/flags`

Bulk evaluate all flags.

**Request:**

```json
{
  "context": {
    "targetingKey": "user-123"
  }
}
```

**Response (200):**

```json
{
  "flags": [
    {
      "key": "my-feature",
      "value": true,
      "reason": "STATIC",
      "variant": "on"
    }
  ]
}
```

## How It Works

This package wraps `@openfeature/flagd-core` with workers compatibility mode enabled (`{ workers: true }`). This mode:

1. **Uses pre-compiled JSON Schema validators** instead of runtime `ajv.compile()`, avoiding `new Function()`
2. **Uses JSONLogic interpreter mode** (`.run()`) instead of compilation (`.build()`), avoiding `new Function()`

This makes the package compatible with restricted edge runtime environments that block dynamic code generation.

## Flag Configuration

Flags use the [flagd flag definition format](https://flagd.dev/reference/flag-definitions/).

### Supported Features

- Boolean, string, number, and object flag values
- JSONLogic targeting rules
- Fractional evaluation (percentage rollouts)
- Semantic version comparison
- String comparison (starts_with, ends_with)
- Flag metadata
- Shared evaluators (`$evaluators`)

### Example Configuration

```json
{
  "flags": {
    "feature-flag": {
      "state": "ENABLED",
      "defaultVariant": "off",
      "variants": {
        "on": true,
        "off": false
      },
      "targeting": {
        "if": [{ "in": ["@company.com", { "var": "email" }] }, "on", "off"]
      }
    },
    "rollout-flag": {
      "state": "ENABLED",
      "defaultVariant": "control",
      "variants": {
        "control": "control",
        "treatment": "treatment"
      },
      "targeting": {
        "fractional": [
          { "cat": [{ "var": "$flagd.flagKey" }, { "var": "targetingKey" }] },
          ["control", 90],
          ["treatment", 10]
        ]
      }
    }
  }
}
```

## License

Apache-2.0
