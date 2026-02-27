# Plan 09: R2 Flag Source with Per-Token Config & CF Cache API

## Goal

Enable the OFREP worker to load flagd JSON configs from R2, keyed per auth
token, with Cloudflare Cache API for caching and ETag-based revalidation.
The worker operates in one of two modes: **static** (bundled JSON) or
**R2-backed** (per-token configs loaded at request time).

The R2 config loading logic lives in the **example worker** (not the library)
so the library stays storage-agnostic. Implementers copy and adapt the
reference pattern for their own infrastructure (R2, KV, D1, HTTP, etc.).

## Design Decisions

### Why not bake R2 into the library?

The `R2FlagSource` class considered in early drafts was ~60 lines of
straightforward CF Worker code (`bucket.get()` → `caches.default` → `JSON.parse()`).
The `resolveKey` escape hatch was already an admission that we can't predict
implementers' R2 layouts. DevCycle's equivalent code (`configStorage.ts`,
`configFetch.ts`) is internal application code in their monorepo — not a
published library. The library's real value is OFREP protocol compliance and
flagd-core evaluation, not storage opinions.

### Architecture (modeled after DevCycle's production pattern)

```
Client Request
  │  Authorization: Bearer <token>  (or X-API-Key: <token>)
  │  POST /ofrep/v1/evaluate/flags/{key}
  ▼
┌──────────────────────────────────────────────────────────────┐
│  OFREP CF Worker (example)                                   │
│                                                              │
│  1. Extract auth token (Bearer or X-API-Key per OFREP spec)  │
│  2. resolveR2Key(token) → R2 object key (customizable fn)    │
│  3. Check caches.default for cached config                   │
│     ├── HIT → use cached config                              │
│     └── MISS →                                               │
│         R2 bucket.get(key)                                   │
│         ├── exists → cache async via ctx.waitUntil(), use it │
│         ├── null → 404 (config not provisioned)              │
│         └── error → retry once, then 500                     │
│  4. OfrepHandler({ staticFlags: config })                    │
│  5. Evaluate flags, return OFREP response                    │
└──────────────────────────────────────────────────────────────┘

R2 Bucket layout:
  flags/{token}/flags.json    (default, customizable via resolveR2Key)
```

### Caching strategy (aligned with DevCycle's configStorage.ts)

| Aspect | DevCycle | Our Implementation |
|--------|----------|--------------------|
| Cache API | `caches.default` | `caches.default` (enables Cache-Tag purge) |
| Cache key | `new Request('https://r2-config-cdn.devcycle.com/<key>')` | `new Request('https://ofrep-r2-cache/<key>')` |
| Cache-Control | `s-maxage=86400` | `s-maxage={CACHE_TTL_SECONDS}` (default 60) |
| Cache-Tag | SDK key | Auth token (for per-key CF API purge) |
| Cache write | `waitUntilAfterRequest(cache.put())` | `ctx.waitUntil(cache.put())` |
| ETag | `r2Object.httpEtag` | `r2Object.httpEtag` |
| Last-Modified | `r2Object.uploaded.toUTCString()` | `r2Object.uploaded.toUTCString()` |
| R2 metadata | `r2Object.writeHttpMetadata(headers)` | Same |
| Retry on error | 2 retries, bypass cache on retry | 1 retry, bypass cache on retry |

### OFREP spec auth

Per the OFREP OpenAPI spec (v0.2.0), two auth schemes:
- **BearerAuth**: `Authorization: Bearer <token>` (strip prefix)
- **ApiKeyAuth**: `X-API-Key: <token>`

DevCycle's OFREP routes use `{ authHeader: true, apiKeyHeader: true }`.
Our `extractAuthToken()` matches this: check Authorization first, then X-API-Key.

### Error handling

| Scenario | HTTP | Response |
|----------|------|----------|
| No auth token (R2 mode) | 401 | `{ "errorDetails": "Authentication required" }` |
| Token → missing R2 key | 404 | `{ "errorDetails": "Configuration not found" }` |
| R2 transient error (after retry) | 500 | `{ "errorDetails": "Internal server error" }` |
| R2 bucket not configured | 500 | `{ "errorDetails": "R2 bucket not configured" }` |

Note: DevCycle returns 404 (not 401) for missing configs — the token may be
valid but the config hasn't been provisioned yet.

## Changes Made

### Library (`packages/js-ofrep-worker/`)

#### `src/types.ts` — Rename `flags` → `staticFlags`

```typescript
export interface OfrepHandlerOptions {
  staticFlags: string | object;  // renamed from flags
  basePath?: string;
  cors?: boolean;
  corsOrigin?: string;
}
```

#### `src/auth.ts` — New file

```typescript
/**
 * Extract auth token per OFREP spec.
 * Authorization: Bearer first, then X-API-Key.
 */
export function extractAuthToken(request: Request): string | null;
```

#### `src/ofrep-handler.ts` — Updated

- Constructor uses `options.staticFlags`
- JSDoc example updated

#### `src/flag-store.ts` — Updated

- `{ workers: true }` → `{ disableDynamicCodeGeneration: true }` to match
  upstream PR #1482's renamed option

#### `src/index.ts` — Export `extractAuthToken`

### Example Worker (`examples/js-worker/`)

#### `src/index.ts` — Rewritten

Two modes controlled by `FLAG_SOURCE` env var:

- **Static** (default): bundled `flags.json`, module-scope `OfrepHandler`
- **R2** (`FLAG_SOURCE=r2`): per-token configs from R2

R2 reference implementation includes:
- `resolveR2Key(token)` — customizable token-to-R2-path mapping
- `loadConfigFromR2(bucket, token, ctx)` — CF Cache API + R2 with retry
- `fetchFromR2AndCache()` — builds cacheable Response with proper headers
- Per-request `OfrepHandler` creation with loaded config

#### `wrangler.toml` — R2 binding config (commented out)

```toml
# [[r2_buckets]]
# binding = "FLAGS_BUCKET"
# bucket_name = "ofrep-flags"
#
# [vars]
# FLAG_SOURCE = "r2"
```

### Submodule

#### `.gitmodules` — Updated

- URL: `DevCycleHQ-Sandbox/js-sdk-contrib` → `open-feature/js-sdk-contrib`
- Branch: `feat/workers-compat-targeting` (PR #1482)

#### `contrib/js-sdk-contrib` — Updated pointer

- `09d3d49` (old fork) → `84bb283` (upstream PR #1482 tip)

### Build infrastructure

#### `scripts/patch-flagd-core.js` — New

Postinstall script that adds `main`/`types` fields to the submodule's
`package.json`. Upstream uses nx and doesn't include these fields; our
workspace needs them for tsup bundling and declaration generation.

#### `package.json` — Added `postinstall` hook

## Usage

### Static mode (default)

```typescript
import { OfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const handler = new OfrepHandler({ staticFlags: flags });
```

### R2 mode

1. Create R2 bucket: `wrangler r2 bucket create ofrep-flags`
2. Upload config: `wrangler r2 object put ofrep-flags/flags/<token>/flags.json --file=flags.json`
3. Uncomment R2 binding in `wrangler.toml`
4. Set `FLAG_SOURCE = "r2"` in `[vars]`
5. Requests must include `Authorization: Bearer <token>` or `X-API-Key: <token>`

### Custom R2 key resolution

```typescript
// Hash the token for security
function resolveR2Key(token: string): string {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token));
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `flags/${hex}/flags.json`;
}
```

## Future Considerations

1. **FlagStore caching**: Creating `OfrepHandler` per request means flagd-core
   re-parses config JSON each time. If perf is a concern, add an ETag-keyed
   in-memory LRU cache for `FlagStore` instances.

2. **Cache invalidation**: Worst-case staleness = `CACHE_TTL_SECONDS`. For
   immediate purge, use CF API with Cache-Tag. A future admin endpoint could
   call `cache.delete()` for the synthetic URL.

3. **SSE-based staleness**: DevCycle uses SSE timestamps from clients to detect
   stale caches and force R2 re-reads. Could add similar mechanism via optional
   header/query param.

4. **Remove submodule**: Replace `contrib/js-sdk-contrib` with published
   `@openfeature/flagd-core` npm package once upstream PR #1482 lands and is
   released.
