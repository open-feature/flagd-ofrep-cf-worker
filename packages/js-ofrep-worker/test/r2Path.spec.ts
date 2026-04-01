import type { Mock } from 'vitest';
import worker from '../../../examples/js-worker/src/index';

type MockCache = {
  match: Mock<(request: Request) => Promise<Response | undefined>>;
  put: Mock<(request: Request, response: Response) => Promise<void>>;
};

function installMockCache(): MockCache {
  const cache: MockCache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };

  Object.defineProperty(globalThis, 'caches', {
    value: { default: cache },
    configurable: true,
  });

  return cache;
}

function makeWorkerExecutionContext(): ExecutionContext {
  return {
    waitUntil: vi.fn(),
    passThroughOnException: vi.fn(),
  } as unknown as ExecutionContext;
}

function makeOfrepRequest(headers: HeadersInit = {}): Request {
  return new Request('http://localhost/ofrep/v1/evaluate/flags/simple-boolean', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: '{}',
  });
}

function makeR2Env(bucket?: R2Bucket): { FLAG_SOURCE: 'r2'; FLAGS_R2_BUCKET?: R2Bucket } {
  return {
    FLAG_SOURCE: 'r2',
    FLAGS_R2_BUCKET: bucket,
  };
}

describe('R2-backed OFREP path', () => {
  let cache: MockCache;

  beforeEach(() => {
    cache = installMockCache();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('handles OFREP preflight requests before auth or R2 access', async () => {
    const ctx = makeWorkerExecutionContext();
    const response = await worker.fetch(
      new Request('http://localhost/ofrep/v1/evaluate/flags/simple-boolean', { method: 'OPTIONS' }),
      makeR2Env(),
      ctx,
    );

    expect(response.status).toBe(204);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Headers')).toContain('Authorization');
  });

  it('returns auth failures with CORS headers', async () => {
    const bucket = {
      get: vi.fn(),
    } as unknown as R2Bucket;

    const response = await worker.fetch(makeOfrepRequest(), makeR2Env(bucket), makeWorkerExecutionContext());

    expect(response.status).toBe(401);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(bucket.get).not.toHaveBeenCalled();
  });

  it('returns missing config failures with CORS headers', async () => {
    const bucket = {
      get: vi.fn().mockResolvedValue(null),
    } as unknown as R2Bucket;

    const response = await worker.fetch(
      makeOfrepRequest({ Authorization: 'Bearer token-123' }),
      makeR2Env(bucket),
      makeWorkerExecutionContext(),
    );

    expect(response.status).toBe(404);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(cache.match).toHaveBeenCalledTimes(1);
    expect(bucket.get).toHaveBeenCalledWith('flags/token-123/flags.json');
  });

  it('returns R2 failures with CORS headers', async () => {
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const bucket = {
      get: vi.fn().mockRejectedValue(new Error('boom')),
    } as unknown as R2Bucket;

    const response = await worker.fetch(
      makeOfrepRequest({ Authorization: 'Bearer token-123' }),
      makeR2Env(bucket),
      makeWorkerExecutionContext(),
    );

    expect(response.status).toBe(500);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(bucket.get).toHaveBeenCalledTimes(2);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });
});
