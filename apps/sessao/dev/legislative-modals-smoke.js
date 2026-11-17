async page => {
  await page.context().addInitScript(()=>{
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

  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Projetos QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.getByRole('button',{name:'Secretaria · Falar com Dona Sílvia'}).click();
  await page.getByRole('button',{name:'Solicitar documento'}).click();
  const picker = page.getByRole('dialog',{name:'Solicitar documento'});
  const confirm = picker.getByRole('button',{name:'Confirmar',exact:true});
  for (const [width,height] of [[800,360],[620,360]]) {
    await page.setViewportSize({width,height});
    await centered(picker,width,height);
    const box = await confirm.boundingBox();
    if (!box || box.y+box.height>height || box.x+box.width>width) throw Error('Confirmação fora da tela');
  }
  if (await confirm.isEnabled()) throw Error('Confirmação sem projeto');
  const impactColors = await picker.evaluate(dialog=>Object.fromEntries(['gain','loss'].map(tone=>[
    tone,getComputedStyle(dialog.querySelector(`[data-effect="${tone}"]`)).color,
  ])));
  if (impactColors.gain!=='rgb(168, 231, 150)' || impactColors.loss!=='rgb(255, 154, 139)') {
    throw Error('As cores de impacto do seletor não batem com as da votação');
  }
  await page.keyboard.press('ArrowUp');
  const selected = picker.getByRole('radio',{checked:true});
  await selected.waitFor();
  const title = await picker.locator('.project-picker-detail-content h3').textContent();
  const getScroll = selector=>picker.locator(selector).evaluate(node=>node.scrollTop);
  if (!await getScroll('.project-picker-list')) throw Error('Projeto selecionado fora da área de rolagem');
  await page.keyboard.press('PageDown');
  if (!await getScroll('.project-picker-detail-content')) throw Error('PageDown não rolou os detalhes');
  await page.keyboard.press('PageUp');
  if (await getScroll('.project-picker-detail-content')) throw Error('PageUp não voltou ao topo');
  await page.keyboard.press('Enter');
  await picker.waitFor({state:'hidden'});
  await page.locator('#market-dialog').waitFor({state:'hidden'});
  await page.keyboard.press('o');
  await page.getByRole('button',{name:new RegExp(title)}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#gameplay-dialog').waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Secretaria · Falar com Dona Sílvia'}).click();
  const standalone = page.getByRole('button',{name:'Pedir documento avulso'});
  await page.keyboard.press(await standalone.getAttribute('aria-keyshortcuts'));
  await page.locator('#market-dialog').waitFor({state:'hidden'});
  await page.keyboard.press('o');
  await page.getByRole('button',{name:/Estatuto da Fila Preferencial/}).waitFor();
  await page.getByRole('button',{name:new RegExp(title)}).waitFor();
  await page.setViewportSize({width:1280,height:720});
  await page.reload();
  const guest = await page.context().newPage();
  try {
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Rafa');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
    const roomCode = (await page.locator('#room-label').textContent()).trim().split(' ')[1];

    await guest.goto(page.url());
    await guest.getByRole('textbox',{name:'Seu nick'}).fill('Bia');
    await guest.getByRole('textbox',{name:'Código da sala'}).fill(roomCode);
    await guest.getByRole('button',{name:'Entrar',exact:true}).click();
    await guest.locator('#lobby-back').waitFor();
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();

    await page.getByRole('button',{name:'Pedir afastamento',exact:true}).click();
    const submit = institution.getByRole('button',{name:'Convocar votação',exact:true});
    await submit.waitFor();
    if (await submit.isEnabled()) throw Error('É possível convocar votação sem escolher um alvo');
    await institution.getByRole('button',{name:/^Bia ·/}).click();
    await submit.click();
    await institution.waitFor({state:'hidden'});

    for (const client of [page,guest]) {
      await client.locator('#session[data-phase="hearing"]').waitFor();
      await client.locator('#ballot').getByText(/0\/2 votaram/).waitFor();
    }
    await page.locator('#ballot').getByRole('button',{name:'Afastar',exact:true}).click();
    await guest.locator('#ballot').getByText(/1\/2 votaram/).waitFor();
    if (await guest.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');
    return {resolutions:3,projectPickerResolutions:2,clients:2,hearingVoteReplicated:true};
  } finally {
    await guest.close();
  }
}
