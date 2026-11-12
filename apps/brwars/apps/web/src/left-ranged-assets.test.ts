import sharp from 'sharp';
import { expect, it } from 'vitest';
import origins from './left-ranged-origins.json';
it('Sindicalista tem oito frames próprios e fundo transparente, com âncoras válidas', async () => {
  const { data, info } = await sharp(
    new URL('../public/assets/left-ranged.png', import.meta.url).pathname,
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height, info.channels]).toEqual([1536, 1024, 4]);
  expect(origins).toHaveLength(8);
  for (let frame = 0; frame < 8; frame++) {
    const col = frame % 4,
      row = Math.floor(frame / 4);
    for (const [x, y] of [
      [0, 0],
      [383, 0],
      [0, 511],
      [383, 511],
    ])
      expect(data[((row * 512 + y) * info.width + col * 384 + x) * 4 + 3]).toBe(0);
    expect(origins[frame]).toBeGreaterThan(0.75);
    expect(origins[frame]).toBeLessThan(1);
  }
});
