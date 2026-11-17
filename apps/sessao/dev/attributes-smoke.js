async page => {
  await page.addInitScript(()=>{
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
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Atributos QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.locator('#parliamentarian-count [data-count="0"]').click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  const levelUp = page.locator('#level-up-dialog[open]');
  const allocate = levelUp.getByRole('button',{name:'Distribuir ponto'});
  await allocate.waitFor();
  await allocate.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
  await page.keyboard.press('1');
  const attributes = page.locator('#attributes-dialog[open]');
  await attributes.getByText('2 pontos para distribuir').waitFor();
  const stamina = attributes.getByRole('button',{name:'Investir em Fôlego'});
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
  await page.keyboard.press('2');
  if (await stamina.getAttribute('aria-pressed')!=='true') throw Error('A tecla 2 não selecionou Fôlego.');
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
  return {viewport:'1024×600',stamina:'150/150',remainingPoints:1,countdownBlocked:true};
}
