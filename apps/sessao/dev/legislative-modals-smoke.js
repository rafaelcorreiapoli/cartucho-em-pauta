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
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Modais QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  const grant = page.getByRole('button',{name:/^Aplicar verba$/});
  await grant.waitFor();
  const dossier = page.getByRole('dialog',{name:'Dossiê'});
  const institution = page.getByRole('dialog',{name:'Ações institucionais'});
  const centered = async (dialog,width,height)=>{
    await dialog.waitFor();
    const box = await dialog.boundingBox();
    if (!box || Math.abs(box.x+box.width/2-width/2)>2 || Math.abs(box.y+box.height/2-height/2)>2) {
      throw Error('Modal fora do centro: '+JSON.stringify(box));
    }
  };
  for (const [width,height] of [[1280,720],[1024,600],[800,600]]) {
    await page.setViewportSize({width,height});
    await page.keyboard.press('j');
    await centered(dossier,width,height);
    await page.keyboard.press(width===1024 ? 'j' : 'Escape');
    await dossier.waitFor({state:'hidden'});
    await grant.click();
    await centered(institution,width,height);
    await institution.getByRole('button',{name:'Fechar ações institucionais'}).click();
    await institution.waitFor({state:'hidden'});
  }
  await grant.click();
  await institution.getByRole('button',{name:'Desviar R$ 30 mil'}).click();
  await institution.getByRole('button',{name:/Aplicar verba de/}).click();
  await institution.waitFor({state:'hidden'});
  await grant.waitFor({state:'hidden'});
  await page.locator('#profile-dock').getByText('R$ 110 mil',{exact:true}).waitFor();
  await page.keyboard.press('j');
  await dossier.waitFor();
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await dossier.waitFor({state:'hidden'});
  await page.keyboard.press('j');
  if (await dossier.isVisible()) throw Error('Dossiê abriu durante a votação');
  if (await page.locator('#social-docks, #politics-dock, #institutional-dock').count()) throw Error('Contêiner legado ainda existe');
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');
}
