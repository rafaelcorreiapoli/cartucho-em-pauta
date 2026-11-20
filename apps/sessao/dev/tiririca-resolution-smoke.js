async (page) => {
  const requested = [];
  const errors = [];
  page.on('request', request => { if (request.url().includes('tiririca-walk-')) requested.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({width: 2560, height: 1440});
  await page.goto('http://localhost:5197/tiririca-resolution.html');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Direita: 256 px'));
  if (requested.some(url => url.includes('-512'))) throw new Error('Unselected 512 texture was fetched');
  await page.selectOption('#tier', '512');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Direita: 512 px'));
  await page.selectOption('#direction', '2');
  await page.click('#motion');
  await page.screenshot({path: '/tmp/tiririca-resolution-1440p.png'});
  await page.selectOption('#tier', 'auto');
  await page.locator('#size').fill('64');
  await page.waitForFunction(() => document.querySelector('#status').textContent.includes('Direita: 128 px'));
  await page.setViewportSize({width: 390, height: 844});
  await page.screenshot({path: '/tmp/tiririca-resolution-mobile.png'});
  if (errors.length) throw new Error(errors.join('\n'));
  console.log(JSON.stringify({requested, errors}));
}
