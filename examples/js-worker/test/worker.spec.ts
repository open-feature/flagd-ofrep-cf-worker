import { exports } from 'cloudflare:workers';

function postJson(path: string, body: unknown): Request {
  return new Request(`http://localhost${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('static flag worker', () => {
  describe('service endpoints', () => {
    it('returns service info at root', async () => {
      const response = await exports.default.fetch('http://localhost/');
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
      expect(body.service).toBe('flagd-ofrep-js-worker');
      expect(body.flagSource).toBe('static');
    });

    it('returns health check', async () => {
      const response = await exports.default.fetch('http://localhost/health');
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.status).toBe('ok');
    });

    it('returns 404 for unknown paths', async () => {
      const response = await exports.default.fetch('http://localhost/unknown');
      expect(response.status).toBe(404);
    });
  });

  describe('single flag evaluation', () => {
    it('evaluates a boolean flag', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags/simple-boolean', {}));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.key).toBe('simple-boolean');
      expect(body.value).toBe(false);
      expect(body.variant).toBe('off');
      expect(body.reason).toBeDefined();
    });

    it('evaluates a string flag', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags/simple-string', {}));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.key).toBe('simple-string');
      expect(body.value).toBe('default-value');
    });

    it('evaluates with targeting context', async () => {
      const response = await exports.default.fetch(
        postJson('/ofrep/v1/evaluate/flags/targeted-boolean', {
          context: { email: 'user@openfeature.dev' },
        }),
      );
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.value).toBe(true);
      expect(body.reason).toBe('TARGETING_MATCH');
    });

    it('returns 404 for non-existent flag', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags/does-not-exist', {}));
      expect(response.status).toBe(404);

      const body = await response.json();
      expect(body.errorCode).toBe('FLAG_NOT_FOUND');
    });

    it('defers disabled flags to code defaults', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags/disabled-flag', {}));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.key).toBe('disabled-flag');
      expect(body.reason).toBe('DISABLED');
    });
  });

  describe('bulk evaluation', () => {
    it('evaluates all flags', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags', {}));
      expect(response.status).toBe(200);

      const body = await response.json();
      expect(body.flags).toBeDefined();
      expect(Array.isArray(body.flags)).toBe(true);
      expect(body.flags.length).toBeGreaterThan(0);
    });

    it('includes metadata in bulk response', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags', {}));
      const body = await response.json();
      expect(body.metadata).toBeDefined();
      expect(body.metadata.flagSetId).toBe('js-worker-example');
    });

    it('passes context to bulk evaluation', async () => {
      const response = await exports.default.fetch(
        postJson('/ofrep/v1/evaluate/flags', {
          context: { email: 'user@openfeature.dev' },
        }),
      );
      const body = await response.json();

      const targeted = body.flags.find((f: { key: string }) => f.key === 'targeted-boolean');
      expect(targeted).toBeDefined();
      expect(targeted.value).toBe(true);
    });
  });

  describe('CORS', () => {
    it('handles OPTIONS preflight on OFREP paths', async () => {
      const response = await exports.default.fetch(
        new Request('http://localhost/ofrep/v1/evaluate/flags/simple-boolean', { method: 'OPTIONS' }),
      );
      expect(response.status).toBe(204);
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });

    it('includes CORS headers on evaluation responses', async () => {
      const response = await exports.default.fetch(postJson('/ofrep/v1/evaluate/flags/simple-boolean', {}));
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    });
  });
});
