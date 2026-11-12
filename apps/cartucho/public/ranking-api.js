export const rankingUrl = '/.netlify/functions/ranking';

export async function registerOpening(game) {
  const response = await fetch(rankingUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ game }),
    keepalive: true,
  });
  if (!response.ok) throw new Error('Abertura não registrada');
  return response.json();
}
