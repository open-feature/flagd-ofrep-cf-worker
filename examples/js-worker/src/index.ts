import { OfrepHandler, extractAuthToken } from '@openfeature/flagd-ofrep-cf-worker';

// Static flag configuration (bundled at build time)
import staticFlags from './flags.json';

// ---------------------------------------------------------------------------
// Environment bindings
// ---------------------------------------------------------------------------
interface Env {
  // R2 bucket containing per-token flag configurations.
  // Bind in wrangler.toml:
  //   [[r2_buckets]]
  //   binding = "FLAGS_BUCKET"
  //   bucket_name = "ofrep-flags"
  FLAGS_BUCKET?: R2Bucket;

  // Set to "r2" to enable R2-backed per-token flag loading.
  // When unset or any other value, uses static bundled flags.
  FLAG_SOURCE?: string;
}

// ---------------------------------------------------------------------------
// R2 config loading with CF Cache API (reference implementation)
//
// This pattern mirrors how DevCycle serves per-SDK-key configs:
// - caches.default as the first read layer (edge cache, per-PoP)
// - R2 as the source of truth
// - s-maxage for TTL, Cache-Tag for per-key purge support
// - Async cache writes via ctx.waitUntil() to avoid blocking responses
// ---------------------------------------------------------------------------

const CACHE_TTL_SECONDS = 60;
const CACHE_HOST = 'https://ofrep-r2-cache';

/**
 * Resolve an auth token to an R2 object key.
 * Customize this function to control your R2 bucket layout.
 *
 * Examples:
 *   `flags/${token}/flags.json`                — token as path prefix (default)
 *   `flags/${await sha256(token)}/flags.json`  — hashed for security
 *   `configs/${tenantId}/flags.json`           — if you map tokens to tenant IDs
 */
function resolveR2Key(token: string): string {
  return `flags/${token}/flags.json`;
}

/**
 * Load flag configuration from R2 with CF Cache API layering.
 *
 * Flow:
 * 1. Check caches.default for a cached config (keyed by synthetic URL)
 * 2. On cache miss, read from R2 bucket
 * 3. Store in cache asynchronously via ctx.waitUntil()
 * 4. On R2 error, retry once bypassing cache
 *
 * Returns the parsed config object, or null if the R2 key doesn't exist.
 */
async function loadConfigFromR2(bucket: R2Bucket, token: string, ctx: ExecutionContext): Promise<object | null> {
  const r2Key = resolveR2Key(token);
  const cacheKey = new Request(`${CACHE_HOST}/${r2Key}`);
  const cache = caches.default;

  // Try cache first
  const cached = await cache.match(cacheKey);
  if (cached) {
    return cached.json();
  }

  // Cache miss — read from R2
  return fetchFromR2AndCache(bucket, r2Key, token, cacheKey, cache, ctx);
}

async function fetchFromR2AndCache(
  bucket: R2Bucket,
  r2Key: string,
  token: string,
  cacheKey: Request,
  cache: Cache,
  ctx: ExecutionContext,
  isRetry = false,
): Promise<object | null> {
  let r2Object: R2ObjectBody | null;
  try {
    r2Object = await bucket.get(r2Key);
  } catch (error) {
    if (!isRetry) {
      // Retry once on transient R2 error
      return fetchFromR2AndCache(bucket, r2Key, token, cacheKey, cache, ctx, true);
    }
    throw error;
  }

  if (r2Object === null) {
    return null;
  }

  const configString = await r2Object.text();

  // Build cacheable response with headers following DevCycle's pattern:
  // - ETag from R2 object (already quoted via httpEtag)
  // - Last-Modified from R2 upload timestamp
  // - s-maxage for shared/CDN cache TTL
  // - Cache-Tag for per-key purge via CF API
  const headers = new Headers();
  r2Object.writeHttpMetadata(headers);
  headers.set('ETag', r2Object.httpEtag);
  headers.set('Last-Modified', r2Object.uploaded.toUTCString());
  headers.set('Cache-Control', `s-maxage=${CACHE_TTL_SECONDS}`);
  headers.set('Cache-Tag', token);
  headers.set('Content-Type', 'application/json');

  const response = new Response(configString, { headers });

  // Store in cache asynchronously — don't block the response
  ctx.waitUntil(cache.put(cacheKey, response.clone()));

  return JSON.parse(configString);
}

// ---------------------------------------------------------------------------
// Worker entry point
// ---------------------------------------------------------------------------

// Static handler — created once at module scope, reused across requests
const staticHandler = new OfrepHandler({ flagsStatic: staticFlags });

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === '/health' || url.pathname === '/') {
      return Response.json({
        status: 'ok',
        service: 'flagd-ofrep-js-worker',
        flagSource: env.FLAG_SOURCE === 'r2' ? 'r2' : 'static',
        endpoints: {
          evaluate: '/ofrep/v1/evaluate/flags/{key}',
          bulk: '/ofrep/v1/evaluate/flags',
        },
      });
    }

    // OFREP routes
    if (url.pathname.startsWith('/ofrep/')) {
      // Static mode — bundled flags, no auth required
      if (env.FLAG_SOURCE !== 'r2') {
        return staticHandler.handleRequest(request);
      }

      // R2 mode — per-token flag configs
      if (!env.FLAGS_BUCKET) {
        return Response.json({ errorDetails: 'R2 bucket not configured' }, { status: 500 });
      }

      // Extract auth token per OFREP spec (Bearer or X-API-Key)
      const token = extractAuthToken(request);
      if (!token) {
        return Response.json({ errorDetails: 'Authentication required' }, { status: 401 });
      }

      // Load config from R2 (with CF Cache API layering)
      let config: object | null;
      try {
        config = await loadConfigFromR2(env.FLAGS_BUCKET, token, ctx);
      } catch {
        return Response.json({ errorDetails: 'Internal server error' }, { status: 500 });
      }

      if (!config) {
        return Response.json({ errorDetails: 'Configuration not found' }, { status: 404 });
      }

      // Create per-request handler with the loaded config
      const handler = new OfrepHandler({ flagsStatic: config });
      return handler.handleRequest(request);
    }

    // Not found
    return Response.json({ error: 'Not found' }, { status: 404 });
  },
};
