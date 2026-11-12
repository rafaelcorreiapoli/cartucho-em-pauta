import sharp from 'sharp';
import { expect, it } from 'vitest';
import { HEROES, hasHeroArt, type HeroKind } from '@brwars/simulation';
import { PACKED_LEGACY_FRAME_WIDTH, PACKED_UNIT_FRAME_WIDTH } from './battle/unit-art';
import heroOrigins from './hero-origins.json';

const heroes = (Object.keys(HEROES) as HeroKind[]).filter(hasHeroArt);
const atlases = [
  ...heroes.map((hero) => [`hero-${hero}`, PACKED_UNIT_FRAME_WIDTH, 512, 4, 2] as const),
  ...['left-ranged', 'medic-cubano', 'medic-convenio', 'workers-painted'].map(
    (name) => [name, PACKED_UNIT_FRAME_WIDTH, 512, 4, 2] as const,
  ),
  ...['left-animation', 'right-animation'].map(
    (name) => [name, PACKED_LEGACY_FRAME_WIDTH, 256, 8, 4] as const,
  ),
];

it.each(atlases)(
  'atlas de %s mantém cada pose isolada',
  async (name, width, height, cols, rows) => {
    const { data, info } = await sharp(
      new URL(`../public/assets/${name}-packed.webp`, import.meta.url).pathname,
    )
      .raw()
      .toBuffer({ resolveWithObject: true });
    expect([info.width, info.height, info.channels]).toEqual([width * cols, height * rows, 4]);
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        let opaque = 0;
        let borderPixels = 0;
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const alpha = data[((row * height + y) * info.width + col * width + x) * 4 + 3];
            if (alpha > 210) opaque++;
            if (alpha && (x < 3 || y < 3 || x >= width - 3 || y >= height - 3)) borderPixels++;
          }
        }
        expect(opaque).toBeGreaterThan(2_000);
        expect(borderPixels).toBe(0);
      }
    }
  },
);

it.each(heroes)('atlas de %s mantém oito âncoras válidas', (hero) => {
  const origins = heroOrigins[hero];
  expect(origins).toHaveLength(8);
  expect(origins.every((origin) => origin > 0.8 && origin < 1)).toBe(true);
});
