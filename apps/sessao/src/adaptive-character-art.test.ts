import {expect, test} from 'bun:test';
import {actorFrameWorldSize, actorTextureResolution, actorTextureVariants} from './adaptive-character-art';

test('actor textures follow actual render demand without changing world size', () => {
  expect(actorFrameWorldSize).toBe(37.76);
  expect(actorTextureResolution(1.5)).toBe(128);
  expect(actorTextureResolution(2.5)).toBe(128);
  expect(actorTextureResolution(4.65)).toBe(256);
  expect(actorTextureResolution(4.65 * 2)).toBe(512);
  expect(actorTextureResolution(20)).toBe(512);
});

test('every available adaptive variant ships, ordered by frame resolution', async () => {
  for (const variants of Object.values(actorTextureVariants)) {
    if (!variants) continue;
    expect(variants.map(variant => variant.size)).toEqual([...variants.map(variant => variant.size)].sort((a,b) => a-b));
    for (const variant of variants) expect(await Bun.file(new URL(`../public/${variant.path}`, import.meta.url)).exists()).toBe(true);
  }
});

test('the main cast, nine visitors, Federal and Collant ship every pose at both adaptive tiers with complete frame grids', async () => {
  expect(Object.keys(actorTextureVariants)).toHaveLength(101);
  for (const [key, variants] of Object.entries(actorTextureVariants)) {
    expect(variants?.map(variant => variant.size)).toEqual([256, 512]);
    const rows = key==='collant-walk' || key.endsWith('-door-breach') ? 4 : key.startsWith('walk:') || /-(walk|attack|hit|fall)$/.test(key) ? 3 : /-(safe-deposit|npc-robbery)$/.test(key) ? 2 : 1;
    for (const variant of variants!) {
      const asset = Bun.file(new URL(`../public/${variant.path}`, import.meta.url));
      expect(await asset.slice(8,16).text()).toBe('WEBPVP8L');
      const dimensions = new DataView(await asset.slice(21,25).arrayBuffer()).getUint32(0,true);
      expect([1+(dimensions&0x3fff),1+((dimensions>>>14)&0x3fff)]).toEqual([4*variant.size,rows*variant.size]);
    }
  }
});
