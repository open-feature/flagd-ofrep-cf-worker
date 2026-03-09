/**
 * Extract authentication token from an incoming request per the OFREP spec.
 *
 * The OFREP OpenAPI spec (v0.2.0) defines two authentication schemes:
 * - BearerAuth: `Authorization: Bearer <token>`
 * - ApiKeyAuth: `X-API-Key: <token>`
 *
 * Checks `Authorization` header first (stripping "Bearer " prefix),
 * then falls back to `X-API-Key` header.
 *
 * @returns The extracted token string, or null if no auth token is found.
 */
export function extractAuthToken(request: Request): string | null {
  const authHeader = request.headers.get('Authorization');
  if (authHeader) {
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    if (bearerMatch) {
      const token = bearerMatch[1].trim();
      if (token) {
        return token;
      }
    }
  }

  const apiKey = request.headers.get('X-API-Key');
  if (apiKey) {
    const token = apiKey.trim();
    if (token) {
      return token;
    }
  }

  return null;
}
