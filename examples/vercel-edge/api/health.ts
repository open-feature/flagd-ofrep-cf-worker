export const config = {
  runtime: 'edge',
};

export default function health(): Response {
  return new Response(
    JSON.stringify({
      status: 'ok',
      runtime: 'vercel-edge',
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
