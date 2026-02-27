import { extractAuthToken } from '../src/auth';

describe('extractAuthToken', () => {
  it('returns bearer token from authorization header', () => {
    const request = new Request('http://localhost/ofrep/v1/evaluate/flags', {
      headers: { Authorization: 'Bearer token-123' },
    });
    expect(extractAuthToken(request)).toBe('token-123');
  });

  it('returns null for malformed bearer authorization header', () => {
    const request = new Request('http://localhost/ofrep/v1/evaluate/flags', {
      headers: { Authorization: 'Bearer   ' },
    });
    expect(extractAuthToken(request)).toBeNull();
  });

  it('returns x-api-key when authorization is non-bearer', () => {
    const request = new Request('http://localhost/ofrep/v1/evaluate/flags', {
      headers: {
        Authorization: 'Basic abc123',
        'X-API-Key': 'api-key-1',
      },
    });
    expect(extractAuthToken(request)).toBe('api-key-1');
  });

  it('returns x-api-key when authorization header is absent', () => {
    const request = new Request('http://localhost/ofrep/v1/evaluate/flags', {
      headers: { 'X-API-Key': 'api-key-2' },
    });
    expect(extractAuthToken(request)).toBe('api-key-2');
  });

  it('returns null when no supported auth headers are present', () => {
    const request = new Request('http://localhost/ofrep/v1/evaluate/flags');
    expect(extractAuthToken(request)).toBeNull();
  });
});
