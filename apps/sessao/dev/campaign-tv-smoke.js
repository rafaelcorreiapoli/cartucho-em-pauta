async page => {
  await page.context().addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      throw new DOMException('Teste sem microfone','NotAllowedError');
    };
  });
  const guest = await page.context().newPage();
  const advertiser = client=>client.getByRole('button',{name:'Veicular propaganda'});
  const tv = client=>client.locator('.campaign-tv');
  const announcement = client=>client.locator('.campaign-tv-announcement');

  async function observeBroadcasts(client) {
    await client.evaluate(async ()=>{
      const image = new Image();
      image.src = '/assets/campaign-tv.webp';
      await image.decode();
      const host = document.querySelector('.campaign-tv-host');
      window.campaignAds = [];
      let previous;
      const observer = new MutationObserver(()=>{
        const element = host.querySelector('.campaign-tv');
        if (!element || element===previous) return;
        previous = element;
        const keyframes = element.getAnimations()[0]?.effect.getKeyframes();
        const frame = element.getBoundingClientRect();
        const equipment = document.querySelector('.character-dock').getBoundingClientRect();
        const agenda = document.getElementById('agenda-dock').getBoundingClientRect();
        const artwork = element.querySelector('img');
        const sample = {
          at:performance.now(),
          fitsBetweenHud:frame.top>=equipment.bottom && frame.bottom<=agenda.top,
          title:element.querySelector('.campaign-tv-caption span').textContent,
          side:element.dataset.side,
          opening:keyframes?.[0]?.transform,
          onScreen:keyframes?.[1]?.transform,
          image:undefined,
          number:element.querySelector('strong').textContent,
          skin:element.querySelector('[data-skin]').dataset.skin,
          announcement:host.querySelector('.campaign-tv-announcement').textContent.trim(),
        };
        window.campaignAds.push(sample);
        artwork.decode().then(()=>{ sample.image = artwork.naturalWidth; },()=>{ sample.image = 0; });
        if (window.campaignAds.length===2) observer.disconnect();
      });
      observer.observe(host,{childList:true,subtree:true});
    });
  }

  function checkAd(ad,nick,side,motion) {
    if (side==='left' && !ad.fitsBetweenHud) throw Error('A TV não cabe entre os equipamentos e a agenda.');
    if (ad.title!=='Vote '+nick) throw Error('Propaganda fora de ordem: '+JSON.stringify(ad));
    if (ad.side!==side || (motion && (!ad.opening?.startsWith(side==='left' ? 'translateX(calc(-' : 'translateX(calc(100%') ||
        ad.onScreen!=='none')) || (!motion && ad.opening) || ad.image===0 || !/^\d+$/.test(ad.number)) {
      throw Error('Propaganda incorreta: '+JSON.stringify(ad));
    }
    if (ad.announcement!==`Propaganda eleitoral. Vote ${nick}, número ${ad.number}.`) {
      throw Error('Anúncio acessível incorreto.');
    }
    return ad;
  }

  try {
    await page.setViewportSize({width:1280,height:720});
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.reload();
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Rafa');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
    const code = (await page.locator('#room-label').textContent()).trim().split(' ')[1];

    await guest.setViewportSize({width:1024,height:600});
    await guest.emulateMedia({reducedMotion:'reduce'});
    await guest.goto(page.url());
    await guest.getByRole('textbox',{name:'Seu nick'}).fill('Bia');
    await guest.getByRole('textbox',{name:'Código da sala'}).fill(code);
    await guest.getByRole('button',{name:'Entrar',exact:true}).click();
    await guest.locator('#lobby-back').waitFor();
    await page.getByRole('button',{name:'Configurar partida',exact:true}).click();
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    if (await page.locator('dialog.match-settings').isVisible()) await page.getByRole('button',{name:'Voltar ao lobby',exact:true}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    await Promise.all([page,guest].map(client=>client.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click()));

    await Promise.all([advertiser(page).waitFor(),advertiser(guest).waitFor()]);
    await Promise.all([observeBroadcasts(page),observeBroadcasts(guest)]);
    const clock = page.getByRole('timer',{name:'Tempo restante da sessão'});
    await clock.waitFor();
    if (!/\d+:\d{2}/.test(await clock.textContent())) throw Error('Relógio da sessão invisível.');
    const originalAdvertise = advertiser(page);
    const actionMenu = page.getByRole('dialog',{name:'Atalhos de teclado'});
    await originalAdvertise.evaluate(button=>{
      button.setAttribute('aria-label','Ação original da Sala de Imprensa');
      button.addEventListener('click',event=>{event.preventDefault();event.stopImmediatePropagation();},true);
    });
    await page.keyboard.press('F2');
    const campaignShortcut = advertiser(actionMenu);
    await campaignShortcut.waitFor();
    await page.keyboard.press(await campaignShortcut.getAttribute('aria-keyshortcuts'));
    await actionMenu.waitFor({state:'hidden'});
    const picker = client=>client.getByRole('dialog',{name:'Veicular propaganda'});
    const spot = client=>picker(client).getByRole('button',{name:/Spot eleitoral/});
    await spot(page).waitFor();
    const offers = await picker(page).locator('button[aria-keyshortcuts]').evaluateAll(async buttons=>
      Promise.all(buttons.map(async button=>{
        await button.querySelector('img').decode();
        return [button.querySelector('kbd').textContent,button.querySelector('[data-reward="popularity"]').textContent];
      })),
    );
    if (JSON.stringify(offers)!==JSON.stringify([['1','+5 Popularidade'],['2','+8 Popularidade'],['3','+12 Popularidade']])) {
      throw Error('Retratos, ganhos ou teclas incorretos no seletor de propaganda.');
    }
    const desktopViewport = page.viewportSize();
    await page.setViewportSize({width:800,height:360});
    if (await picker(page).evaluate(dialog=>dialog.scrollHeight>dialog.clientHeight)) {
      throw Error('O seletor corta as opções na tela baixa.');
    }
    await page.setViewportSize(desktopViewport);
    await page.keyboard.press('1');
    await picker(page).waitFor({state:'hidden'});
    await guest.waitForFunction(()=>window.campaignAds.length===1);
    await advertiser(guest).click();
    await spot(guest).click();
    const broadcasts = await Promise.all([page,guest].map(async client=>{
      await client.waitForFunction(()=>window.campaignAds.length===2 && window.campaignAds.every(ad=>ad.image!==undefined));
      return client.evaluate(()=>window.campaignAds);
    }));
    for (const [first,second] of broadcasts) {
      if (second.at-first.at<3_900) throw Error('A segunda propaganda interrompeu a primeira.');
    }
    const rafa = [checkAd(broadcasts[0][0],'Rafa','left',true),checkAd(broadcasts[1][0],'Rafa','right',false)];
    const bia = [checkAd(broadcasts[0][1],'Bia','right',true),checkAd(broadcasts[1][1],'Bia','left',false)];
    if (rafa[0].number!==rafa[1].number || rafa[0].skin!==rafa[1].skin) throw Error('Clientes receberam propagandas diferentes.');
    if (bia[0].number!==bia[1].number || bia[0].skin!==bia[1].skin || bia[0].number===rafa[0].number) {
      throw Error('Identidade da segunda propaganda incorreta.');
    }
    for (const client of [page,guest]) {
      await tv(client).waitFor({state:'detached'});
      if ((await announcement(client).textContent()).trim() || await client.evaluate(()=>window.micAttempts)!==0) {
        throw Error('O anúncio não foi limpo ou o microfone foi solicitado.');
      }
    }
    await page.keyboard.press('F2');
    await actionMenu.waitFor();
    if (!await campaignShortcut.count()) throw Error('O atalho deixou de oferecer propaganda no mesmo ciclo.');
    await page.keyboard.press('Escape');
    return {rafa,bia,keyboardBroadcast:true,availableAfterUse:true};
  } finally {
    await guest.close();
  }
}
