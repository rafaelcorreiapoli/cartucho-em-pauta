import sharp from 'sharp';
import { expect, it } from 'vitest';
import { buildingArt, EVOLVING_BUILDINGS } from './building-art';

it.each(EVOLVING_BUILDINGS)('%s has six isolated evolution frames', async (kind) => {
  const levels = [5, 10, 15];
  const frames = (['left', 'right'] as const).flatMap((side) =>
    levels.map((level) => buildingArt(kind, side, level)),
  );
  const first = frames[0];
  const { data, info } = await sharp(
    new URL(`../public/assets/${first.file}`, import.meta.url).pathname,
  )
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  expect([info.width, info.height]).toEqual([first.sheetWidth, first.sheetHeight]);
  expect(frames.map(({ frame }) => frame)).toEqual([0, 1, 2, 3, 4, 5]);
  for (const { frame, columns, width, height } of frames) {
    const left = (frame % columns) * width;
    const top = Math.floor(frame / columns) * height;
    let opaque = 0;
    let opaqueBorder = 0;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const alpha = data[((top + y) * info.width + left + x) * 4 + 3];
        if (alpha > 210) opaque++;
        if (alpha && (x === 0 || y === 0 || x === width - 1 || y === height - 1)) opaqueBorder++;
      }
    }
    expect(opaque).toBeGreaterThan(10_000);
    expect(opaqueBorder).toBe(0);
  }
  expect(buildingArt(kind, 'left', 4).texture).not.toBe(first.texture);
  expect(buildingArt(kind, 'right', 14).frame).toBe(4);
});
