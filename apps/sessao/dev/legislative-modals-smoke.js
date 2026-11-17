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
  async function runShortcut(original,name) {
    await original.evaluate(control=>control.setAttribute('aria-label','Rótulo original alterado'));
    await page.keyboard.press('F2');
    await page.locator('#action-shortcuts').getByRole('button',{name}).click();
  }
  await runShortcut(institution.getByRole('button',{name:'Desviar R$ 30 mil'}),/Desviar R\$ 30 mil/);
  await runShortcut(institution.getByRole('button',{name:/Aplicar verba de/}),/Aplicar verba de/);
  await institution.waitFor({state:'hidden'});
  await grant.waitFor({state:'hidden'});
  await page.locator('#profile-dock').getByText('R$ 110 mil',{exact:true}).waitFor();
  await page.keyboard.press('j');
  await dossier.waitFor();
  await runShortcut(dossier.locator('summary'),/Registro público/);
  await dossier.locator('details[open]').waitFor();
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await dossier.waitFor({state:'hidden'});
  await page.keyboard.press('j');
  if (await dossier.isVisible()) throw Error('Dossiê abriu durante a votação');
  if (await page.locator('#social-docks, #politics-dock, #institutional-dock').count()) throw Error('Contêiner legado ainda existe');
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');

  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Projetos QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const twoNpcs = page.locator('#parliamentarian-count [data-count="2"]');
  await twoNpcs.click();
  await twoNpcs.and(page.locator('[aria-pressed="true"]')).waitFor();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.getByRole('button',{name:'Secretaria · Falar com Dona Sílvia'}).click();
  if (await page.getByRole('button',{name:'Pedir documento avulso'}).count()) {
    throw Error('A Secretaria voltou a oferecer documentos avulsos.');
  }
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
  await confirm.evaluate(button=>button.setAttribute('aria-label','Rótulo original alterado'));
  await page.keyboard.press('F2');
  await page.locator('#action-shortcuts').getByRole('button',{name:/Confirmar/}).click();
  await picker.waitFor({state:'hidden'});
  await page.locator('#market-dialog').waitFor({state:'hidden'});
  await page.keyboard.press('o');
  await page.getByRole('button',{name:new RegExp(title)}).waitFor();
  await page.keyboard.press('Escape');
  await page.locator('#gameplay-dialog').waitFor({state:'hidden'});
  await page.setViewportSize({width:1280,height:720});
  const conversation = page.getByRole('button',{name:/^Conversar · /});
  await conversation.nth(1).waitFor();
  const conversations = await conversation.all();
  const npcDeal = page.locator('#parliamentarian-dialog');
  const signatureMission = 'Consiga duas assinaturas no mesmo documento';
  await page.getByRole('list',{name:'Objetivos ativos'}).getByText(signatureMission,{exact:true}).waitFor();
  for (const npc of conversations) {
    await npc.click();
    const sign = npcDeal.getByRole('button',{name:/^Estatuto da Fila Preferencial/});
    await sign.waitFor();
    if (await npcDeal.getByRole('button',{name:new RegExp(title)}).count()) throw Error('NPC ofereceu assinatura de projeto');
    await sign.evaluate(button=>button.setAttribute('aria-label','Assinatura original oculta do F2'));
    await page.keyboard.press('F2');
    const palette = page.getByRole('dialog',{name:'Atalhos de teclado'});
    const action = palette.getByRole('button',{name:/^Estatuto da Fila Preferencial/});
    await action.waitFor();
    await page.keyboard.press(await action.getAttribute('aria-keyshortcuts'));
    await npcDeal.getByRole('button',{name:'Assinatura original oculta do F2',exact:true}).waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await npcDeal.waitFor({state:'hidden'});
  }
  await page.locator('#agenda-dock [data-done="true"]').getByText(signatureMission,{exact:true}).waitFor();
  await page.keyboard.press('o');
  const objectDialog = page.locator('#gameplay-dialog');
  await objectDialog.getByRole('button',{name:/Estatuto da Fila Preferencial/}).click();
  await page.keyboard.press('Shift+Digit1');
  await page.keyboard.press('Escape');
  await objectDialog.waitFor({state:'hidden'});
  await page.keyboard.press('Shift+Digit1');
  await objectDialog.getByRole('heading',{name:'Estatuto da Fila Preferencial'}).waitFor();
  await runShortcut(objectDialog.locator('summary'),/^Inspecionar$/);
  await objectDialog.locator('details[open]').getByText(/Assinaturas 2\//).waitFor();
  await page.keyboard.press('Shift+Digit2');
  await objectDialog.getByRole('button',{name:'Vincular ao slot 2',pressed:true}).waitFor();
  const drop = objectDialog.getByRole('button',{name:'Largar no chão',exact:true});
  const dropKey = await drop.getAttribute('aria-keyshortcuts');
  await drop.evaluate(button=>{
    button.removeAttribute('aria-keyshortcuts');
    button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
  });
  await page.keyboard.press(dropKey);
  await objectDialog.getByRole('heading',{name:'Estatuto da Fila Preferencial'}).waitFor({state:'hidden'});

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
    const actionMenu = page.locator('#action-shortcuts');
    await page.keyboard.press('F2');
    await actionMenu.waitFor();
    if (await actionMenu.getByRole('button',{name:/Convocar votação/}).count()) {
      throw Error('O F2 permite convocar votação sem escolher um alvo');
    }
    await page.keyboard.press('Escape');
    await actionMenu.waitFor({state:'hidden'});
    await runShortcut(institution.getByRole('button',{name:/^Bia ·/}),/^Bia ·/);
    await runShortcut(submit,/Convocar votação/);
    await institution.waitFor({state:'hidden'});

    for (const client of [page,guest]) {
      await client.locator('#session[data-phase="hearing"]').waitFor();
      await client.locator('#ballot').getByText(/0\/2 votaram/).waitFor();
    }
    const originalVote = page.locator('#ballot').getByRole('button',{name:'Afastar',exact:true});
    await originalVote.evaluate(button=>button.setAttribute('aria-label','Botão original oculto do F2'));
    await page.keyboard.press('F2');
    const palette = page.getByRole('dialog',{name:'Atalhos de teclado'});
    const vote = palette.getByRole('button',{name:'Afastar',exact:true});
    await vote.waitFor();
    await page.keyboard.press(await vote.getAttribute('aria-keyshortcuts'));
    await palette.waitFor({state:'hidden'});
    await page.locator('#ballot').getByText('Seu voto: afastar',{exact:true}).waitFor();
    await guest.locator('#ballot').getByText(/1\/2 votaram/).waitFor();
    if (await guest.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');

  } finally {
    await guest.close();
  }

  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Cassação QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
  const cassationRoom = (await page.locator('#room-label').textContent()).trim().split(' ')[1];
  const disconnected = await page.context().newPage();
  const witness = await page.context().newPage();
  const fourth = await page.context().newPage();
  try {
    for (const [client,nick] of [[disconnected,'Bia'],[witness,'Caio'],[fourth,'Dani']]) {
      await client.goto(page.url());
      await client.getByRole('textbox',{name:'Seu nick'}).fill(nick);
      await client.getByRole('textbox',{name:'Código da sala'}).fill(cassationRoom);
      await client.getByRole('button',{name:'Entrar',exact:true}).click();
      await client.locator('#lobby-back').waitFor();
    }
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    await page.getByRole('button',{name:/^Convocar cassação/}).click();
    const ballot = page.getByRole('region',{name:'Votação de cassação'});
    await ballot.getByRole('button',{name:'Bia',exact:true}).waitFor();
    const palette = page.getByRole('dialog',{name:'Atalhos de teclado'});
    await page.keyboard.press('F2');
    const stale = palette.getByRole('button',{name:'Bia',exact:true});
    await stale.waitFor();
    const previousKey = await stale.getAttribute('aria-keyshortcuts');
    await disconnected.close();
    await ballot.getByRole('button',{name:'Bia',exact:true}).waitFor({state:'hidden'});
    await page.keyboard.press(previousKey);
    await palette.waitFor({state:'hidden'});
    if (await ballot.getByRole('button',{name:'Caio',pressed:true}).count()) {
      throw Error('Uma escolha antiga mudou o voto para outro candidato.');
    }
    await page.keyboard.press('F2');
    if (await stale.count()) throw Error('O F2 manteve o candidato desconectado.');
    const candidate = palette.getByRole('button',{name:'Caio',exact:true});
    await candidate.waitFor();
    await page.keyboard.press(await candidate.getAttribute('aria-keyshortcuts'));
    await ballot.getByRole('button',{name:'Caio',pressed:true}).waitFor();
    await witness.getByRole('region',{name:'Votação de cassação'}).getByText(/1\/3 votaram/).waitFor();
    const result = page.getByRole('dialog',{name:'Resultados'});
    const witnessResult = witness.getByRole('dialog',{name:'Resultados'});
    for (const modal of [result,witnessResult]) {
      await modal.getByText('Ninguém foi cassado. Nenhum suspeito recebeu a maioria dos votos.').waitFor();
    }
    await runShortcut(result.getByRole('button',{name:'Continuar',exact:true}),/^Continuar$/);
    await result.waitFor({state:'hidden'});
    if (!await witnessResult.isVisible()) throw Error('Fechar o resultado local afetou o outro jogador');
  } finally {
    if (!disconnected.isClosed()) await disconnected.close();
    await witness.close();
    await fourth.close();
  }
  await page.reload();
  await page.setViewportSize({width:800,height:600});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Final QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.locator('#parliamentarian-count [data-count="0"]').click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  const finale = page.locator('#session-finale');
  await page.locator('#session[data-phase="finished"]').waitFor();
  await finale.getByRole('heading',{name:'Infiltrados'}).waitFor({state:'hidden'});
  await finale.getByRole('region',{name:'Parlamentares'}).getByText('Final QA',{exact:true}).waitFor();
  const finaleBox = await finale.boundingBox();
  if (!finaleBox || finaleBox.x!==0 || finaleBox.y!==0 || finaleBox.width!==800 || finaleBox.height!==600) {
    throw Error('A tela final não cobre o viewport: '+JSON.stringify(finaleBox));
  }
  await runShortcut(finale.getByRole('button',{name:'Continuar',exact:true}),/^Continuar$/);
  await finale.waitFor({state:'hidden'});
  await page.locator('#session[data-phase="finished"]').waitFor();
  return {resolutions:3,projectPickerResolutions:2,hearingVoteReplicatedViaF2:true,cassationVoteReplicatedViaF2:true,
    staleCandidateRejected:true,cassationResultDismissedViaF2:true,finaleDismissedViaF2:true,hotbarDocumentInspectedAndDroppedByKeyboard:true};
}
