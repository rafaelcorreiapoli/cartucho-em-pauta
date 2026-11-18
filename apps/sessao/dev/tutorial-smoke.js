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
  const outline = await page.locator('#profile-vitals').evaluate(node=>getComputedStyle(node).outlineStyle);
  if (outline!=='solid') throw Error('Indicadores do HUD sem destaque');
  await panel.getByRole('button',{name:'Recolher',exact:true}).click();
  if (await panel.getByRole('combobox').isVisible()) throw Error('Tutorial não recolheu');
  await panel.getByRole('button',{name:'Expandir',exact:true}).click();
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
  await panel.getByRole('button',{name:'Continuar',exact:true}).click();
  await panel.getByRole('heading',{name:'Caminhe pelo Congresso'}).waitFor();
  if (await panel.getByRole('button',{name:'Continuar',exact:true}).count()) throw Error('Etapa prática permite avançar sem executar');
  await panel.getByRole('combobox').selectOption('3');
  await panel.getByRole('heading',{name:'Equipe um acessório'}).waitFor();
  await page.getByRole('button',{name:'Mochila',exact:true}).click();
  await page.getByRole('dialog').filter({visible:true}).waitFor();
  await page.keyboard.press('Escape');
  const options = await panel.getByRole('combobox').locator('option').count();
  await panel.getByRole('combobox').selectOption(String(options-1));
  await panel.getByRole('heading',{name:'Repare a energia'}).waitFor();
  await panel.getByRole('button',{name:'Pular etapa',exact:true}).click();
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
  return {entry:true,chapters:options,practiceGated:true,restart:true,exit:true};
}
