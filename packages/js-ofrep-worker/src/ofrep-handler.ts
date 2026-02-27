import { ErrorCode, StandardResolutionReasons } from '@openfeature/core';
import type { JsonValue } from '@openfeature/core';
import { FlagStore } from './flag-store';
import {
  toEvaluationContext,
  type OfrepHandlerOptions,
  type OfrepEvaluationRequest,
  type OfrepBulkEvaluationRequest,
  type OfrepEvaluationSuccess,
  type OfrepEvaluationFailure,
  type OfrepBulkEvaluationSuccess,
  type OfrepReason,
  type OfrepErrorCode,
} from './types';

/**
 * Map OpenFeature resolution reason to OFREP reason
 */
function toOfrepReason(reason: string | undefined): OfrepReason {
  switch (reason) {
    case StandardResolutionReasons.STATIC:
      return 'STATIC';
    case StandardResolutionReasons.TARGETING_MATCH:
      return 'TARGETING_MATCH';
    case StandardResolutionReasons.SPLIT:
      return 'SPLIT';
    case StandardResolutionReasons.DISABLED:
      return 'DISABLED';
    case StandardResolutionReasons.DEFAULT:
      return 'DEFAULT';
    case StandardResolutionReasons.ERROR:
      return 'ERROR';
    default:
      return 'UNKNOWN';
  }
}

/**
 * Map OpenFeature error code to OFREP error code
 */
function toOfrepErrorCode(errorCode: string | undefined): OfrepErrorCode {
  switch (errorCode) {
    case ErrorCode.FLAG_NOT_FOUND:
      return 'FLAG_NOT_FOUND';
    case ErrorCode.PARSE_ERROR:
      return 'PARSE_ERROR';
    case ErrorCode.TARGETING_KEY_MISSING:
      return 'TARGETING_KEY_MISSING';
    case ErrorCode.INVALID_CONTEXT:
      return 'INVALID_CONTEXT';
    case ErrorCode.TYPE_MISMATCH:
      return 'TYPE_MISMATCH';
    default:
      return 'GENERAL';
  }
}

/**
 * Create CORS headers for responses
 */
function corsHeaders(origin: string): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, If-None-Match',
    'Access-Control-Expose-Headers': 'ETag',
  };
}

/**
 * Create a JSON response with optional CORS headers
 */
function jsonResponse(data: unknown, status: number, options: { cors?: boolean; corsOrigin?: string } = {}): Response {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
  };

  if (options.cors !== false) {
    Object.assign(headers, corsHeaders(options.corsOrigin || '*'));
  }

  return new Response(JSON.stringify(data), { status, headers });
}

/**
 * OFREP request handler for Fetch-compatible edge runtimes.
 * Handles OFREP API endpoints for flag evaluation.
 */
export class OfrepHandler {
  private readonly store: FlagStore;
  private readonly basePath: string;
  private readonly cors: boolean;
  private readonly corsOrigin: string;

  constructor(options: OfrepHandlerOptions) {
    this.store = new FlagStore(options.flags);
    this.basePath = options.basePath || '/ofrep/v1';
    this.cors = options.cors !== false;
    this.corsOrigin = options.corsOrigin || '*';
  }

  /**
   * Update the flag configuration
   */
  setFlags(flags: string | object): void {
    this.store.setFlags(flags);
  }

  /**
   * Handle an incoming request
   */
  async handleRequest(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return this.handleOptions();
    }

    // Route to appropriate handler
    const evaluateFlagsPath = `${this.basePath}/evaluate/flags`;

    if (path === evaluateFlagsPath && request.method === 'POST') {
      return this.handleBulkEvaluation(request);
    }

    if (path.startsWith(`${evaluateFlagsPath}/`) && request.method === 'POST') {
      const flagKey = path.slice(evaluateFlagsPath.length + 1);
      if (flagKey) {
        return this.handleSingleEvaluation(request, flagKey);
      }
    }

    // Not found
    return jsonResponse({ errorDetails: 'Not found' }, 404, { cors: this.cors, corsOrigin: this.corsOrigin });
  }

  /**
   * Handle CORS preflight request
   */
  private handleOptions(): Response {
    return new Response(null, {
      status: 204,
      headers: corsHeaders(this.corsOrigin),
    });
  }

  /**
   * Handle single flag evaluation: POST /ofrep/v1/evaluate/flags/{key}
   */
  private async handleSingleEvaluation(request: Request, flagKey: string): Promise<Response> {
    let body: OfrepEvaluationRequest = {};

    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return jsonResponse(
        {
          key: flagKey,
          errorCode: 'PARSE_ERROR',
          errorDetails: 'Invalid JSON in request body',
        },
        400,
        { cors: this.cors, corsOrigin: this.corsOrigin },
      );
    }

    const context = toEvaluationContext(body.context);
    const result = this.store.resolveValue(flagKey, context);

    // Handle flag not found
    if (result.errorCode === 'FLAG_NOT_FOUND') {
      return jsonResponse(
        {
          key: flagKey,
          errorCode: 'FLAG_NOT_FOUND',
          errorDetails: result.errorMessage,
          metadata: result.flagMetadata,
        },
        404,
        { cors: this.cors, corsOrigin: this.corsOrigin },
      );
    }

    // Handle evaluation errors
    if (result.reason === 'ERROR' || result.reason === StandardResolutionReasons.ERROR) {
      return jsonResponse(
        {
          key: flagKey,
          errorCode: toOfrepErrorCode(result.errorCode),
          errorDetails: result.errorMessage,
          metadata: result.flagMetadata,
        },
        400,
        { cors: this.cors, corsOrigin: this.corsOrigin },
      );
    }

    // Success response
    const response: OfrepEvaluationSuccess = {
      key: flagKey,
      value: result.value as JsonValue,
      reason: toOfrepReason(result.reason),
      variant: result.variant,
      metadata: result.flagMetadata as Record<string, JsonValue> | undefined,
    };

    return jsonResponse(response, 200, { cors: this.cors, corsOrigin: this.corsOrigin });
  }

  /**
   * Handle bulk flag evaluation: POST /ofrep/v1/evaluate/flags
   */
  private async handleBulkEvaluation(request: Request): Promise<Response> {
    let body: OfrepBulkEvaluationRequest = {};

    try {
      const text = await request.text();
      if (text) {
        body = JSON.parse(text);
      }
    } catch {
      return jsonResponse(
        {
          errorCode: 'PARSE_ERROR',
          errorDetails: 'Invalid JSON in request body',
        },
        400,
        { cors: this.cors, corsOrigin: this.corsOrigin },
      );
    }

    const context = toEvaluationContext(body.context);
    const evaluations = this.store.resolveAll(context);

    const flags: Array<OfrepEvaluationSuccess | OfrepEvaluationFailure> = evaluations.map((evaluation) => {
      if (evaluation.errorCode) {
        return {
          key: evaluation.flagKey,
          errorCode: toOfrepErrorCode(evaluation.errorCode),
          errorDetails: evaluation.errorMessage,
          metadata: evaluation.flagMetadata as Record<string, JsonValue> | undefined,
        } as OfrepEvaluationFailure;
      }

      return {
        key: evaluation.flagKey,
        value: evaluation.value as JsonValue,
        reason: toOfrepReason(evaluation.reason),
        variant: evaluation.variant,
        metadata: evaluation.flagMetadata as Record<string, JsonValue> | undefined,
      } as OfrepEvaluationSuccess;
    });

    const response: OfrepBulkEvaluationSuccess = {
      flags,
      metadata: this.store.getMetadata() as Record<string, JsonValue>,
    };

    // TODO: Implement ETag for caching
    return jsonResponse(response, 200, { cors: this.cors, corsOrigin: this.corsOrigin });
  }
}

/**
 * Create an OFREP fetch handler for Fetch-compatible edge runtimes.
 *
 * @example
 * ```typescript
 * import { createOfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
 * import flags from './flags.json';
 *
 * const handler = createOfrepHandler({ flags });
 *
 * export default {
 *   fetch: handler,
 * };
 *
 * // For runtimes that accept a direct handler export:
 * // export default handler;
 * ```
 */
export function createOfrepHandler(options: OfrepHandlerOptions): (request: Request) => Promise<Response> {
  const handler = new OfrepHandler(options);
  return (request: Request) => handler.handleRequest(request);
}
