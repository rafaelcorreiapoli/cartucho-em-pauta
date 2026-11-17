async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new Error('QA sem microfone'); };
  });
  await page.reload();

  const asset = '**/assets/maleta-social.png';
  let failAsset;
  const delayedFailure = new Promise(resolve=>{ failAsset = resolve; });
  await page.route(asset,async route=>{
    await delayedFailure;
    await route.fulfill({status:404,body:'Asset missing'});
  });
  const create = page.getByRole('button',{name:'Criar sala'});
  const loader = page.locator('#asset-loading');
  const progress = loader.getByRole('progressbar',{name:'Progresso do carregamento'});
  try {
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Carregamento QA');
    await create.click();
    await progress.waitFor();
    if (await progress.evaluate(bar=>bar.value>=bar.max)) throw new Error('Carga terminou sem a maleta');
  } finally {
    failAsset();
  }
  await loader.getByRole('status').filter({hasText:'Falha ao carregar o cenário'}).waitFor();
  await loader.getByRole('button',{name:'Voltar'}).click();
  await create.waitFor();
  await page.locator('#connection').filter({hasText:'Você saiu da sala'}).waitFor();

  await page.unroute(asset);
  await create.click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  await loader.waitFor({state:'hidden'});
  return {recovered:true,startedMatch:true};
}
