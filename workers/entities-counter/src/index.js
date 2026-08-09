const allowedOrigins = new Set([
  'https://entroversu.com',
  'https://www.entroversu.com'
]);

const json = (body, status, origin) => new Response(JSON.stringify(body), {
  status,
  headers: {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Accept',
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'Vary': 'Origin',
    'X-Content-Type-Options': 'nosniff'
  }
});

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin');
    if (!origin || !allowedOrigins.has(origin)) {
      return new Response('Forbidden', { status: 403 });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Accept',
          'Access-Control-Max-Age': '86400',
          'Vary': 'Origin'
        }
      });
    }

    const { pathname } = new URL(request.url);
    const stored = await env.ENTITIES.get('total');
    const current = Number.parseInt(stored || '0', 10);
    const count = Number.isSafeInteger(current) && current >= 0 ? current : 0;

    if (request.method === 'GET' && pathname === '/count') {
      return json({ count }, 200, origin);
    }

    if (request.method === 'POST' && pathname === '/enter') {
      const next = count + 1;
      await env.ENTITIES.put('total', String(next));
      return json({ count: next }, 200, origin);
    }

    return json({ error: 'Not found' }, 404, origin);
  }
};
