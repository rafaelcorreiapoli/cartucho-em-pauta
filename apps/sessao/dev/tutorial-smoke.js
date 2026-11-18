async page => {
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
  await panel.getByRole('button',{name:'Continuar',exact:true}).click();
  await panel.getByRole('heading',{name:'Caminhe pelo Congresso'}).waitFor();
  if (await panel.getByRole('button',{name:'Continuar',exact:true}).count()) throw Error('Etapa prática permite avançar sem executar');
  await panel.getByRole('combobox').selectOption('4');
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
    const bounds = await panel.boundingBox();
    if (!bounds || bounds.x<0 || bounds.y<0 || bounds.x+bounds.width>width || bounds.y+bounds.height>height) throw Error('Tutorial fora da tela');
    await page.screenshot({path:'/tmp/tutorial-'+width+'.png'});
  }
  await panel.getByRole('button',{name:'Sair do treino',exact:true}).click();
  await page.getByRole('button',{name:'Aprender a jogar',exact:true}).waitFor();
  return {entry:true,chapters:options,practiceGated:true,restart:true,exit:true};
}
