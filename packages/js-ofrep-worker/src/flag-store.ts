import type { EvaluationContext, JsonValue, FlagMetadata, Logger } from '@openfeature/core';
import { StandardResolutionReasons, ErrorCode } from '@openfeature/core';
import { FlagdCore } from '@openfeature/flagd-core';

/**
 * Default console logger
 */
const defaultLogger: Logger = {
  error: (...args) => console.error('[FlagdCore]', ...args),
  warn: (...args) => console.warn('[FlagdCore]', ...args),
  info: (...args) => console.info('[FlagdCore]', ...args),
  debug: (...args) => console.debug('[FlagdCore]', ...args),
};

/**
 * Result of a flag resolution with all relevant metadata
 */
export interface FlagResolutionResult {
  value: JsonValue | undefined;
  variant?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  flagMetadata?: FlagMetadata;
}

/**
 * Typed resolution result for specific value types
 */
export interface TypedResolutionResult<T> {
  value: T;
  variant?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  flagMetadata?: FlagMetadata;
}

/**
 * Evaluation details for a single flag
 */
export interface EvaluationDetails {
  flagKey: string;
  value: JsonValue;
  variant?: string;
  reason?: string;
  errorCode?: string;
  errorMessage?: string;
  flagMetadata?: FlagMetadata;
}

/**
 * Flag store providing flag evaluation for Cloudflare Workers.
 * 
 * Uses the forked @openfeature/flagd-core with Workers compatibility mode,
 * which uses interpreter-based JSONLogic evaluation instead of compilation
 * to avoid the `new Function()` restriction in Cloudflare Workers.
 */
export class FlagStore {
  private readonly core: FlagdCore;
  private flagSetMetadata: FlagMetadata = {};

  constructor(flags: string | object, logger: Logger = defaultLogger) {
    // Initialize FlagdCore with workers: true for interpreter mode
    this.core = new FlagdCore(undefined, logger, { workers: true });
    this.setFlags(flags);
  }

  /**
   * Set or update the flag configuration
   */
  setFlags(flags: string | object): void {
    const flagConfig = typeof flags === 'string' ? flags : JSON.stringify(flags);
    this.core.setConfigurations(flagConfig);
    this.flagSetMetadata = this.core.getFlagSetMetadata();
  }

  /**
   * Get the flag set metadata
   */
  getMetadata(): FlagMetadata {
    return this.flagSetMetadata;
  }

  /**
   * Check if a flag exists
   */
  hasFlag(flagKey: string): boolean {
    return this.core.getFlag(flagKey) !== undefined;
  }

  /**
   * Get all flag keys
   */
  getFlagKeys(): string[] {
    return Array.from(this.core.getFlags().keys());
  }

  /**
   * Resolve a boolean flag value
   */
  resolveBooleanValue(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext = {},
  ): TypedResolutionResult<boolean> {
    const result = this.core.resolveBooleanEvaluation(flagKey, defaultValue, context);
    return {
      value: result.value,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve a string flag value
   */
  resolveStringValue(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext = {},
  ): TypedResolutionResult<string> {
    const result = this.core.resolveStringEvaluation(flagKey, defaultValue, context);
    return {
      value: result.value,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve a number flag value
   */
  resolveNumberValue(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext = {},
  ): TypedResolutionResult<number> {
    const result = this.core.resolveNumberEvaluation(flagKey, defaultValue, context);
    return {
      value: result.value,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve an object flag value
   */
  resolveObjectValue<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext = {},
  ): TypedResolutionResult<T> {
    const result = this.core.resolveObjectEvaluation(flagKey, defaultValue, context);
    return {
      value: result.value as T,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve a flag value with automatic type detection.
   */
  resolveValue(
    flagKey: string,
    context: EvaluationContext = {},
  ): FlagResolutionResult {
    const flag = this.core.getFlag(flagKey);
    
    if (!flag) {
      return {
        value: undefined,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `flag '${flagKey}' not found`,
        flagMetadata: this.flagSetMetadata,
      };
    }

    if (flag.state === 'DISABLED') {
      return {
        value: undefined,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `flag '${flagKey}' is disabled`,
        flagMetadata: flag.metadata,
      };
    }

    const result = flag.evaluate(context);

    return {
      value: result.value,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve all enabled flags
   */
  resolveAll(context: EvaluationContext = {}): EvaluationDetails[] {
    const results = this.core.resolveAll(context);
    return results.map((result) => ({
      flagKey: result.flagKey,
      value: result.value,
      variant: result.variant,
      reason: result.reason,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
      flagMetadata: result.flagMetadata,
    }));
  }
}
