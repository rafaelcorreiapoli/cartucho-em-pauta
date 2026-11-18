async page => {
  const url = page.url();
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      await new Promise(resolve=>setTimeout(resolve,150));
      throw new DOMException('QA sem microfone','NotAllowedError');
    };
  });
  await page.goto(url);
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Atalhos QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const settings = page.getByRole('dialog',{name:'Configurações'});
  await page.locator('#lobby-settings').click();
  await settings.getByRole('status').filter({hasText:/Sala /}).waitFor();
  await page.keyboard.press('Escape');
  await settings.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  const role = page.getByRole('dialog',{name:'Parlamentar',exact:true});
  await role.getByText(/Proteja o Congresso.*45 de estabilidade/).waitFor();
  await role.evaluate(dialog=>{
    const {x,y,width,height} = dialog.getBoundingClientRect();
    if (Math.abs(x+width/2-innerWidth/2)>2 || Math.abs(y+height/2-innerHeight/2)>2) {
      throw Error('O aviso de papel saiu do centro da tela.');
    }
  });
  await role.getByRole('button',{name:'Entendi',exact:true}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  const launcher = page.getByRole('button',{name:'Aplicativos',exact:true});
  const apps = page.locator('#congress-app-panel');
  await launcher.waitFor();
  await page.locator('#asset-loading').waitFor({state:'hidden'});
  await page.waitForFunction(()=>document.querySelector('#congress-apps')
    ?.checkVisibility({visibilityProperty:true,opacityProperty:true}));
  await page.keyboard.press('u');
  await apps.waitFor();
  await page.keyboard.press('F2');
  const palette = page.getByRole('dialog',{name:'Atalhos de teclado'});
  await palette.waitFor();
  const previous = palette.getByRole('button',{name:'Página anterior'});
  const next = palette.getByRole('button',{name:'Próxima página'});
  if (!(await previous.isDisabled()) || !(await next.isEnabled())) throw Error('Limites na primeira página');
  await page.keyboard.press('ArrowRight');
  await palette.getByText(/^2 \/ /).waitFor();
  await page.keyboard.press('ArrowLeft');
  await palette.getByText(/^1 \/ /).waitFor();
  await page.keyboard.press('Escape');
  await palette.waitFor({state:'hidden'});
  if (await page.locator('#open-settings, #open-phone, #open-bag, #open-attributes, #open-surveillance, #open-equipment').count()) {
    throw Error('Comandos do HUD ainda dependem de botões duplicados');
  }
  await page.screenshot({animations:'disabled',path:'/tmp/sessao-exploration-apps.png'});
  const gameplay = page.locator('#gameplay-dialog');
  await page.getByRole('button',{name:'Mochila',exact:true}).click();
  await gameplay.getByRole('heading',{name:'Inventário',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await gameplay.waitFor({state:'hidden'});
  await apps.waitFor({state:'hidden'});
  await page.keyboard.press('F2');
  const openPhone = palette.getByRole('button',{name:'Celular',exact:true});
  while (!await openPhone.count() && !await next.isDisabled()) await page.keyboard.press('ArrowRight');
  await openPhone.waitFor();
  await page.keyboard.press(await openPhone.getAttribute('aria-keyshortcuts'));
  await gameplay.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await gameplay.waitFor({state:'hidden'});
  await launcher.click();
  await apps.waitFor();
  for (const [name,key] of [['Equipamentos','E'],['Personagem','P'],['Celular','C'],['Microfone','M'],['Configurações','K']]) {
    const app = page.locator('#congress-app-panel').getByRole('button',{name,exact:true});
    if (await app.getAttribute('aria-keyshortcuts')!==key) throw Error('Atalho ausente: '+name);
  }
  await page.keyboard.press('c');
  await gameplay.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  await apps.waitFor({state:'hidden'});
  await page.keyboard.press('Escape');
  await gameplay.waitFor({state:'hidden'});
  await page.keyboard.press('u');
  await apps.waitFor();
  await page.keyboard.press('u');
  await apps.waitFor({state:'hidden'});
  await page.keyboard.press('m');
  await page.keyboard.press('m');
  await page.keyboard.press('k');
  await settings.waitFor();
  await settings.getByText('Permita o microfone no navegador e tente novamente.').waitFor();
  if (await page.evaluate(()=>window.micAttempts)!==1) throw Error('O atalho iniciou duas capturas simultâneas');
  const music = settings.getByRole('slider',{name:'Música'});
  const effects = settings.getByRole('slider',{name:'Efeitos e passos'});
  await music.press('Home');
  await effects.press('End');
  const readAudio = ()=>page.evaluate(()=>JSON.parse(localStorage.getItem('cartuchao.sessao.audio')));
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('cartuchao.sessao.audio')).sfxVolume===1);
  const prefs = await readAudio();
  if (!prefs.muted || prefs.musicVolume!==0) throw Error('Preferências de áudio não persistiram');
  await settings.getByRole('button',{name:'Ativar voz'}).click();
  await settings.getByText('Permita o microfone no navegador e tente novamente.').waitFor();
  if (!await settings.getByRole('button',{name:'Ativar voz'}).isEnabled()) throw Error('Não foi possível tentar o microfone novamente');
  await settings.getByRole('button',{name:'Fechar configurações'}).click();
  await settings.waitFor({state:'hidden'});
  await page.keyboard.press('k');
  await settings.waitFor();
  const effectsInput = settings.locator('#effects-volume');
  await effectsInput.evaluate(input=>input.setAttribute('aria-label','Rótulo original alterado'));
  await page.keyboard.press('F2');
  await page.locator('#action-shortcuts').getByRole('button',{name:/Efeitos e passos/}).click();
  await page.waitForFunction(()=>document.activeElement?.id==='effects-volume');
  await page.keyboard.press('F2');
  await page.locator('#action-shortcuts').getByRole('button',{name:/Fechar configurações/}).click();
  await settings.waitFor({state:'hidden'});
  await page.keyboard.press('p');
  const attributes = page.getByRole('dialog',{name:/Atributos/i});
  await attributes.waitFor();
  await page.keyboard.press('F2');
  await palette.waitFor();
  const closeAction = palette.locator('.shortcut-list button').filter({hasText:'Fechar'});
  const key = await closeAction.getAttribute('aria-keyshortcuts');
  await palette.evaluate(node=>{
    window.syntheticPaletteClicks = 0;
    node.addEventListener('click',event=>{
      if (!event.isTrusted) window.syntheticPaletteClicks++;
    });
  });
  await closeAction.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
  await page.keyboard.press(key);
  await palette.waitFor({state:'hidden'});
  await attributes.waitFor({state:'hidden'});
  if (await page.evaluate(()=>window.syntheticPaletteClicks)!==0) throw Error('O atalho simulou um clique no menu F2');
  const dossier = page.getByRole('dialog',{name:'Dossiê'});
  for (const viewport of [{width:1280,height:720},{width:1024,height:600},{width:800,height:600}]) {
    await page.setViewportSize(viewport);
    await page.keyboard.press('j');
    await dossier.getByRole('heading',{name:'Dossiê'}).waitFor();
    const panel = await dossier.boundingBox();
    if (!panel || panel.x<0 || panel.y<0 || panel.x+panel.width>viewport.width || panel.y+panel.height>viewport.height) {
      throw Error('Dossiê fora do viewport: '+JSON.stringify({viewport,panel}));
    }
    if (await page.locator('#social-docks, #politics-dock, #institutional-dock').count()) throw Error('Acionador legado do Dossiê visível');
    if (viewport.width===1024) await page.keyboard.press('j');
    else await dossier.getByRole('button',{name:'Fechar dossiê'}).click();
    await dossier.waitFor({state:'hidden'});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('timer',{name:'Próxima distribuição de salários'}).getByText('Custo',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Pesquisa eleitoral',exact:true}).locator('kbd').filter({hasText:'L'}).waitFor();
  await page.keyboard.press('l');
  const polls = page.getByRole('dialog',{name:'Pesquisa eleitoral'});
  await polls.getByRole('progressbar',{name:'Intenção de voto de Atalhos QA'}).waitFor();
  await polls.getByRole('button',{name:'Fechar pesquisa eleitoral'}).click();
  await polls.waitFor({state:'hidden'});
  await page.keyboard.press('v');
  const surveillance = page.getByRole('dialog',{name:'Central de Vigilância'});
  await surveillance.getByRole('button',{name:'Câmeras 0'}).click();
  await surveillance.getByText('Nenhuma câmera instalada.').waitFor();
  await surveillance.getByRole('button',{name:'Escutas 0'}).click();
  await surveillance.getByText('Nenhuma escuta instalada.').waitFor();
  await surveillance.getByRole('button',{name:'Fechar vigilância'}).click();
  await surveillance.waitFor({state:'hidden'});
  await page.keyboard.press('k');
  await settings.getByRole('button',{name:'Sair',exact:true}).click();
  await settings.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Criar sala'}).waitFor();
}
