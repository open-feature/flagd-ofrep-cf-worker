/**
 * Workers-compatible storage and evaluation implementation.
 *
 * The standard flagd-core uses ajv for JSON schema validation, which uses
 * dynamic code generation (new Function()) that is not allowed in Cloudflare Workers.
 *
 * This implementation provides flag parsing and evaluation without schema validation,
 * assuming flags are validated at build time.
 *
 * IMPORTANT: This module deliberately avoids importing from @openfeature/flagd-core
 * main entry point to prevent ajv from being bundled.
 */

import type {
  FlagMetadata,
  Logger,
  FlagValue,
  JsonValue,
  EvaluationContext,
  ResolutionDetails,
} from '@openfeature/core';
import { StandardResolutionReasons, ErrorCode } from '@openfeature/core';
// Use json-logic-js which is interpreter-based (no code generation)
import jsonLogic from 'json-logic-js';
// Import hashing for fractional evaluation
import IMurmurHash from 'imurmurhash';

/**
 * Flag configuration structure matching the flagd schema
 */
export interface Flag {
  state: 'ENABLED' | 'DISABLED';
  defaultVariant: string;
  variants: { [key: string]: FlagValue };
  targeting?: unknown;
  metadata?: FlagMetadata;
}

interface FlagConfig {
  flags: { [key: string]: Flag };
  metadata?: FlagMetadata;
  $evaluators?: { [key: string]: unknown };
}

/**
 * Default logger that outputs to console
 */
const defaultLogger: Logger = {
  error: (...args) => console.error(...args),
  warn: (...args) => console.warn(...args),
  info: (...args) => console.info(...args),
  debug: (...args) => console.debug(...args),
};

const evaluatorKey = '$evaluators';
const bracketReplacer = new RegExp('^[^{]*\\{|}[^}]*$', 'g');
const flagdPropertyKey = '$flagd';

/**
 * Transform $ref references in flagd configuration
 */
function transform(flagCfg: string): string {
  let parsed: FlagConfig;
  try {
    parsed = JSON.parse(flagCfg);
  } catch {
    return flagCfg;
  }

  const evaluators = parsed[evaluatorKey];
  if (!evaluators) {
    return flagCfg;
  }

  let transformed = flagCfg;

  for (const key in evaluators) {
    const replacer = JSON.stringify(evaluators[key]).replaceAll(bracketReplacer, '');
    const refRegex = new RegExp('"\\$ref":(\\s)*"' + key + '"', 'g');
    transformed = transformed.replaceAll(refRegex, replacer);
  }

  return transformed;
}

// Register custom operators with json-logic-js
// This only needs to happen once at module load time

/**
 * Fractional evaluation using MurmurHash
 */
jsonLogic.add_operation('fractional', (...args: unknown[]) => {
  if (args.length < 2) {
    return null;
  }

  const hashKey = String(args[0]);
  const buckets = args.slice(1) as Array<[string, number]>;

  // Calculate hash
  const hash = IMurmurHash(hashKey).result();
  const bucket = Math.abs(hash % 100);

  // Find the bucket
  let cumulative = 0;
  for (const [variant, percentage] of buckets) {
    cumulative += percentage;
    if (bucket < cumulative) {
      return variant;
    }
  }

  // Return last variant if nothing matched
  return buckets[buckets.length - 1]?.[0] ?? null;
});

/**
 * String starts_with operator
 */
jsonLogic.add_operation('starts_with', (str: unknown, prefix: unknown) => {
  return typeof str === 'string' && typeof prefix === 'string' && str.startsWith(prefix);
});

/**
 * String ends_with operator
 */
jsonLogic.add_operation('ends_with', (str: unknown, suffix: unknown) => {
  return typeof str === 'string' && typeof suffix === 'string' && str.endsWith(suffix);
});

/**
 * Semantic version comparison operator
 */
jsonLogic.add_operation('sem_ver', (v1: unknown, op: unknown, v2: unknown) => {
  if (typeof v1 !== 'string' || typeof op !== 'string' || typeof v2 !== 'string') {
    return false;
  }
  // Basic string comparison (proper semver would need the semver package)
  switch (op) {
    case '=':
    case '==':
      return v1 === v2;
    case '!=':
      return v1 !== v2;
    case '>':
      return v1 > v2;
    case '>=':
      return v1 >= v2;
    case '<':
      return v1 < v2;
    case '<=':
      return v1 <= v2;
    default:
      return false;
  }
});

/**
 * Targeting engine using json-logic-js (interpreter-based, no code generation)
 */
class Targeting {
  private readonly logic: unknown;
  private readonly logger: Logger;

  constructor(logic: unknown, logger: Logger) {
    this.logic = logic;
    this.logger = logger;
  }

  evaluate<T extends JsonValue>(flagKey: string, ctx: EvaluationContext): T {
    const context = {
      ...ctx,
      [flagdPropertyKey]: {
        flagKey,
        timestamp: Math.floor(Date.now() / 1000),
      },
    };

    const result = jsonLogic.apply(this.logic, context) as T;
    this.logger.debug(`Targeting evaluation for '${flagKey}': ${JSON.stringify(result)}`);
    return result;
  }
}

/**
 * Internal feature flag representation
 */
export class WorkersFeatureFlag {
  readonly key: string;
  readonly state: 'ENABLED' | 'DISABLED';
  readonly defaultVariant: string;
  readonly variants: Map<string, FlagValue>;
  readonly metadata: FlagMetadata;
  private readonly targeting?: Targeting;
  private readonly targetingParseError?: string;

  constructor(
    key: string,
    flag: Flag,
    private logger: Logger,
  ) {
    this.key = key;
    this.state = flag.state;
    this.defaultVariant = flag.defaultVariant;
    this.variants = new Map(Object.entries(flag.variants));
    this.metadata = flag.metadata ?? {};

    if (flag.targeting && Object.keys(flag.targeting as object).length > 0) {
      try {
        this.targeting = new Targeting(flag.targeting, logger);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        this.targetingParseError = `Invalid targeting configuration for flag '${key}': ${errorMessage}`;
        logger.warn(this.targetingParseError);
      }
    }
  }

  evaluate(evalCtx: EvaluationContext): ResolutionDetails<JsonValue> {
    if (this.targetingParseError) {
      return {
        value: undefined as unknown as JsonValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.PARSE_ERROR,
        errorMessage: this.targetingParseError,
        flagMetadata: this.metadata,
      };
    }

    let variant: string | undefined;
    let reason: string;

    if (!this.targeting) {
      variant = this.defaultVariant;
      reason = StandardResolutionReasons.STATIC;
    } else {
      try {
        const targetingResult = this.targeting.evaluate(this.key, evalCtx);

        if (targetingResult === null || targetingResult === undefined) {
          variant = this.defaultVariant;
          reason = StandardResolutionReasons.DEFAULT;
        } else {
          variant = String(targetingResult);
          reason = StandardResolutionReasons.TARGETING_MATCH;
        }
      } catch (e) {
        this.logger.debug(`Error evaluating targeting rule for flag '${this.key}': ${(e as Error).message}`);
        return {
          value: undefined as unknown as JsonValue,
          reason: StandardResolutionReasons.ERROR,
          errorCode: ErrorCode.GENERAL,
          errorMessage: `Error evaluating targeting rule for flag '${this.key}'`,
          flagMetadata: this.metadata,
        };
      }
    }

    if (!variant) {
      return {
        value: undefined as unknown as JsonValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.FLAG_NOT_FOUND,
        errorMessage: `Flag '${this.key}' has no default variant defined`,
        flagMetadata: this.metadata,
      };
    }

    const resolvedValue = this.variants.get(variant);
    if (resolvedValue === undefined) {
      return {
        value: undefined as unknown as JsonValue,
        reason: StandardResolutionReasons.ERROR,
        errorCode: ErrorCode.GENERAL,
        errorMessage: `Variant '${variant}' not found in flag with key '${this.key}'`,
        flagMetadata: this.metadata,
      };
    }

    return {
      value: resolvedValue as JsonValue,
      reason,
      variant,
      flagMetadata: this.metadata,
    };
  }
}

/**
 * Workers-compatible storage implementation.
 * Bypasses ajv schema validation which uses dynamic code generation.
 */
export class WorkersStorage {
  private _flags: Map<string, WorkersFeatureFlag>;
  private _flagSetMetadata: FlagMetadata = {};
  private logger: Logger;

  constructor(logger?: Logger) {
    this.logger = logger ?? defaultLogger;
    this._flags = new Map<string, WorkersFeatureFlag>();
  }

  getFlag(key: string): WorkersFeatureFlag | undefined {
    return this._flags.get(key);
  }

  getFlags(): Map<string, WorkersFeatureFlag> {
    return this._flags;
  }

  getFlagSetMetadata(): FlagMetadata {
    return this._flagSetMetadata;
  }

  setConfigurations(flagConfig: string): string[] {
    const transformed = transform(flagConfig);
    const parsedFlagConfig: FlagConfig = JSON.parse(transformed);

    const newFlags = new Map<string, WorkersFeatureFlag>();
    const flagSetMetadata = parsedFlagConfig.metadata ?? {};

    for (const flagsKey in parsedFlagConfig.flags) {
      const flag = parsedFlagConfig.flags[flagsKey];
      newFlags.set(
        flagsKey,
        new WorkersFeatureFlag(
          flagsKey,
          {
            ...flag,
            metadata: {
              ...parsedFlagConfig.metadata,
              ...flag.metadata,
            },
          },
          this.logger,
        ),
      );
    }

    const oldFlags = this._flags;
    const added: string[] = [];
    const removed: string[] = [];
    const changed: string[] = [];

    newFlags.forEach((_, key) => {
      if (!oldFlags.has(key)) {
        added.push(key);
      }
    });

    oldFlags.forEach((_, key) => {
      if (!newFlags.has(key)) {
        removed.push(key);
      }
    });

    this._flags = newFlags;
    this._flagSetMetadata = flagSetMetadata;
    return [...added, ...removed, ...changed];
  }
}
