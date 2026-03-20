import type { EvaluationContext, JsonValue } from '@openfeature/core';

/**
 * OFREP evaluation context as received in the request body
 */
export interface OfrepContext {
  targetingKey?: string;
  [key: string]: JsonValue | undefined;
}

/**
 * OFREP single flag evaluation request
 */
export interface OfrepEvaluationRequest {
  context?: OfrepContext;
}

/**
 * OFREP bulk evaluation request
 */
export interface OfrepBulkEvaluationRequest {
  context?: OfrepContext;
}

/**
 * OFREP evaluation success response
 */
export interface OfrepEvaluationSuccess {
  key: string;
  // OFREP may omit value to indicate the provider should use the code default.
  value?: JsonValue;
  reason: OfrepReason;
  variant?: string;
  metadata?: Record<string, JsonValue>;
}

/**
 * OFREP evaluation failure response
 */
export interface OfrepEvaluationFailure {
  key: string;
  errorCode: OfrepErrorCode;
  errorDetails?: string;
  metadata?: Record<string, JsonValue>;
}

/**
 * OFREP flag not found response
 */
export interface OfrepFlagNotFound {
  key: string;
  errorCode: 'FLAG_NOT_FOUND';
  errorDetails?: string;
  metadata?: Record<string, JsonValue>;
}

/**
 * OFREP bulk evaluation success response
 */
export interface OfrepBulkEvaluationSuccess {
  flags: Array<OfrepEvaluationSuccess | OfrepEvaluationFailure>;
  metadata?: Record<string, JsonValue>;
}

/**
 * OFREP bulk evaluation failure response
 */
export interface OfrepBulkEvaluationFailure {
  errorCode: OfrepErrorCode;
  errorDetails?: string;
}

/**
 * OFREP general error response
 */
export interface OfrepGeneralError {
  errorDetails?: string;
}

/**
 * OFREP reason codes (aligned with OpenFeature resolution reasons)
 */
export type OfrepReason = 'STATIC' | 'TARGETING_MATCH' | 'SPLIT' | 'DISABLED' | 'UNKNOWN' | 'DEFAULT' | 'ERROR';

/**
 * OFREP error codes (aligned with OpenFeature error codes)
 */
export type OfrepErrorCode =
  | 'FLAG_NOT_FOUND'
  | 'PARSE_ERROR'
  | 'TARGETING_KEY_MISSING'
  | 'INVALID_CONTEXT'
  | 'GENERAL'
  | 'TYPE_MISMATCH';

/**
 * Configuration options for the OFREP handler
 */
export interface OfrepHandlerOptions {
  /**
   * Static flag configuration JSON string or object.
   * Bundled at build time using the flagd flag definition format.
   * When using static flags, the handler creates a single shared FlagStore.
   */
  staticFlags: string | object;

  /**
   * Base path for OFREP endpoints.
   * @default '/ofrep/v1'
   */
  basePath?: string;

  /**
   * Enable CORS headers in responses.
   * @default true
   */
  cors?: boolean;

  /**
   * Custom CORS origin. Set to '*' for any origin.
   * @default '*'
   */
  corsOrigin?: string;
}

/**
 * Convert OFREP context to OpenFeature EvaluationContext
 */
export function toEvaluationContext(ofrepContext?: OfrepContext): EvaluationContext {
  if (!ofrepContext) {
    return {};
  }

  const { targetingKey, ...rest } = ofrepContext;
  return {
    targetingKey,
    ...rest,
  } as EvaluationContext;
}
