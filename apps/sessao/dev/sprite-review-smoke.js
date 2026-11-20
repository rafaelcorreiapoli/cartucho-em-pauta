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
    const {spriteCatalog, spriteFrame} = await import('/src/sprite-catalog.ts');
    const images = new Map();
    let frames = 0;
    for (const subject of spriteCatalog) for (const clip of subject.clips) {
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
  await context.close();
  return result;
}
