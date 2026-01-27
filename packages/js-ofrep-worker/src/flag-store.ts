import type { EvaluationContext, JsonValue, FlagMetadata } from '@openfeature/core';
import { StandardResolutionReasons, ErrorCode } from '@openfeature/core';
import { WorkersStorage } from './workers-storage';

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
 * Uses a Workers-compatible implementation that bypasses ajv schema 
 * validation (which uses dynamic code generation not allowed in 
 * Cloudflare Workers).
 */
export class FlagStore {
  private readonly storage: WorkersStorage;
  private flagSetMetadata: FlagMetadata = {};

  constructor(flags: string | object) {
    this.storage = new WorkersStorage();
    this.setFlags(flags);
  }

  /**
   * Set or update the flag configuration
   */
  setFlags(flags: string | object): void {
    const flagConfig = typeof flags === 'string' ? flags : JSON.stringify(flags);
    this.storage.setConfigurations(flagConfig);
    this.flagSetMetadata = this.storage.getFlagSetMetadata();
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
    return this.storage.getFlag(flagKey) !== undefined;
  }

  /**
   * Get all flag keys
   */
  getFlagKeys(): string[] {
    return Array.from(this.storage.getFlags().keys());
  }

  /**
   * Resolve a flag and validate the type
   */
  private resolveWithTypeCheck<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext,
    expectedType: string,
  ): TypedResolutionResult<T> {
    const flag = this.storage.getFlag(flagKey);

    if (!flag) {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `flag '${flagKey}' not found`,
        flagMetadata: this.flagSetMetadata,
      };
    }

    if (flag.state === 'DISABLED') {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `flag '${flagKey}' is disabled`,
        flagMetadata: flag.metadata,
      };
    }

    const result = flag.evaluate(context);

    // Handle errors
    if (result.value === undefined || result.errorCode) {
      return {
        value: defaultValue,
        variant: result.variant,
        reason: result.reason,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
        flagMetadata: result.flagMetadata,
      };
    }

    // Type check
    const actualType = typeof result.value;
    if (actualType !== expectedType && expectedType !== 'object') {
      return {
        value: defaultValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.TYPE_MISMATCH,
        errorMessage: `Evaluated type of flag ${flagKey} does not match. Expected ${expectedType}, got ${actualType}`,
        flagMetadata: flag.metadata,
      };
    }

    return {
      value: result.value as T,
      variant: result.variant,
      reason: result.reason,
      flagMetadata: result.flagMetadata,
    };
  }

  /**
   * Resolve a boolean flag value
   */
  resolveBooleanValue(
    flagKey: string,
    defaultValue: boolean,
    context: EvaluationContext = {},
  ) {
    return this.resolveWithTypeCheck(flagKey, defaultValue, context, 'boolean');
  }

  /**
   * Resolve a string flag value
   */
  resolveStringValue(
    flagKey: string,
    defaultValue: string,
    context: EvaluationContext = {},
  ) {
    return this.resolveWithTypeCheck(flagKey, defaultValue, context, 'string');
  }

  /**
   * Resolve a number flag value
   */
  resolveNumberValue(
    flagKey: string,
    defaultValue: number,
    context: EvaluationContext = {},
  ) {
    return this.resolveWithTypeCheck(flagKey, defaultValue, context, 'number');
  }

  /**
   * Resolve an object flag value
   */
  resolveObjectValue<T extends JsonValue>(
    flagKey: string,
    defaultValue: T,
    context: EvaluationContext = {},
  ) {
    return this.resolveWithTypeCheck(flagKey, defaultValue, context, 'object');
  }

  /**
   * Resolve a flag value with automatic type detection.
   */
  resolveValue(
    flagKey: string,
    context: EvaluationContext = {},
  ): FlagResolutionResult {
    const flag = this.storage.getFlag(flagKey);
    
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
    const results: EvaluationDetails[] = [];

    for (const [key, flag] of this.storage.getFlags()) {
      if (flag.state === 'DISABLED') {
        continue;
      }

      try {
        const result = flag.evaluate(context);
        
        if (result.value !== undefined && !result.errorCode) {
          results.push({
            flagKey: key,
            value: result.value,
            variant: result.variant,
            reason: result.reason,
            flagMetadata: result.flagMetadata,
          });
        }
      } catch {
        // Skip flags that error during evaluation
      }
    }

    return results;
  }
}
