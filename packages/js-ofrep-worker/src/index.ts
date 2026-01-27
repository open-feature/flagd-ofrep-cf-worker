// Core exports
export { FlagStore } from './flag-store';
export { OfrepHandler, createOfrepHandler } from './ofrep-handler';
export { WorkersStorage, WorkersFeatureFlag } from './workers-storage';

// Type exports
export type {
  FlagResolutionResult,
  TypedResolutionResult,
  EvaluationDetails,
} from './flag-store';

export type {
  Flag,
} from './workers-storage';

export type {
  OfrepContext,
  OfrepEvaluationRequest,
  OfrepBulkEvaluationRequest,
  OfrepEvaluationSuccess,
  OfrepEvaluationFailure,
  OfrepFlagNotFound,
  OfrepBulkEvaluationSuccess,
  OfrepBulkEvaluationFailure,
  OfrepGeneralError,
  OfrepReason,
  OfrepErrorCode,
  OfrepHandlerOptions,
} from './types';

// Re-export useful types from dependencies
export type { EvaluationContext, JsonValue, FlagMetadata } from '@openfeature/core';
