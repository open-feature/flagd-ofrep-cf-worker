import { OFREPApi } from '@openfeature/ofrep-core';
import { OFREPProvider } from '@openfeature/ofrep-provider';
import { ErrorCode } from '@openfeature/server-sdk';
import { OfrepHandler } from '../src/ofrep-handler';
import testFlags from '../../../shared/test-flags.json';

const baseUrl = 'http://localhost';

function createFetchImplementation(handler: OfrepHandler): typeof fetch {
  return async (input, init) => {
    const request = new Request(input, init);
    return handler.handleRequest(request);
  };
}

function requireBulkSuccess(result: Awaited<ReturnType<OFREPApi['postBulkEvaluateFlags']>>) {
  if (!('flags' in result.value)) {
    throw new Error('Expected a bulk evaluation success response');
  }

  return result.value;
}

describe('OFREP contract', () => {
  let handler: OfrepHandler;
  let fetchImplementation: typeof fetch;

  beforeEach(() => {
    jest.useFakeTimers();
    handler = new OfrepHandler({ staticFlags: testFlags });
    fetchImplementation = createFetchImplementation(handler);
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  it('supports single-flag evaluation through the upstream OFREP provider', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveBooleanEvaluation('simple-boolean', true, {});

    expect(details).toMatchObject({
      value: false,
      variant: 'off',
      reason: 'STATIC',
    });
  });

  it('passes evaluation context through the upstream OFREP provider', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveBooleanEvaluation('targeted-boolean', false, {
      email: 'user@openfeature.dev',
    });

    expect(details).toMatchObject({
      value: true,
      variant: 'true',
      reason: 'TARGETING_MATCH',
    });
  });

  it('preserves primitive metadata on successful provider evaluations', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveStringEvaluation('targeted-string', 'fallback', {
      role: 'admin',
    });

    expect(details).toMatchObject({
      value: 'Hello, administrator!',
      variant: 'admin',
      reason: 'TARGETING_MATCH',
      flagMetadata: {
        owner: 'platform-team',
      },
    });
  });

  it('maps missing flags to FLAG_NOT_FOUND with flag set metadata', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveBooleanEvaluation('does-not-exist', false, {});

    expect(details).toMatchObject({
      value: false,
      reason: 'ERROR',
      errorCode: ErrorCode.FLAG_NOT_FOUND,
      flagMetadata: {
        flagSetId: 'test-flags',
        version: '1.0.0',
      },
    });
    expect(details.errorMessage).toContain('not found');
  });

  it('maps disabled flags to code defaults with DISABLED reason', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveBooleanEvaluation('disabled-flag', true, {});

    expect(details).toMatchObject({
      value: true,
      reason: 'DISABLED',
      flagMetadata: {
        flagSetId: 'test-flags',
        version: '1.0.0',
      },
    });
    expect(details.variant).toBeUndefined();
    expect(details.errorCode).toBeUndefined();
  });

  it('maps mismatched value types to TYPE_MISMATCH', async () => {
    const provider = new OFREPProvider({ baseUrl, fetchImplementation });

    const details = await provider.resolveNumberEvaluation('simple-boolean', 42, {});

    expect(details).toMatchObject({
      value: 42,
      reason: 'ERROR',
      errorCode: ErrorCode.TYPE_MISMATCH,
    });
  });

  it('supports bulk evaluation through the upstream OFREP API client', async () => {
    const api = new OFREPApi({ baseUrl }, fetchImplementation);

    const result = await api.postBulkEvaluateFlags({
      context: {
        email: 'user@openfeature.dev',
        role: 'admin',
        appVersion: '1.0.0',
      },
    });

    expect(result.httpStatus).toBe(200);

    const body = requireBulkSuccess(result);

    expect(body.metadata).toEqual({
      flagSetId: 'test-flags',
      version: '1.0.0',
    });
    expect(body.flags).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'simple-boolean',
          value: false,
          variant: 'off',
          reason: 'STATIC',
          metadata: {
            flagSetId: 'test-flags',
            version: '1.0.0',
          },
        }),
        expect.objectContaining({
          key: 'targeted-boolean',
          value: true,
          variant: 'true',
          reason: 'TARGETING_MATCH',
          metadata: {
            flagSetId: 'test-flags',
            version: '1.0.0',
          },
        }),
        expect.objectContaining({
          key: 'targeted-string',
          value: 'Hello, administrator!',
          variant: 'admin',
          reason: 'TARGETING_MATCH',
          metadata: expect.objectContaining({
            flagSetId: 'test-flags',
            version: '1.0.0',
            owner: 'platform-team',
          }),
        }),
        expect.objectContaining({
          key: 'disabled-flag',
          reason: 'DISABLED',
          metadata: {
            flagSetId: 'test-flags',
            version: '1.0.0',
          },
        }),
      ]),
    );

    const disabled = body.flags.find((flag) => flag.key === 'disabled-flag');
    expect(disabled).toBeDefined();
    expect(disabled).not.toHaveProperty('value');
  });
});
