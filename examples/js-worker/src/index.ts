import { OfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';

// Import the flag configuration
// In a real application, you might load this from KV or an external source
import flags from './flags.json';

// Create the OFREP handler
const ofrepHandler = new OfrepHandler({ flags });

export default {
  async fetch(request: Request, _env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'flagd-ofrep-js-worker',
          endpoints: {
            evaluate: '/ofrep/v1/evaluate/flags/{key}',
            bulk: '/ofrep/v1/evaluate/flags',
          },
        }),
        {
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }

    // Handle OFREP requests
    if (url.pathname.startsWith('/ofrep/')) {
      return ofrepHandler.handleRequest(request);
    }

    // Not found
    return new Response(
      JSON.stringify({ error: 'Not found' }),
      { status: 404, headers: { 'Content-Type': 'application/json' } },
    );
  },
};

// Environment bindings (for future use with KV, etc.)
interface Env {
  // FLAGS: KVNamespace;
}
