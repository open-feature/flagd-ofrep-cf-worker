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
  eventStreams?: EventStream[];
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
   * Disabled by default so deployments must opt in before allowing browser-originated requests.
   * @default false
   */
  cors?: boolean;

  /**
   * Custom CORS origin. Set to '*' for any origin.
   * @default '*'
   */
  corsOrigin?: string;

  /**
   * Event streams advertised to clients for real-time flag change notifications.
   * Merged into the bulk evaluation endpoint response if provided.
   * NOTE: The URLs/requestURI's may contain auth tokens or channel credentials -- and any implementations must not log or persist the full value including query string.
   * @see https://github.com/open-feature/protocol/blob/main/service/adrs/0008-sse-for-bulk-evaluation-changes.md
   * Example:
   * "eventStreams": [
   *     {
   *       "type": "sse",
   *       "url": "https://sse.example.com/event-stream?channels=env_abc123_v1",
   *       "inactivityDelaySec": 120
   *     },
   *     {
   *       "type": "sse",
   *       "endpoint": {
   *         "origin": "https://sse.example.com",
   *         "requestUri": "/event-stream?channels=env_abc123_v1"
   *       }
   *     }
   *   ]
   */
  eventStreams?: EventStream[];
}

/**
 * Fields common to every event stream advertised in the bulk evaluation response.
 */
interface EventStreamBase {
  /**
   * Type of the event stream. Currently only `'sse'` is defined by the ADR;
   * clients must ignore unknown types.
   */
  type: string;

  /**
   * Seconds of inactivity before clients should close the connection.
   * Minimum 1; clients default to 120 when omitted.
   */
  inactivityDelaySec?: number;
}

/**
 * An event stream addressed by a single opaque `url`.
 * The `endpoint?: never` makes `url` and `endpoint` mutually exclusive at compile time.
 */
export interface EventStreamWithUrl extends EventStreamBase {
  /**
   * Opaque connection URL for the stream. May contain auth tokens or vendor parameters.
   */
  url: string;
  endpoint?: never;
}

/**
 * An event stream addressed by a structured `endpoint`.
 * The `url?: never` makes `url` and `endpoint` mutually exclusive at compile time.
 */
export interface EventStreamWithEndpoint extends EventStreamBase {
  /**
   * Structured connection endpoint.
   */
  endpoint: EventStreamEndpoint;
  url?: never;
}

/**
 * An event stream endpoint advertised in the bulk evaluation response, per OFREP ADR-0008.
 *
 * Exactly one of `url` or `endpoint` must be provided; the union enforces this at compile time.
 */
export type EventStream = EventStreamWithUrl | EventStreamWithEndpoint;

/**
 * Structured event stream endpoint, used as an alternative to a single opaque `url`.
 */
export interface EventStreamEndpoint {
  /**
   * Connection origin to connect to. If omitted, clients should default to the OFREP endpoint.
   */
  origin?: string;
  /**
   * Request URI to append to the connection origin. Note. This may contain credentials or secure query parameters, so clients must not log it.
   */
  requestUri: string;
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
