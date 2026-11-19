async page => {
  await page.setViewportSize({width:1280,height:720});
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{throw Error('Treino sem microfone');};
  });
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Aprendiz QA');
  await page.getByRole('button',{name:'Aprender a jogar',exact:true}).click();
  await page.getByRole('button',{name:'Iniciar tutorial',exact:true}).click();
  const panel = page.getByRole('complementary',{name:'Tutorial',exact:true});
  await panel.getByRole('heading',{name:'Conheça seu HUD'}).waitFor();
  const spotlight = page.locator('.tutorial-spotlight');
  const worldSteps = new Set(['Use o equipamento','Caminhe pelo Congresso','Beba um café','Faça uma entrega pública','Guarde dinheiro no gabinete','Ofereça um café','Consiga uma assinatura','Instale uma câmera','Apague o incêndio','Repare a energia']);
  async function checkWorldLighting() {
    if (worldSteps.has(await panel.getByRole('heading').textContent())) await spotlight.waitFor({state:'hidden'});
  }
  await spotlight.waitFor();
  if (await panel.getByRole('combobox').count()) throw Error('Tutorial ainda usa select');
  if (!await panel.getByRole('button',{name:'Etapa anterior',exact:true}).isDisabled()) throw Error('Primeira etapa permite voltar');
  const hint = panel.locator('summary');
  if (await hint.evaluate(node=>getComputedStyle(node).cursor)!=='pointer') throw Error('Dica sem cursor clicável');
  await hint.click();
  await panel.getByText('Leia os indicadores e use a seta à direita para avançar.',{exact:true}).waitFor();
  await page.waitForFunction(()=>{
    const vitals = document.querySelector('#profile-vitals').getBoundingClientRect();
    return [...document.querySelectorAll('[data-spotlight-opening]')].some(node=>{
      const x=+node.getAttribute('x'),y=+node.getAttribute('y');
      return x<=vitals.x && y<=vitals.y && x+(+node.getAttribute('width'))>=vitals.right && y+(+node.getAttribute('height'))>=vitals.bottom;
    });
  });
  if (await spotlight.evaluate(node=>getComputedStyle(node).pointerEvents)!=='none') throw Error('Foco bloqueia interação');
  const pulse = spotlight.locator('.tutorial-focus-pulse').first();
  if (await pulse.evaluate(node=>getComputedStyle(node).animationName)!=='tutorial-focus-pulse') throw Error('Foco sem pulso de atenção');
  await page.emulateMedia({reducedMotion:'reduce'});
  if (await pulse.evaluate(node=>getComputedStyle(node).animationName)!=='none') throw Error('Foco ignora movimento reduzido');
  if (await spotlight.locator('.tutorial-focus-border').first().evaluate(node=>getComputedStyle(node).strokeOpacity)!=='0.8') throw Error('Foco estático invisível com movimento reduzido');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.locator('#profile-vitals [data-tone="xp"]').first().hover();
  const tooltip = page.getByRole('tooltip').filter({hasText:'Experiência acumulada até o próximo nível.'});
  await tooltip.waitFor();
  const tooltipLayer = await tooltip.evaluate(node=>Number(getComputedStyle(node).zIndex));
  const dimLayer = await spotlight.evaluate(node=>Number(getComputedStyle(node).zIndex));
  if (tooltipLayer<=dimLayer) throw Error('Popover está por baixo do dimmer');
  await page.screenshot({path:'/tmp/tutorial-focus-popover.png'});
  await page.mouse.move(600,400);
  await page.screenshot({path:'/tmp/tutorial-focus-desktop.png'});
  await panel.getByRole('button',{name:'Recolher tutorial',exact:true}).click();
  if (await panel.getByRole('heading',{name:'Conheça seu HUD'}).isVisible()) throw Error('Tutorial não recolheu');
  await spotlight.waitFor({state:'hidden'});
  await panel.getByRole('button',{name:'Expandir tutorial',exact:true}).click();
  await spotlight.waitFor();
  const beforeMove = await panel.boundingBox();
  await panel.getByRole('button',{name:'Mover tutorial',exact:true}).focus();
  await page.keyboard.press('ArrowLeft');
  const afterMove = await panel.boundingBox();
  if (afterMove.x>=beforeMove.x) throw Error('Tutorial não se moveu');
  await page.getByRole('button',{name:'Aplicativos',exact:true}).click();
  const appButtons = page.locator('#congress-app-panel button');
  for (const button of await appButtons.all()) {
    const box = await button.boundingBox();
    if (box && box.x<afterMove.x+afterMove.width && box.x+box.width>afterMove.x && box.y<afterMove.y+afterMove.height && box.y+box.height>afterMove.y) throw Error('Tutorial cobre aplicativo');
  }
  await page.getByRole('button',{name:'Aplicativos',exact:true}).click();
  await page.keyboard.press('l');
  await page.getByRole('dialog',{name:'Pesquisa Eleitoral',exact:true}).waitFor();
  await page.keyboard.press('l');
  await page.getByRole('dialog',{name:'Pesquisa Eleitoral',exact:true}).waitFor({state:'hidden'});
  await panel.getByRole('button',{name:'Próxima etapa',exact:true}).click();
  await panel.getByRole('heading',{name:'Caminhe pelo Congresso'}).waitFor();
  await spotlight.waitFor({state:'hidden'});
  for (const key of ['mouse','WASD','setas do teclado','Shift']) {
    await panel.locator('[role="status"] strong').filter({hasText:key}).waitFor();
  }
  await panel.getByRole('button',{name:'Etapa anterior',exact:true}).click();
  await panel.getByRole('heading',{name:'Conheça seu HUD'}).waitFor();
  await spotlight.waitFor();
  for (let i=0;i<3;i++) {
    const current = await panel.locator('.tutorial-progress').textContent();
    await panel.getByRole('button',{name:'Próxima etapa',exact:true}).click();
    await page.waitForFunction(previous=>document.querySelector('.tutorial-progress')?.textContent!==previous,current);
    await checkWorldLighting();
  }
  await panel.getByRole('heading',{name:'Equipe um acessório'}).waitFor();
  await page.getByRole('button',{name:'Mochila',exact:true}).click();
  const bag = page.getByRole('dialog',{name:'Inventário',exact:true});
  await bag.getByRole('button',{name:'Binóculo',exact:true}).click();
  await bag.getByRole('button',{name:'Equipar',exact:true}).click();
  await page.keyboard.press('Escape');
  await panel.getByRole('heading',{name:'Use o equipamento'}).waitFor();
  await spotlight.waitFor({state:'hidden'});
  await page.keyboard.press('b');
  await panel.getByRole('heading',{name:'Entenda suas missões'}).waitFor();
  await spotlight.waitFor({state:'hidden'});
  await spotlight.waitFor({state:'visible',timeout:15000});
  const options = Number((await panel.locator('.tutorial-progress').textContent()).split('/')[1]);
  for (let i=5;i<options-1;i++) {
    const current = await panel.locator('.tutorial-progress').textContent();
    await panel.getByRole('button',{name:'Próxima etapa',exact:true}).click();
    await page.waitForFunction(previous=>document.querySelector('.tutorial-progress')?.textContent!==previous,current);
    await checkWorldLighting();
  }
  await panel.getByRole('heading',{name:'Repare a energia'}).waitFor();
  await panel.getByRole('button',{name:'Próxima etapa',exact:true}).click();
  await panel.getByRole('heading',{name:'Treino concluído'}).waitFor();
  await panel.getByRole('button',{name:'Recomeçar treino',exact:true}).click();
  await panel.getByRole('heading',{name:'Conheça seu HUD'}).waitFor();
  for (const [width,height] of [[1280,720],[390,844]]) {
    await page.setViewportSize({width,height});
    await page.waitForFunction(()=>{
      const bounds = document.querySelector('.tutorial-panel').getBoundingClientRect();
      return bounds.x>=0 && bounds.y>=0 && bounds.right<=innerWidth && bounds.bottom<=innerHeight;
    });
    const bounds = await panel.boundingBox();
    if (!bounds || bounds.x<0 || bounds.y<0 || bounds.x+bounds.width>width || bounds.y+bounds.height>height) throw Error('Tutorial fora da tela');
    await page.screenshot({path:'/tmp/tutorial-'+width+'.png'});
  }
  await panel.getByRole('button',{name:'Sair do treino',exact:true}).click();
  await page.getByRole('button',{name:'Aprender a jogar',exact:true}).waitFor();
  return {entry:true,chapters:options,navigation:true,restart:true,exit:true};
}
