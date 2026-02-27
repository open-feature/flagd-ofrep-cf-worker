import { OfrepHandler } from '../../packages/js-ofrep-worker/dist/index.mjs';
import flags from './flags.json' with { type: 'json' };

const ofrepHandler = new OfrepHandler({ flags });

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve({ port: 8790 }, async (request) => {
  const url = new URL(request.url);

  if (url.pathname === '/health' || url.pathname === '/') {
    return jsonResponse({
      status: 'ok',
      runtime: 'deno-deploy',
      endpoints: {
        evaluate: '/ofrep/v1/evaluate/flags/{key}',
        bulk: '/ofrep/v1/evaluate/flags',
      },
    });
  }

  if (url.pathname.startsWith('/ofrep/')) {
    return ofrepHandler.handleRequest(request);
  }

  return jsonResponse({ error: 'Not found' }, 404);
});
