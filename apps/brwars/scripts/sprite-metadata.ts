import {
  PACKED_UNIT_FRAME_WIDTH,
  PACKED_LEGACY_FRAME_WIDTH,
} from '../apps/web/src/battle/unit-art';
import {
  EVOLVING_BUILDINGS,
  EVOLUTION_FRAME_SIZE,
  evolutionTexture,
} from '../apps/web/src/building-art';
import { HEROES, hasHeroArt, type HeroKind } from '../packages/simulation/src/heroes';
import sharp from 'sharp';
// Only read pixels to derive foot anchors. The original generated PNGs stay unchanged.
const anchors: Record<string, number[]> = {};
for (const side of ['left', 'right']) {
  const { data, info } = await sharp(`apps/web/public/assets/${side}-animation-packed.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const width = PACKED_LEGACY_FRAME_WIDTH,
    height = info.height / 4;
  anchors[side] = [];
  for (let row = 0; row < 4; row++)
    for (let column = 0; column < 8; column++) {
      let bottom = 0;
      // Ignore translucent ground glow and require a small run of opaque sprite pixels.
      for (let y = 0; y < height; y++) {
        let opaque = 0;
        for (let x = 0; x < width; x++) {
          const alpha = data[((row * height + y) * info.width + column * width + x) * 4 + 3];
          if (alpha >= 210) opaque++;
        }
        if (opaque >= 5) bottom = y + 1;
      }
      anchors[side].push(Math.round((bottom / height) * 10000) / 10000);
    }
}
await Bun.write('apps/web/src/sprite-origins.json', JSON.stringify(anchors, null, 2) + '\n');
console.log('Sprite foot anchors:', anchors);

const buildingAnchors: Record<string, number[]> = {},
  buildingTops: Record<string, number[]> = {};
for (const [key, file, frameWidth, frameHeight] of [
  ['buildings', 'buildings.png', 384, 512],
  ['construction', 'construction.png', 384, 512],
  ['academy', 'academies.png', 768, 1024],
  ['bank', 'banks.png', 768, 1024],
  ['housing', 'housing.png', 768, 1024],
  ['civic', 'civic.png', 768, 1024],
  ['school', 'schools.png', 768, 1024],
  ['hospital', 'hospitals.png', 768, 1024],
  ['workplace', 'workplaces.png', 768, 1024],
  ['park-depot', 'park-depot-v3.webp', 512, 512],
  ...EVOLVING_BUILDINGS.map(
    (kind) =>
      [
        evolutionTexture(kind),
        `${evolutionTexture(kind)}.webp`,
        EVOLUTION_FRAME_SIZE,
        EVOLUTION_FRAME_SIZE,
      ] as const,
  ),
] as const) {
  const { data, info } = await sharp(`apps/web/public/assets/${file}`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  buildingAnchors[key] = [];
  buildingTops[key] = [];
  for (let row = 0; row < Math.floor(info.height / frameHeight); row++)
    for (let col = 0; col < Math.floor(info.width / frameWidth); col++) {
      let bottom = 0,
        top = -1;
      for (let y = 0; y < frameHeight; y++) {
        let opaque = 0;
        for (let x = 0; x < frameWidth; x++)
          if (data[((row * frameHeight + y) * info.width + col * frameWidth + x) * 4 + 3] >= 210)
            opaque++;
        if (opaque >= 5) {
          bottom = y + 1;
          if (top < 0) top = y;
        }
      }
      buildingTops[key].push(Math.round((Math.max(0, top) / frameHeight) * 10000) / 10000);
      buildingAnchors[key].push(Math.round((bottom / frameHeight) * 10000) / 10000);
    }
}
await Bun.write(
  'apps/web/src/building-origins.json',
  JSON.stringify(buildingAnchors, null, 2) + '\n',
);
console.log('Building ground anchors:', buildingAnchors);

await Bun.write('apps/web/src/building-tops.json', JSON.stringify(buildingTops, null, 2) + '\n');

const heroAnchors: Record<string, number[]> = {};
for (const hero of (Object.keys(HEROES) as HeroKind[]).filter(hasHeroArt)) {
  const { data, info } = await sharp(`apps/web/public/assets/hero-${hero}-packed.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  heroAnchors[hero] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      let bottom = 0;
      for (let y = 0; y < 512; y++) {
        let opaque = 0;
        for (let x = 0; x < PACKED_UNIT_FRAME_WIDTH; x++)
          if (
            data[((row * 512 + y) * info.width + col * PACKED_UNIT_FRAME_WIDTH + x) * 4 + 3] >= 210
          )
            opaque++;
        if (opaque >= 5) bottom = y + 1;
      }
      heroAnchors[hero].push(Math.round((bottom / 512) * 10000) / 10000);
    }
}
await Bun.write('apps/web/src/hero-origins.json', JSON.stringify(heroAnchors, null, 2) + '\n');

// Dedicated atlases with per-frame feet anchoring.
for (const [asset, output] of [
  ['medic-cubano', 'medic-origins'],
  ['medic-convenio', 'medic-right-origins'],
  ['left-ranged', 'left-ranged-origins'],
  ['workers-painted', 'worker-origins'],
]) {
  const { data, info } = await sharp(`apps/web/public/assets/${asset}-packed.webp`)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  const anchors: number[] = [];
  for (let row = 0; row < 2; row++)
    for (let col = 0; col < 4; col++) {
      let bottom = 0;
      for (let y = 0; y < 512; y++) {
        let opaque = 0;
        for (let x = 0; x < PACKED_UNIT_FRAME_WIDTH; x++)
          if (
            data[((row * 512 + y) * info.width + col * PACKED_UNIT_FRAME_WIDTH + x) * 4 + 3] >= 210
          )
            opaque++;
        if (opaque >= 5) bottom = y + 1;
      }
      anchors.push(Math.round((bottom / 512) * 10000) / 10000);
    }
  await Bun.write(`apps/web/src/${output}.json`, JSON.stringify(anchors) + '\n');
}
