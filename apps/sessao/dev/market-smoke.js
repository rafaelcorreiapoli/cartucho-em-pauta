async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new DOMException('QA sem microfone','NotAllowedError'); };
  });
  await page.reload();
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Mercado QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.getByRole('button',{name:/Abrir loja.*Doutor Gambiarra/}).waitFor();
  const canvas = await page.locator('#map canvas').boundingBox();
  await page.mouse.click(canvas.x+canvas.width/2,canvas.y+canvas.height/2-55);
  const dialog = page.locator('#market-dialog');
  const slots = dialog.locator('.market-products > *');
  const detail = dialog.getByRole('region',{name:'Produto selecionado'});
  await detail.waitFor();
  await dialog.locator('.market-vendor img').evaluate(image=>image.decode());
  if (!await dialog.getByText('Doutor Gambiarra',{exact:true}).isVisible()) throw Error('Vendor name');
  if (await slots.count()!==9) throw Error('Unexpected slot count');
  const bounds = async ()=>JSON.stringify(await Promise.all([dialog.boundingBox(),detail.boundingBox(),dialog.locator('.market-paging').boundingBox()]));
  await dialog.locator(".market-buy").waitFor();
  const initial = await bounds();
  await page.keyboard.press('ArrowRight');
  if (await slots.count()!==9 || await bounds()!==initial) throw Error('Pagination moved catalog');
  await page.keyboard.press('ArrowLeft');
  const binoculars = dialog.getByRole('button',{name:/^Binóculo ·/});
  await page.keyboard.press(await binoculars.getAttribute('aria-keyshortcuts'));
  await detail.getByRole('heading',{name:'Binóculo',exact:true}).waitFor();
  if (await bounds()!==initial) throw Error('Selection moved catalog');
  await page.keyboard.press('Enter');
  const equip = page.locator('#equip-purchase-dialog');
  const acquired = detail.getByRole('button',{name:'Adquirido'});
  await acquired.waitFor();
  if (!await acquired.isDisabled() || await equip.isVisible()) throw Error('Free equipment slot should not prompt');
  for (const name of ['Colete','Modulador de voz']) {
    const product = dialog.getByRole('button',{name:new RegExp('^'+name+' ·','i')});
    if (!await product.count()) await page.keyboard.press('ArrowRight');
    await product.click();
    await dialog.locator('.market-buy').click();
    if (name==='Colete') await acquired.waitFor();
  }
  await equip.getByText(/Binóculo.*Modulador/i).waitFor();
  const keep = equip.getByRole('button',{name:'Não',exact:true});
  if (!await keep.evaluate(button=>button===document.activeElement)) throw Error('A opção segura deve receber foco');
  if (await keep.getAttribute('aria-keyshortcuts')!=='2') throw Error('Atalho de recusa ausente');
  await page.keyboard.press('1');
  await equip.waitFor({state:'hidden'});
  await page.keyboard.press('Escape');
  await page.locator('#equipped-gear').locator('[aria-label*="Modulador" i]').waitFor();
  await page.getByRole('button',{name:/Abrir loja.*Doutor Gambiarra/}).click();
  await detail.waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
}
