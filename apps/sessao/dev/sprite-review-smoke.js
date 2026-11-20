async (page) => {
  const base = page.url();
  const context = await page.context().browser().newContext();
  page = await context.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 1440, height: 1000});
  await page.goto(new URL('/sprites.html#subject=tiririca&pose=walk&direction=1&frame=2', base).href);
  await page.waitForFunction(() => document.querySelector('#sheets').getAttribute('aria-busy') === 'false');
  await page.getByRole('button', {name: 'Caminhar, Direita, quadro 3', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#frame-label').value === '3 / 4');
  await page.check('#onion');
  await page.selectOption('#verdict', 'revise');
  await page.fill('#note', 'Teste: conferir consistência dos contornos');
  await page.reload();
  await page.waitForFunction(() => document.querySelector('#sheets').getAttribute('aria-busy') === 'false');
  if (await page.inputValue('#note') !== 'Teste: conferir consistência dos contornos') throw new Error('Review note not persisted');
  if (await page.inputValue('#verdict') !== 'revise') throw new Error('Review verdict not persisted');
  const download = page.waitForEvent('download');
  await page.click('#export');
  if ((await download).suggestedFilename() !== 'infiltrados-revisao-sprites.json') throw new Error('Missing review export');
  await page.screenshot({path: '/tmp/infiltrados-sprite-review-desktop.png'});
  const result = await page.evaluate(async () => {
    const {spriteCatalog, spriteFrame, spriteSubjectResolution} = await import('/src/sprite-catalog.ts');
    const images = new Map();
    let frames = 0;
    for (const subject of [...spriteCatalog, ...spriteCatalog.filter(subject => subject.group === 'Jogadores').flatMap(subject => ['original', '128', '256', '512'].map(size => spriteSubjectResolution(subject, size)))]) for (const clip of subject.clips) {
      let image = images.get(clip.path);
      if (!image) {
        image = new Image(); image.src = '/' + clip.path; await image.decode(); images.set(clip.path, image);
      }
      const size = clip.size;
      for (let direction = 0; direction < clip.directions.length; direction++) for (let frame = 0; frame < clip.count; frame++) {
        const index = spriteFrame(clip, direction, frame);
        if (size) {
          const columns = image.naturalWidth / size;
          const rows = image.naturalHeight / size;
          if (!Number.isInteger(columns) || !Number.isInteger(rows) || index < 0 || index >= columns * rows) {
            throw new Error(`Out of bounds: ${subject.id}/${clip.id}/${direction}/${frame}`);
          }
        }
        frames++;
      }
    }
    return {subjects: spriteCatalog.length, poses: spriteCatalog.reduce((n, subject) => n + subject.clips.length, 0), sheets: images.size, frames};
  });
  await page.selectOption('#resolution', '512');
  await page.waitForFunction(() => document.querySelector('#sheets').getAttribute('aria-busy') === 'false' && document.querySelector('#asset').textContent.includes('tiririca-walk-512.webp'));
  if (await page.inputValue('#note')) throw new Error('Review status leaked between tiers');
  await page.selectOption('#resolution', '128');
  await page.waitForFunction(() => document.querySelector('#note').value.includes('Teste:'));
  await page.fill('#search', 'Palmirinha');
  await page.getByRole('button', {name: 'Palmirinha', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#sheets').getAttribute('aria-busy') === 'false');
  if (await page.locator('.frame-button').count() !== 1) throw new Error('NPC incorrectly offers extra poses');
  await page.fill('#search', 'Federal');
  await page.getByRole('button', {name: 'Japonês da Federal', exact: true}).click();
  await page.waitForFunction(() => document.querySelector('#sheets').getAttribute('aria-busy') === 'false');
  await page.selectOption('#pose', 'door-breach');
  await page.selectOption('#direction', '3');
  await page.waitForFunction(() => document.querySelector('#asset').textContent.includes('japones-federal-door-breach'));
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: '/tmp/infiltrados-sprite-review-mobile.png'});
  if (await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)) throw new Error('Mobile horizontal overflow');
  if (errors.length) throw new Error(errors.join('\n'));
  await page.goto(new URL('/sprites.html#subject=lula-safe-breach-imagegen&pose=safe-breach&direction=0&frame=3', base).href);
  await page.waitForFunction(() => document.querySelector('#reference').hidden === false && document.querySelector('#asset').textContent.includes('lula-safe-breach-imagegen'));
  const imageExperiment = await page.evaluate(async () => {
    const {frameEdges, paintFrame} = await import('/src/sprite-review-renderer.ts');
    const {spriteCatalog} = await import('/src/sprite-catalog.ts');
    const {spriteFrameOffsetX} = await import('/src/sprite-alignment.ts');
    const original = new Image(); original.src = '/assets/lula-safe-breach.webp'; await original.decode();
    const candidate = new Image(); candidate.src = '/assets/lula-safe-breach-imagegen.png'; await candidate.decode();
    const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const pixels = image => { ctx.clearRect(0, 0, 512, 128); ctx.drawImage(image, 0, 0); return ctx.getImageData(0, 0, 512, 128).data; };
    const a = pixels(original), b = pixels(candidate);
    let changed = 0;
    for (let y = 0; y < 128; y++) for (let x = 0; x < 512; x++) for (let channel = 0; channel < 4; channel++) {
      const i = (y * 512 + x) * 4 + channel;
      if (a[i] !== b[i]) {
        const protectedPixel = x < 384 || x - 384 < 84 || y < 35 || y > 88 || (y < 61 && x - 384 < 94);
        // WEBP and PNG decoders round premultiplied translucent edges differently.
        const alpha = a[(y * 512 + x) * 4 + 3];
        const effectiveDelta = channel === 3 ? Math.abs(a[i] - b[i]) : Math.abs(a[i] - b[i]) * alpha / 255;
        if (protectedPixel && effectiveDelta > (channel === 3 ? 0 : 2)) throw new Error(`Candidate changed protected pixels at ${x},${y}`);
        if (!protectedPixel) changed++;
      }
    }
    const clip = spriteCatalog.find(subject => subject.id === 'lula-safe-breach-imagegen').clips[0];
    if (!changed) throw new Error('Candidate is identical to original');
    if (!frameEdges(original, {...clip, path: 'assets/lula-safe-breach.webp'}, 0, 3).includes('direita')) throw new Error('Original right-edge clipping not detected');
    if (frameEdges(candidate, clip, 0, 3).includes('direita')) throw new Error('Candidate still touches right edge');
    paintFrame(canvas, candidate, clip, 0, 3, 128);
    if (canvas.style.width !== '160px') throw new Error('Frame has no outer inspection margin');
    const federal = new Image(); federal.src = '/assets/japones-federal-walk.png'; await federal.decode();
    canvas.width = 128; canvas.height = 128;
    for (let frame = 0; frame < 12; frame++) {
      ctx.clearRect(0, 0, 128, 128); ctx.drawImage(federal, frame % 4 * 128, Math.floor(frame / 4) * 128, 128, 128, 0, 0, 128, 128);
      const pixels = ctx.getImageData(0, 0, 128, 54).data;
      let left = 128, right = -1;
      for (let y = 0; y < 54; y++) for (let x = 0; x < 128; x++) if (pixels[(y * 128 + x) * 4 + 3] > 128) { left = Math.min(left, x); right = Math.max(right, x); }
      if ((left + right) / 2 + spriteFrameOffsetX('japones-federal-walk', frame) !== 64) throw new Error(`Federal head axis drift in frame ${frame}`);
    }
    return {changedChannels: changed, firstThreeFrames: 'unchanged', candidateRightEdge: 'clear', federalFrames: 12};
  });
  await page.getByRole('button', {name: 'Arrombar cofre, Pose única, quadro 4', exact: true}).click();
  await page.screenshot({path: '/tmp/infiltrados-lula-tool-comparison.png'});
  await context.close();
  return {...result, imageExperiment};
}
