import sharp from 'sharp';
// Remove only edge-connected fragments belonging to adjacent cells. Detached props
// inside a cell remain intact. A transparent gutter also prevents texture sampling bleed.
export function cleanFrame(data: Uint8Array, width: number, height: number) {
  const seen = new Uint8Array(width * height),
    components: number[][] = [];
  for (let p = 0; p < seen.length; p++) {
    if (seen[p] || data[p * 4 + 3] < 32) continue;
    const component = [p];
    seen[p] = 1;
    for (let i = 0; i < component.length; i++) {
      const q = component[i],
        x = q % width,
        y = Math.floor(q / width);
      for (const n of [
        x > 0 ? q - 1 : -1,
        x < width - 1 ? q + 1 : -1,
        y > 0 ? q - width : -1,
        y < height - 1 ? q + width : -1,
      ])
        if (n >= 0 && !seen[n] && data[n * 4 + 3] >= 32) {
          seen[n] = 1;
          component.push(n);
        }
    }
    components.push(component);
  }
  for (let p = 0; p < seen.length; p++) if (!seen[p]) data[p * 4 + 3] = 0;
  const main = components.reduce<number[]>((a, b) => (a.length > b.length ? a : b), []);
  for (const component of components)
    if (component !== main && component.some((p) => p % width === 0 || p % width === width - 1))
      for (const p of component) data[p * 4 + 3] = 0;
  for (let y = 0; y < height; y++) {
    data[y * width * 4 + 3] = 0;
    data[(y * width + width - 1) * 4 + 3] = 0;
  }
  return data;
}
if (import.meta.main)
  for (const side of ['left', 'right']) {
    const path = `apps/web/public/assets/${side}-animation.png`;
    const { data, info } = await sharp(path)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const layers = [];
    for (let row = 0; row < 4; row++)
      for (let col = 0; col < 8; col++) {
        const frame = await sharp(data, { raw: info })
          .extract({ left: col * 192, top: row * 256, width: 192, height: 256 })
          .raw()
          .toBuffer();
        layers.push({
          input: await sharp(cleanFrame(frame, 192, 256), {
            raw: { width: 192, height: 256, channels: 4 },
          })
            .png()
            .toBuffer(),
          left: col * 192,
          top: row * 256,
        });
      }
    await sharp({
      create: { width: info.width, height: info.height, channels: 4, background: '#00000000' },
    })
      .composite(layers)
      .png()
      .toFile(path.replace('.png', '-clean.png'));
  }
