async page => {
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Histórico QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const npcs = page.locator('#parliamentarian-count [data-count="0"]');
  await npcs.click();
  await page.waitForFunction(()=>document.querySelector('#parliamentarian-count [data-count="0"]')?.getAttribute('aria-pressed')==='true');
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await page.locator('[data-vote="yes"]').click();
  await page.locator('#vote-state').getByText('Seu voto: aprovar').waitFor();
  await page.locator('#session[data-phase="negotiation"]').waitFor({timeout:20000});
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await page.locator('#session[data-phase="negotiation"]').waitFor({timeout:20000});
  await page.locator('#session[data-phase="ballot"]').waitFor();
  const history = page.locator('#vote-history');
  await history.locator('summary').click();
  const pages = history.locator('#vote-pages');
  if (await pages.getAttribute('aria-label')!=='Votação 2 de 2') throw Error('Latest ballot was not selected');
  if (await history.locator('#outcome-bill').textContent()!=='Wi-Fi na Praça') throw Error('Wrong latest project');
  await history.getByRole('button',{name:'Votação anterior'}).click();
  if (await pages.getAttribute('aria-label')!=='Votação 1 de 2') throw Error('Previous arrow did not update page');
  if (await history.locator('#outcome-bill').textContent()!=='Auxílio Churrasco') throw Error('Wrong previous project');
  if (!await history.getByRole('button',{name:'Votação anterior'}).isDisabled()) throw Error('Previous arrow exceeded bounds');
  await history.getByRole('button',{name:'Próxima votação'}).click();
  if (!await history.getByRole('button',{name:'Próxima votação'}).isDisabled()) throw Error('Next arrow exceeded bounds');
}
