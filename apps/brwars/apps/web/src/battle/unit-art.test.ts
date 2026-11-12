import sharp from 'sharp';
import { createGame, spawnUnit } from '@brwars/simulation';
import { describe, expect, it } from 'vitest';
import { VIEW_HEIGHT, VIEW_WIDTH } from '../camera';
import {
  animationKey,
  healthColor,
  unitFrameStart,
  unitVisualHeight,
  variantTexture,
  VARIANT_CLASSES,
  VARIANT_FRAME_SIZE,
  VARIANT_WALK_FRAMES,
  variantWalkTexture,
} from './unit-art';
import { renderScale } from './viewport';

describe('regras visuais independentes do Phaser', () => {
  it('mantém as cores de vida pelos limiares, sem depender da facção', () => {
    expect(healthColor(1)).toBe(0x71d46b);
    expect(healthColor(0.7)).toBe(0x71d46b);
    expect(healthColor(0.699)).toBe(0xf3ca43);
    expect(healthColor(0.3)).toBe(0xf3ca43);
    expect(healthColor(0.299)).toBe(0xed554c);
  });
  it('crescimento dos heróis respeita os limites de nível', () => {
    expect(unitVisualHeight('hero', 100)).toBeCloseTo(unitVisualHeight('hero', 1) * 1.36);
    expect(unitVisualHeight('hero', 101)).toBe(unitVisualHeight('hero', 100));
    expect(unitVisualHeight('hero', -1)).toBe(unitVisualHeight('hero', 1));
    expect(unitVisualHeight('front', 10)).toBe(unitVisualHeight('front', 1));
  });
  it('sprites dedicados não herdam offsets do atlas compartilhado', () => {
    const game = createGame();
    spawnUnit(game, 'left', 'ranged', 1, true);
    const left = game.units.at(-1)!;
    spawnUnit(game, 'right', 'ranged', 1, true);
    const right = game.units.at(-1)!;
    spawnUnit(game, 'left', 'medic', 1, true);
    const medic = game.units.at(-1)!;
    expect(unitFrameStart(left)).toBe(0);
    expect(unitFrameStart(right)).toBe(8);
    expect(unitFrameStart(medic)).toBe(0);
    expect(animationKey('left', 'medic', 'walk')).toBe('left-medic-walk');
  });
  it.each(['left', 'right'] as const)('carrega todas as poses dedicadas de %s', async (side) => {
    const game = createGame();
    for (const kind of VARIANT_CLASSES) {
      const texture = variantTexture(side, kind, 1)!;
      const { data, info } = await sharp(
        new URL(`../../public/assets/${texture}.webp`, import.meta.url).pathname,
      )
        .raw()
        .toBuffer({ resolveWithObject: true });
      const size = VARIANT_FRAME_SIZE;
      const columns = 3;
      expect([info.width, info.height, info.channels]).toEqual([columns * size, 3 * size, 4]);
      for (const tier of [1, 2, 3] as const) {
        spawnUnit(game, side, kind, 5 * tier, true, undefined, tier);
        const first = unitFrameStart(game.units.at(-1)!);
        expect(first).toBe((tier - 1) * columns);
        expect(animationKey(side, kind, 'attack', undefined, tier)).toContain(texture);
        for (let col = 0; col < columns; col++) {
          const left = col * size;
          const top = Math.floor(first / columns) * size;
          let opaque = 0;
          for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
              if (data[((top + y) * info.width + left + x) * 4 + 3] > 210) opaque++;
            }
          }
          expect(opaque).toBeGreaterThan(2_000);
        }
      }
    }
  });
  it.each(['left', 'right'] as const)(
    'isola as quatro passadas por unidade de %s',
    async (side) => {
      const size = VARIANT_FRAME_SIZE;
      for (const kind of ['front', 'ranged'] as const) {
        const texture = variantWalkTexture(side, kind);
        const atlas = sharp(
          new URL(`../../public/assets/${texture}.webp`, import.meta.url).pathname,
        );
        const { width, height } = await atlas.metadata();
        expect([width, height]).toEqual([VARIANT_WALK_FRAMES * size, 3 * size]);
        for (let row = 0; row < 3; row++) {
          const silhouettes = new Set<string>();
          for (let col = 0; col < VARIANT_WALK_FRAMES; col++) {
            const { data, info } = await atlas
              .clone()
              .extract({ left: col * size, top: row * size, width: size, height: size })
              .extractChannel('alpha')
              .raw()
              .toBuffer({ resolveWithObject: true });
            expect(info.channels).toBe(1);
            expect(data.filter((alpha) => alpha > 210).length).toBeGreaterThan(2_000);
            const opaque = data.map((alpha) => (alpha > 45 ? 1 : 0));
            expect(opaque.subarray(0, size).includes(1)).toBe(false);
            expect(opaque.subarray(244 * size).includes(1)).toBe(false);
            expect(
              opaque.some(
                (alpha, pixel) => alpha && (pixel % size === 0 || pixel % size === size - 1),
              ),
            ).toBe(false);
            silhouettes.add(Buffer.from(opaque.subarray(180 * size)).toString('base64'));
          }
          expect(silhouettes.size).toBe(VARIANT_WALK_FRAMES);
        }
      }
    },
  );
  it('a resolução acompanha Retina e resize sem ultrapassar o limite de GPU', () => {
    expect(renderScale(VIEW_WIDTH, VIEW_HEIGHT, 1)).toBe(1);
    expect(renderScale(VIEW_WIDTH, VIEW_HEIGHT, 2)).toBe(2);
    expect(renderScale(VIEW_WIDTH * 2, VIEW_HEIGHT * 2, 2)).toBe(3);
    expect(renderScale(100, 100, 1)).toBe(1);
    expect(renderScale(VIEW_WIDTH, VIEW_HEIGHT, 0)).toBe(1);
  });
});
