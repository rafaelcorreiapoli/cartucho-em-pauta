async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new Error('QA sem microfone'); };
  });
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Ajuda QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  const stability = page.getByRole('button',{name:'Como funciona a estabilidade'});
  const budget = page.getByRole('button',{name:/Orçamento Público/});
  const tooltip = page.getByRole('tooltip');
  for (const [width,height] of [[1280,720],[800,600]]) {
    await page.setViewportSize({width,height});
    await stability.hover();
    await tooltip.filter({hasText:'Parlamento entra em colapso'}).waitFor();
    const bounds = await tooltip.boundingBox();
    if (!bounds || bounds.x<7 || bounds.y<7 || bounds.x+bounds.width>width-7 || bounds.y+bounds.height>height-7) {
      throw Error('Popover fora da área segura: '+JSON.stringify(bounds));
    }
    await stability.click();
    await page.mouse.move(width-1,height-1);
    if (!await tooltip.isVisible()) throw Error('Clique não fixou a ajuda');
    await page.keyboard.press('Escape');
    await tooltip.waitFor({state:'hidden'});
    await budget.focus();
    await tooltip.filter({hasText:'Depósitos na Tesouraria abatem a dívida'}).waitFor();
    if (await budget.getAttribute('aria-describedby')!==await tooltip.getAttribute('id')) throw Error('Descrição não vinculada ao botão');
    await page.mouse.click(width-1,height-1);
    await tooltip.waitFor({state:'hidden'});
  }
  return {sizes:2,hover:true,pin:true,keyboard:true};
}
