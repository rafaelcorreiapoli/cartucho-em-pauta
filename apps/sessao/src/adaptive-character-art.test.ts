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
