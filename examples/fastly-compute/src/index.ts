import { OfrepHandler } from '@openfeature/flagd-ofrep-cf-worker';
import flags from './flags.json';

const ofrepHandler = new OfrepHandler({ flags });

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

async function handleRequest(event: FetchEvent): Promise<Response> {
  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname === '/health' || url.pathname === '/') {
    return jsonResponse({
      status: 'ok',
      runtime: 'fastly-compute',
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
}

addEventListener('fetch', (event: FetchEvent) => {
  event.respondWith(handleRequest(event));
});
