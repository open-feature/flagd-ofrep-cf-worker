# @openfeature/flagd-ofrep-cf-worker

[![npm version](https://img.shields.io/npm/v/@openfeature/flagd-ofrep-cf-worker)](https://www.npmjs.com/package/@openfeature/flagd-ofrep-cf-worker)
[![license](https://img.shields.io/npm/l/@openfeature/flagd-ofrep-cf-worker)](https://github.com/open-feature/flagd-ofrep-cf-worker/blob/main/LICENSE)
[![CI](https://github.com/open-feature/flagd-ofrep-cf-worker/actions/workflows/ci.yml/badge.svg)](https://github.com/open-feature/flagd-ofrep-cf-worker/actions/workflows/ci.yml)

Cloudflare Workers package for evaluating [flagd](https://flagd.dev/) flags in-process and serving [OFREP](https://github.com/open-feature/protocol) evaluation endpoints.

## Installation

```bash
npm install @openfeature/flagd-ofrep-cf-worker
```

## Minimal Usage

```typescript
import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = createOfrepHandler({ staticFlags: flags });

export default {
  fetch: handler,
};
```

`staticFlags` accepts a flagd-formatted JSON object or JSON string. Endpoints default to `/ofrep/v1`.

The handler does not emit CORS headers unless you opt in with `cors: true`. If you need browser access, prefer a specific `corsOrigin` instead of `*`.

## API

### `createOfrepHandler(options)`

Creates a fetch handler that serves:

- `POST /ofrep/v1/evaluate/flags/{key}`
- `POST /ofrep/v1/evaluate/flags`

Supported options:

- `staticFlags` (required): flagd-formatted flag config as an object or JSON string
- `basePath`: override the default `/ofrep/v1`
- `cors`: enable or disable CORS headers; defaults to `false`
- `corsOrigin`: override the default `*` origin

To expose the handler to browser-based clients, enable CORS explicitly:

```typescript
const handler = createOfrepHandler({
  staticFlags: flags,
  cors: true,
  corsOrigin: 'https://app.example.com',
});
```

### `OfrepHandler`

Class wrapper around the same handler logic. Use it when you want to call `handleRequest()` directly or replace flags later with `setFlags()`.

### `FlagStore`

Lower-level evaluation API for resolving individual flags or evaluating all flags outside the HTTP handler.

### `extractAuthToken`

Helper for reading bearer tokens from `Authorization` or API keys from `X-API-Key`.

### Types and re-exports

The package also exports OFREP request/response types plus selected types from `@openfeature/core` and `@openfeature/flagd-core`.

## Compatibility

This package is designed for Cloudflare Workers and uses `@openfeature/flagd-core@^2.0.0` with `disableDynamicCodeGeneration: true` so it avoids runtime code generation paths that are not allowed in the Workers runtime.

It supports the flagd features exercised by this repo's package and example worker, including JSONLogic targeting, fractional evaluation, semantic version comparison, string operators, metadata, and shared evaluators.

## Package Scope

This package provides the OFREP handler and evaluation primitives. Authentication enforcement, Hono routing, and R2-backed runtime config loading are application-level patterns shown in `examples/js-worker/src/index.ts`.

If you want that auth flow, the package exports `extractAuthToken()`, but your worker is still responsible for deciding when auth is required and where flags are loaded from.

## License

Apache-2.0
