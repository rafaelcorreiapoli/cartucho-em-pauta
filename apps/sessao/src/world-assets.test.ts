import {expect, test} from 'bun:test';
import {worldAssets, assetImageSources} from './world-assets';
import {mapNpcs} from './npcs';
import {visitorSheets} from './visitors';
import {federalPatrolSheets} from './federal-patrol';

test('all requested NPCs, visitors, Federal, furniture and UI images ship real detail variants, excluding Trump', async () => {
  expect(worldAssets['donald-trump.webp']).toBeUndefined();
  expect(worldAssets['retrato-donald-trump.webp']).toBeUndefined();
  expect(assetImageSources('donald-trump.webp')).not.toHaveProperty('srcSet');
  for (const npc of Object.values(mapNpcs)) if (npc.sprite !== 'donald-trump.webp') expect(worldAssets[npc.sprite]?.variants.some(v => v.size === 512)).toBe(true);
  for (const sheet of [...visitorSheets,...federalPatrolSheets]) expect(Object.values(worldAssets).some(asset => asset?.id === sheet.key)).toBe(true);
  for (const filename of ['office-hd.png','retratos-elenco.webp','gabinete-cofre.webp','gabinete-cofre-aberto.webp','gabinete-armario.webp','gabinete-poltrona.webp','gabinete-tv.webp','gabinete-tapete.webp','terminal-seguranca.webp','painel-eletrico.webp','cadeira-reserva.webp','moldura-congresso.webp','retrato-tenis.webp','retrato-incendiario.webp','projetos/auxilio-churrasco.webp']) expect(worldAssets[filename]).toBeDefined();
  for (const asset of Object.values(worldAssets)) for (const variant of asset!.variants) {
    const file = Bun.file(new URL(`../public/${variant.path}`,import.meta.url));
    expect(await file.exists()).toBe(true);
    expect(await file.slice(8,16).text()).toBe('WEBPVP8L');
  }
});

test('browser image sources declare physical widths and preserve caller layout sizes', () => {
  const sources = assetImageSources('retrato-primeiros-socorros.webp','155px');
  expect(sources.sizes).toBe('155px');
  expect(sources.srcSet).toContain(' 128w');
  expect(sources.srcSet).toContain(' 256w');
  expect(sources.srcSet).toContain(' 512w');
});
