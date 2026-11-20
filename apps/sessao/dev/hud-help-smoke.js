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
    const portrait = page.locator('#hud-portrait');
    const portraitBounds = await portrait.boundingBox();
    if (!portraitBounds || portraitBounds.width<40 || portraitBounds.height<40) {
      throw Error('Retrato do jogador sem área visível: '+JSON.stringify(portraitBounds));
    }
    await portrait.hover();
    await tooltip.filter({hasText:'Retrato do personagem que você escolheu.'}).waitFor();
    await page.mouse.click(width-1,height-1);
    await tooltip.waitFor({state:'hidden'});
    const electionHeading = page.locator('.election-heading');
    if (await electionHeading.count()) {
      const label = await electionHeading.locator(':scope > span').first().boundingBox();
      const clock = await page.locator('.election-clock').boundingBox();
      if (label && clock && (clock.x<label.x+label.width || clock.x-label.x-label.width>12)) {
        throw Error('Relógio eleitoral deve ficar logo à direita do título');
      }
    }
    await page.locator('#congress-dock .congress-payroll').waitFor();
    await page.getByRole('button',{name:'Folha salarial',exact:true}).hover();
    await tooltip.filter({hasText:'Folha salarial: valor total'}).waitFor();
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
  const wallet = page.locator('#profile-resources [data-help]').last();
  await wallet.hover();
  await tooltip.filter({hasText:'Dinheiro disponível na sua carteira.'}).waitFor();
  await wallet.click();
  await page.keyboard.press('Escape');
  await tooltip.waitFor({state:'hidden'});

  const apps = page.getByRole('button',{name:'Aplicativos',exact:true});
  await apps.dispatchEvent('pointerdown',{pointerType:'touch'});
  await tooltip.filter({hasText:'Abra a lista de aplicativos.'}).waitFor();
  await apps.dispatchEvent('pointerup',{pointerType:'touch'});
  await apps.dispatchEvent('click',{detail:1});
  if (await apps.getAttribute('aria-expanded')!=='false') throw Error('Pressionar para ver ajuda abriu os aplicativos');
  await apps.click();
  await page.getByRole('button',{name:'Configurações',exact:true}).last().waitFor();
  return {sizes:2,hover:true,pin:true,keyboard:true,touchHold:true};
}
