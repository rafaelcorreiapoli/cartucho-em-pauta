import sharp from 'sharp';
import { expect, it } from 'vitest';
import leftOrigins from './medic-origins.json';
import rightOrigins from './medic-right-origins.json';
it.each(['left', 'right'] as const)(
  'atlas do médico %s tem oito frames com transparência real e âncoras válidas',
  async (side) => {
    const origins = side === 'left' ? leftOrigins : rightOrigins;
    const { data, info } = await sharp(
      new URL(
        `../public/assets/${side === 'left' ? 'medic-cubano' : 'medic-convenio'}.png`,
        import.meta.url,
      ).pathname,
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
        expect(data[((row * 512 + y) * info.width + col * 384 + x) * 4 + 3]).toBeLessThan(8);
      let opaque = 0;
      for (let y = 0; y < 512; y++)
        for (let x = 0; x < 384; x++)
          if (data[((row * 512 + y) * info.width + col * 384 + x) * 4 + 3] > 210) opaque++;
      expect(opaque).toBeGreaterThan(10000);
      expect(origins[frame]).toBeGreaterThan(0.8);
      expect(origins[frame]).toBeLessThan(1);
    }
  },
);
