import { setTimeout } from 'node:timers/promises';
import { getStore } from '@netlify/blobs';

const games = ['brwars', 'brspire'];
const headers = { 'Cache-Control': 'no-store' };

export default async function ranking(request) {
  const store = getStore({ name: 'ranking', consistency: 'strong' });

  if (request.method === 'GET') {
    const counts = await Promise.all(games.map(async game => [
      game, (await store.get(game, { type: 'json' })) ?? 0,
    ]));
    return Response.json(Object.fromEntries(counts), { headers });
  }

  if (request.method !== 'POST') {
    return new Response(null, { status: 405, headers: { ...headers, Allow: 'GET, POST' } });
  }

  if (request.headers.get('content-type')?.split(';')[0] !== 'application/json') {
    return new Response(null, { status: 415, headers });
  }

  const body = await request.json().catch(() => null);
  const game = body?.game;
  if (!games.includes(game)) {
    return new Response(null, { status: 400, headers });
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const entry = await store.getWithMetadata(game, { type: 'json' });
    const count = (entry?.data ?? 0) + 1;
    const condition = entry ? { onlyIfMatch: entry.etag } : { onlyIfNew: true };
    const result = await store.setJSON(game, count, condition);
    if (result.modified) {
      return Response.json({ [game]: count }, { headers });
    }

    await setTimeout(20 + Math.random() * 30 * (attempt + 1));
  }

  return new Response(null, { status: 503, headers });
}
