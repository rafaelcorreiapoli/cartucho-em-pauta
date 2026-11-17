async page => {
  const gameUrl = page.url();
  await page.context().addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      throw new DOMException('Teste sem microfone','NotAllowedError');
    };
  });
  await page.setViewportSize({width:1024,height:600});
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  async function start(client,nick) {
    await client.getByRole('textbox',{name:'Seu nick'}).fill(nick);
    await client.getByRole('button',{name:'Criar sala'}).click();
    await client.locator('#parliamentarian-count [data-count="0"]').click();
    await client.getByRole('button',{name:'Iniciar sessão'}).click();
    await client.locator('#session[data-phase="negotiation"]').waitFor();
  }
  await start(page,'Atributos QA');
  const levelUp = page.locator('#level-up-dialog[open]');
  const allocate = levelUp.getByRole('button',{name:'Distribuir ponto'});
  await allocate.waitFor();
  await allocate.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
  await page.keyboard.press('1');
  const attributes = page.locator('#attributes-dialog[open]');
  await attributes.getByText('2 pontos para distribuir').waitFor();
  const stamina = attributes.locator('[data-attribute=stamina] button');
  for (const [button,label] of [[stamina,'+1'],[attributes.getByRole('button',{name:'Confirmar +1'}),'Confirmar +1']]) {
    const bounds = await button.boundingBox();
    const badge = await button.locator('kbd').boundingBox();
    const text = await button.getByText(label,{exact:true}).boundingBox();
    if (!bounds || !badge || !text || badge.x+badge.width/2<bounds.x+bounds.width-8 ||
        badge.y+badge.height/2>bounds.y+8 ||
        Math.abs(text.x+text.width/2-(bounds.x+bounds.width/2))>1 ||
        Math.abs(text.y+text.height/2-(bounds.y+bounds.height/2))>1) {
      throw Error('Badge de atalho deslocou o rótulo ou saiu do canto superior direito.');
    }
  }
  await attributes.locator('button[aria-keyshortcuts]').evaluateAll(buttons=>{
    for (const button of buttons) button.removeAttribute('aria-keyshortcuts');
  });
  await stamina.evaluate(button=>button.removeAttribute('aria-label'));
  await page.keyboard.press('F2');
  const palette = page.getByRole('dialog',{name:'Atalhos de teclado'});
  const paletteChoice = palette.getByRole('button',{name:'Investir em Fôlego',exact:true});
  await paletteChoice.waitFor();
  await page.keyboard.press(await paletteChoice.getAttribute('aria-keyshortcuts'));
  await palette.waitFor({state:'hidden'});
  if (await stamina.getAttribute('aria-pressed')!=='true') throw Error('O F2 não selecionou Fôlego sem consultar o botão original.');
  await attributes.getByText('100/100 → 150/150',{exact:true}).waitFor();
  await page.keyboard.press('3');
  await attributes.getByText('1 ponto para distribuir').waitFor();
  await attributes.getByText('150/150',{exact:true}).waitFor();

  await page.locator('#ballot-countdown[open]').waitFor();
  if (await stamina.isEnabled()) throw Error('É possível escolher um atributo durante a contagem.');
  await page.keyboard.press('2');
  await page.keyboard.press('3');
  await attributes.getByText('1 ponto para distribuir').waitFor();
  await attributes.getByText('150/150',{exact:true}).waitFor();
  if (await stamina.getAttribute('aria-pressed')!=='false') throw Error('O atalho armou investimento durante a contagem.');
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O jogo solicitou o microfone.');
  const deferred = await page.context().newPage();
  try {
    await deferred.emulateMedia({reducedMotion:'reduce'});
    await deferred.goto(gameUrl);
    await start(deferred,'Adiar QA');
    const celebration = deferred.locator('#level-up-dialog');
    const later = celebration.getByRole('button',{name:'Depois'});
    await later.waitFor();
    await later.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
    await deferred.keyboard.press('2');
    await celebration.waitFor({state:'hidden'});
    const sheet = deferred.locator('#attributes-dialog');
    if (await sheet.isVisible()) throw Error('Adiar abriu a ficha de atributos.');
    await deferred.keyboard.press('p');
    await sheet.getByText('2 pontos para distribuir').waitFor();
    await sheet.getByText('100/100',{exact:true}).waitFor();
    if (await deferred.evaluate(()=>window.micAttempts)!==0) throw Error('O jogo solicitou o microfone.');
  } finally {
    await deferred.close();
  }
  return {viewport:'1024×600',stamina:'150/150',remainingPoints:1,countdownBlocked:true,deferredPoints:2};
}
