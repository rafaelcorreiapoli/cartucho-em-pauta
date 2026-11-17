async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      throw new DOMException('QA sem microfone','NotAllowedError');
    };
  });
  await page.reload();
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Contexto QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.locator('#parliamentarian-count [data-count="3"]').click();
  await page.locator('#parliamentarian-count [data-count="3"][aria-pressed="true"]').waitFor();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  const more = page.getByRole('button',{name:'Mais ações'});
  await more.waitFor();
  const ordinary = page.locator('#stations [data-context-overflow="false"]');
  const keys = ()=>ordinary.evaluateAll(elements=>elements.map(el=>el.getAttribute('aria-keyshortcuts')));
  const initialKeys = JSON.stringify(await keys());
  if (initialKeys!==JSON.stringify(['1','2','3'])) throw Error('As ações principais perderam seus atalhos');
  const overflow = page.locator('#stations [data-context-overflow="expanded"]');
  const moreKey = await more.getAttribute('aria-keyshortcuts');
  if (moreKey!=='4') throw Error('Mais ações deve usar o quarto atalho');
  const badge = button=>button.evaluate(element=>getComputedStyle(element,'::after').content);
  if (!(await badge(more)).includes('"4"') || !(await badge(ordinary.first())).includes('"1"')) {
    throw Error('Os badges não acompanham os atalhos acessíveis');
  }
  const baseRow = await more.boundingBox();
  await page.keyboard.press(moreKey);
  await overflow.first().waitFor();
  if (JSON.stringify(await keys())!==initialKeys) throw Error('Expandir mudou os atalhos principais');
  const expandedBase = await more.boundingBox();
  const extraRow = await overflow.first().boundingBox();
  if (!baseRow || !expandedBase || !extraRow || Math.abs(expandedBase.y-baseRow.y)>1 ||
      extraRow.y+extraRow.height>expandedBase.y) throw Error('A linha extra não abriu acima da base');


  const nearby = page.getByRole('button',{name:'Objetos próximos'});
  await page.keyboard.press(await nearby.getAttribute('aria-keyshortcuts'));
  const coffee = page.getByRole('button',{name:'Pegar Café',exact:true});
  await coffee.waitFor();
  await coffee.and(page.locator('[aria-keyshortcuts]')).waitFor();
  const coffeeKey = await coffee.getAttribute('aria-keyshortcuts');
  if (!/^[1-9]$/.test(coffeeKey) || !(await badge(coffee)).includes(JSON.stringify(coffeeKey))) {
    throw Error('O item não exibe o atalho do submenu');
  }
  await overflow.first().waitFor({state:'hidden'});
  if (await more.getAttribute('aria-expanded')!=='false') throw Error('Mais ações ficou aberto junto com Objetos próximos');
  await page.keyboard.press('Escape');
  await coffee.waitFor({state:'hidden'});
  await page.keyboard.press(await more.getAttribute('aria-keyshortcuts'));
  await overflow.first().waitFor();
  await page.keyboard.press('Escape');
  await overflow.first().waitFor({state:'hidden'});
  await page.keyboard.press(await more.getAttribute('aria-keyshortcuts'));
  const npc = overflow.filter({hasText:'Conversar ·'}).first();
  await npc.waitFor();
  const name = (await npc.textContent()).trim().match(/^Conversar · (.+)$/)?.[1];
  if (!name) throw Error('Ação de conversa sem nome ou atalho');
  await page.keyboard.press(await npc.getAttribute('aria-keyshortcuts'));
  const deal = page.getByRole('dialog',{name});
  await deal.waitFor();
  await page.keyboard.press('Escape');
  await deal.waitFor({state:'hidden'});
  const legacy = page.locator('#voice-dock, #voice-host, #voice-lobby, #open-action-shortcuts');
  if (await legacy.count()) throw Error('O dock antigo de voz continua montado');
  await page.keyboard.press('k');
  const settings = page.getByRole('dialog',{name:'Configurações'});
  await settings.getByRole('button',{name:'Ativar voz'}).waitFor();
  await page.keyboard.press('F2');
  const shortcuts = page.getByRole('dialog',{name:'Atalhos de teclado'});
  await shortcuts.getByRole('button',{name:'Ativar voz'}).waitFor();
  await page.keyboard.press('F2');
  await shortcuts.waitFor({state:'hidden'});
  await page.keyboard.press('Escape');
  await settings.waitFor({state:'hidden'});
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');
}
