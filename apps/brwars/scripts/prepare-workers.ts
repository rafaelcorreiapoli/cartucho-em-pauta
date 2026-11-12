import sharp from 'sharp';
// The generated poses have slightly uneven column boundaries. Repack without
// changing relative character scale, then derive foot pivots from real alpha.
const source = process.argv[2];
if (!source) throw new Error('Usage: bun scripts/prepare-workers.ts <generated-source.png>');
const boundaries = [0, 360, 750, 1120, 1536],
  images = [];
for (let row = 0; row < 2; row++)
  for (let column = 0; column < 4; column++) {
    const width = boundaries[column + 1] - boundaries[column],
      targetWidth = Math.round(width * 0.9);
    const input = await sharp(source)
      .extract({ left: boundaries[column], top: row * 512, width, height: 512 })
      .resize(targetWidth, 461)
      .png()
      .toBuffer();
    images.push({
      input,
      left: column * 384 + Math.floor((384 - targetWidth) / 2),
      top: row * 512 + 25,
    });
  }
const destination = 'apps/web/public/assets/workers-painted.png';
await sharp({
  create: { width: 1536, height: 1024, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
})
  .composite(images)
  .png()
  .toFile(destination);
const { data, info } = await sharp(destination).raw().toBuffer({ resolveWithObject: true });
const anchors = [];
for (let row = 0; row < 2; row++)
  for (let column = 0; column < 4; column++) {
    let bottom = 0;
    for (let y = 0; y < 512; y++) {
      let count = 0;
      for (let x = 0; x < 384; x++)
        if (data[((row * 512 + y) * info.width + column * 384 + x) * 4 + 3] >= 210) count++;
      if (count >= 5) bottom = y + 1;
    }
    anchors.push(bottom / 512);
    for (let y = 0; y < 512; y++)
      for (const x of [0, 383])
        if (data[((row * 512 + y) * info.width + column * 384 + x) * 4 + 3] !== 0)
          throw new Error('Sprite bleeds across a cell edge');
  }
await Bun.write('apps/web/src/worker-origins.json', JSON.stringify(anchors) + '\n');
console.log('Worker atlas packed with transparent cell margins and aligned foot pivots.');
