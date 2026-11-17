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
  await levelUp.getByRole('button',{name:'Depois'}).click({timeout:1500}).catch(async error=>{
    if (await levelUp.count()) throw error;
  });
  await page.keyboard.press('p');
  const attributes = page.locator('#attributes-dialog[open]');
  await attributes.getByText('2 pontos para distribuir').waitFor();
  const stamina = attributes.getByRole('button',{name:'Investir em Fôlego'});
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
