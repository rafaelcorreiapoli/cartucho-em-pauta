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
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Mercado QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.getByRole('button',{name:/Abrir loja.*Doutor Gambiarra/}).click();
  const dialog = page.locator('#market-dialog');
  const slots = dialog.locator('.market-products > *');
  const detail = dialog.getByRole('region',{name:'Produto selecionado'});
  await detail.waitFor();
  await dialog.locator('.market-vendor img').evaluate(image=>image.decode());
  if (!await dialog.getByText('Doutor Gambiarra',{exact:true}).isVisible()) throw Error('Vendor name');
  if (await slots.count()!==9) throw Error('Unexpected slot count');
  const bounds = async ()=>JSON.stringify(await Promise.all([dialog.boundingBox(),detail.boundingBox(),dialog.locator('.market-paging').boundingBox()]));
  await dialog.locator(".market-buy").waitFor();
  for (const size of [{width:1024,height:600},{width:1280,height:720}]) {
    await page.setViewportSize(size);
    const before = await bounds();
    await page.keyboard.press('ArrowRight');
    await dialog.getByRole('button',{name:'Página 2',exact:true}).waitFor();
    if (await dialog.getByRole('button',{name:'Página 2',exact:true}).getAttribute('aria-current')!=='page') {
      throw Error('Right arrow did not open the second page');
    }
    if (await slots.count()!==9 || await bounds()!==before) throw Error('Pagination moved catalog');
    await page.keyboard.press('ArrowLeft');
  }
  const initial = await bounds();
  const binoculars = dialog.getByRole('button',{name:/^Binóculo ·/});
  await page.keyboard.press(await binoculars.getAttribute('aria-keyshortcuts'));
  await detail.getByRole('heading',{name:'Binóculo',exact:true}).waitFor();
  if (await bounds()!==initial) throw Error('Selection moved catalog');
  await page.keyboard.press('Enter');
  const equip = page.locator('#equip-purchase-dialog');
  const acquired = detail.getByRole('button',{name:'Adquirido'});
  await acquired.waitFor();
  if (!await acquired.isDisabled() || await equip.isVisible()) throw Error('Free equipment slot should not prompt');
  for (const name of ['Modulador de voz','Megafone']) {
    const product = dialog.getByRole('button',{name:new RegExp('^'+name+' ·','i')});
    if (!await product.count()) await page.keyboard.press('ArrowRight');
    await product.click();
    await dialog.locator('.market-buy').click();
    if (name==='Modulador de voz') await acquired.waitFor();
  }
  await equip.getByText(/Binóculo.*Megafone/i).waitFor();
  const keep = equip.getByRole('button',{name:'Não',exact:true});
  if (!await keep.evaluate(button=>button===document.activeElement)) throw Error('A opção segura deve receber foco');
  if (await keep.getAttribute('aria-keyshortcuts')!=='2') throw Error('Atalho de recusa ausente');
  await page.keyboard.press('1');
  await equip.waitFor({state:'hidden'});
  await page.keyboard.press('Escape');
  await page.locator('#equipped-gear').locator('[aria-label*="Megafone" i]').waitFor();
  await page.getByRole('button',{name:/Abrir loja.*Doutor Gambiarra/}).click();
  await detail.waitFor();
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  await page.getByRole('button',{name:/Abrir loja.*Doutor Gambiarra/}).click();
  await detail.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('A loja tentou acessar o microfone');
}
