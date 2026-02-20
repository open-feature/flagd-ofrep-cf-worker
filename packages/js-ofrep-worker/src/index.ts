// Core exports
export { FlagStore } from './flag-store';
export { OfrepHandler, createOfrepHandler } from './ofrep-handler';

// Re-export from flagd-core for advanced usage
export { FlagdCore, FeatureFlag, MemoryStorage } from '@openfeature/flagd-core';
export type { Storage } from '@openfeature/flagd-core';
export type FlagdCoreOptions = {
  workers?: boolean;
};

// Type exports
export type {
  FlagResolutionResult,
  TypedResolutionResult,
  EvaluationDetails,
} from './flag-store';

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
