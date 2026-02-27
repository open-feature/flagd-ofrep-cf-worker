import { OfrepHandler, createOfrepHandler } from '../src/ofrep-handler';
import testFlags from '../../../shared/test-flags.json';

function makeRequest(path: string, options: RequestInit = {}): Request {
  return new Request(`http://localhost${path}`, options);
}

function postJson(path: string, body: unknown): Request {
  return makeRequest(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('OfrepHandler', () => {
  let handler: OfrepHandler;

  beforeEach(() => {
    handler = new OfrepHandler({ staticFlags: testFlags });
  });

  describe('routing', () => {
    it('should return 404 for unknown paths', async () => {
      const request = makeRequest('/unknown', { method: 'GET' });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(404);
    });

    it('should return 404 for GET on evaluation endpoint', async () => {
      const request = makeRequest('/ofrep/v1/evaluate/flags/simple-boolean', { method: 'GET' });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(404);
    });
  });

  describe('CORS', () => {
    it('should handle OPTIONS preflight request', async () => {
      const request = makeRequest('/ofrep/v1/evaluate/flags/simple-boolean', { method: 'OPTIONS' });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
      expect(response.headers.get('Access-Control-Allow-Methods')).toContain('POST');
    });

    it('should include CORS headers in evaluation responses', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await handler.handleRequest(request);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('should use custom CORS origin', async () => {
      const customHandler = new OfrepHandler({
        staticFlags: testFlags,
        corsOrigin: 'https://example.com',
      });
      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await customHandler.handleRequest(request);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com');
    });

    it('should omit CORS headers when cors is disabled', async () => {
      const noCorsHandler = new OfrepHandler({
        staticFlags: testFlags,
        cors: false,
      });
      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await noCorsHandler.handleRequest(request);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBeNull();
    });
  });

  describe('single flag evaluation', () => {
    it('should evaluate a simple boolean flag', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.key).toBe('simple-boolean');
      expect(body.value).toBe(false);
      expect(body.variant).toBe('off');
      expect(body.reason).toBeDefined();
    });

    it('should evaluate a simple string flag', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags/simple-string', {});
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.key).toBe('simple-string');
      expect(body.value).toBe('default-value');
    });

    it('should evaluate with targeting context', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags/targeted-boolean', {
        context: { email: 'user@openfeature.dev' },
      });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.value).toBe(true);
      expect(body.reason).toBe('TARGETING_MATCH');
    });

    it('should evaluate with empty body', async () => {
      const request = makeRequest('/ofrep/v1/evaluate/flags/simple-boolean', {
        method: 'POST',
      });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.value).toBe(false);
    });

    it('should return 404 for non-existent flag', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags/does-not-exist', {});
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.errorCode).toBe('FLAG_NOT_FOUND');
    });

    it('should return 400 for invalid JSON body', async () => {
      const request = makeRequest('/ofrep/v1/evaluate/flags/simple-boolean', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'not valid json {{{',
      });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.errorCode).toBe('PARSE_ERROR');
    });
  });

  describe('bulk evaluation', () => {
    it('should evaluate all flags', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags', {});
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.flags).toBeDefined();
      expect(Array.isArray(body.flags)).toBe(true);
      expect(body.flags.length).toBeGreaterThan(0);
    });

    it('should include metadata in bulk response', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags', {});
      const response = await handler.handleRequest(request);
      const body = await response.json();
      expect(body.metadata).toBeDefined();
    });

    it('should pass context to bulk evaluation', async () => {
      const request = postJson('/ofrep/v1/evaluate/flags', {
        context: { email: 'user@openfeature.dev' },
      });
      const response = await handler.handleRequest(request);
      const body = await response.json();

      const targeted = body.flags.find((f: { key: string }) => f.key === 'targeted-boolean');
      expect(targeted).toBeDefined();
      expect(targeted.value).toBe(true);
    });

    it('should return 400 for invalid JSON body in bulk', async () => {
      const request = makeRequest('/ofrep/v1/evaluate/flags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{invalid',
      });
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(400);

      const body = await response.json();
      expect(body.errorCode).toBe('PARSE_ERROR');
    });
  });

  describe('custom basePath', () => {
    it('should use custom base path', async () => {
      const customHandler = new OfrepHandler({
        staticFlags: testFlags,
        basePath: '/api/v2',
      });

      const request = postJson('/api/v2/evaluate/flags/simple-boolean', {});
      const response = await customHandler.handleRequest(request);
      expect(response.status).toBe(200);
    });

    it('should 404 on default path when custom path is set', async () => {
      const customHandler = new OfrepHandler({
        staticFlags: testFlags,
        basePath: '/api/v2',
      });

      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await customHandler.handleRequest(request);
      expect(response.status).toBe(404);
    });
  });

  describe('setFlags', () => {
    it('should update flags dynamically', async () => {
      handler.setFlags({
        flags: {
          'new-flag': {
            state: 'ENABLED',
            defaultVariant: 'on',
            variants: { on: true, off: false },
          },
        },
      });

      const request = postJson('/ofrep/v1/evaluate/flags/new-flag', {});
      const response = await handler.handleRequest(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.value).toBe(true);
    });
  });

  describe('createOfrepHandler', () => {
    it('should create a fetch handler function', async () => {
      const fetchHandler = createOfrepHandler({ staticFlags: testFlags });
      expect(typeof fetchHandler).toBe('function');

      const request = postJson('/ofrep/v1/evaluate/flags/simple-boolean', {});
      const response = await fetchHandler(request);
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.value).toBe(false);
    });
  });
});
