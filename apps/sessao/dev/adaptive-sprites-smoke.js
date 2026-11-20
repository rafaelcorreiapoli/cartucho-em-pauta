async (page) => {
  const base = page.url();
  const browser = page.context().browser();
  const context = await browser.newContext({viewport: {width: 1280, height: 800}});
  const qaPage = await context.newPage();
  const requested = [];
  qaPage.on('request', request => { if (/tiririca-walk-(256|512)/.test(request.url())) requested.push(request.url()); });
  await qaPage.goto(new URL('/dev/world-rendering-qa.html', base).href);
  await qaPage.waitForFunction(() => window.qa?.ready);
  async function render(zoom, extra = {}) {
    return qaPage.evaluate(({zoom, extra}) => {
      const qa = window.qa;
      qa.scene.cameras.main.setZoom(zoom);
      const person = {...qa.frame.people[0], character: 3, moving: true, ...extra};
      qa.world.render({...qa.frame, people: [person]}, 0, true);
      const sprite = qa.scene.children.getChildren().find(child => child.type === 'Sprite' && child.x === person.x && child.y === person.y);
      const bag = qa.scene.children.getChildren().find(child => child.texture?.key === 'cash-briefcase' && child.visible && child.depth === sprite.depth + .1);
      return {key: sprite.texture.key, width: sprite.displayWidth, height: sprite.displayHeight, x: sprite.x, y: sprite.y, zoom: qa.scene.cameras.main.zoom, visible: sprite.visible, bag: bag ? [bag.x, bag.y] : null};
    }, {zoom, extra});
  }
  const small = await render(2);
  if (small.key !== 'players-expansion' || requested.length) throw new Error('Small render downloaded a high texture');
  await render(4.65);
  await qaPage.waitForFunction(() => window.qa.scene.textures.exists('tiririca-walk-256'));
  const medium = await render(4.65);
  if (medium.key !== 'tiririca-walk-256' || requested.some(url => url.includes('-512'))) throw new Error('Incorrect 1440p tier');
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  await qaPage.route('**/assets/characters-hd/tiririca-walk-512.webp', async route => { await gate; await route.continue(); });
  const request512 = qaPage.waitForRequest('**/assets/characters-hd/tiririca-walk-512.webp');
  const pending = await render(9.3);
  await request512;
  if (pending.key !== 'tiririca-walk-256') throw new Error('Existing texture disappeared while upgrading');
  for (let i = 0; i < 5; i++) await render(9.3);
  if (requested.filter(url => url.includes('-512')).length !== 1) throw new Error('Repeated in-flight download');
  release();
  await qaPage.waitForFunction(() => window.qa.scene.textures.exists('tiririca-walk-512'));
  const large = await render(9.3);
  if (large.key !== 'tiririca-walk-512') throw new Error('High tier not used after loading');
  for (const sample of [small, medium, large]) {
    if (Math.abs(sample.width - 37.76) > 1e-8 || Math.abs(sample.height - 37.76) > 1e-8) throw new Error('Actor world size changed');
    if (sample.x !== small.x || sample.y !== small.y || JSON.stringify(sample.bag) !== JSON.stringify(small.bag)) throw new Error('Actor or briefcase moved on resolution change');
  }
  if (large.zoom !== 9.3) throw new Error('Adaptive texture modified the camera');
  if ((await render(2)).key !== 'players-expansion') throw new Error('Small viewport did not return to original texture');
  await render(9.3, {moving: false, phone: 'open'});
  await qaPage.waitForFunction(() => window.qa.scene.textures.exists('tiririca-phone-512'));
  if ((await render(9.3, {moving: false, phone: 'open'})).key !== 'tiririca-phone-512') throw new Error('Phone did not upgrade');
  for (let character = 0; character < 8; character++) {
    await render(9.3, {character});
    await qaPage.waitForFunction(() => !window.qa.scene.load.isLoading());
    if (!(await render(9.3, {character})).key.endsWith('-walk-512')) throw new Error(`Character ${character} did not upgrade`);
  }
  await context.close();

  async function gameCase(width, height, density, expected, missing = false) {
    const context = await browser.newContext({viewport: {width, height}, deviceScaleFactor: density});
    try {
      const game = await context.newPage();
      const files = [];
      game.on('request', request => { if (/tiririca-walk-(256|512)/.test(request.url())) files.push(request.url()); });
      await game.addInitScript(() => localStorage.setItem('cartuchao.sessao.audio', JSON.stringify({muted: true})));
      if (missing) await game.route('**/assets/characters-hd/tiririca-walk-256.webp', route => route.fulfill({status: 404, body: 'QA missing optional texture'}));
      await game.goto(new URL('/', base).href);
      await game.getByRole('textbox', {name: 'Seu nick'}).fill(`Textura ${width} ${density}`);
      await game.getByRole('button', {name: 'Criar sala', exact: true}).click();
      await game.locator('#characters button').filter({hasText: 'Tiririca'}).click();
      await game.getByRole('button', {name: 'Configurar partida', exact: true}).click();
      await game.getByRole('button', {name: 'Voltar ao lobby', exact: true}).click();
      await game.getByRole('button', {name: 'Iniciar sessão', exact: true}).click();
      await game.locator('#session[data-phase="negotiation"]').waitFor();
      await game.locator('#asset-loading').waitFor({state: 'hidden'});
      if (expected && !files.some(file => file.includes(`-${expected}`))) await game.waitForRequest(`**/assets/characters-hd/tiririca-walk-${expected}.webp`);
      await game.waitForTimeout(600);
      if (!expected && files.length) throw new Error(`Small screen downloaded high sprites: ${files}`);
      if (expected && files.some(file => !file.includes(`-${expected}`))) throw new Error(`Downloaded an unneeded tier: ${files}`);
      if (missing && files.length !== 1) throw new Error('Failed optional texture was retried every frame');
      if (await game.locator('#asset-loading').isVisible()) throw new Error('Optional texture failure reopened bootstrap loader');
      await game.screenshot({path: `/tmp/adaptive-game-${width}-${density}${missing ? '-missing' : ''}.png`});
      return {width, height, density, requestedTier: expected || 128, optionalFailure: missing};
    } finally { await context.close(); }
  }
  const games = [];
  games.push(await gameCase(2560, 1440, 1, 256));
  games.push(await gameCase(390, 844, 1, null));
  games.push(await gameCase(2560, 1440, 2, 512));
  games.push(await gameCase(2560, 1440, 1, 256, true));
  return {engine: {small: small.key, medium: medium.key, large: large.key, worldSize: large.width, bag: large.bag}, games};
}
