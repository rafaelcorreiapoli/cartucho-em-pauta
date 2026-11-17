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
  const caption = client=>tv(client).locator('.campaign-tv-caption');
  const announcement = client=>client.locator('.campaign-tv-announcement');
  async function checkAd(client,nick,side,motion) {
    await caption(client).getByText('Vote '+nick,{exact:true}).waitFor();
    const ad = await tv(client).evaluate(element=>{
      const animation = element.getAnimations()[0];
      const keyframes = animation?.effect.getKeyframes();
      return {
        side:element.dataset.side,
        opening:keyframes?.[0]?.transform,
        onScreen:keyframes?.[1]?.transform,
        image:element.querySelector('img').naturalWidth,
        number:element.querySelector('strong').textContent,
        skin:element.querySelector('[data-skin]').dataset.skin,
        announcement:element.parentElement.querySelector('.campaign-tv-announcement').textContent.trim(),
      };
    });
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
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();

    // Keep both airtime timers paused until the second purchase is acknowledged.
    for (const client of [page,guest]) {
      await advertiser(client).waitFor();
      await client.evaluate(async ()=>{
        const image = new Image();
        image.src = '/assets/campaign-tv.webp';
        await image.decode();
      });
      await client.clock.install();
      // Give the remote browser room to receive the clock command under CI load.
      await client.clock.pauseAt(new Date(Date.now()+10_000));
    }
    await advertiser(page).dispatchEvent('click');
    const rafa = await Promise.all([checkAd(page,'Rafa','left',true),checkAd(guest,'Rafa','right',false)]);
    if (rafa[0].number!==rafa[1].number || rafa[0].skin!==rafa[1].skin) throw Error('Clientes receberam propagandas diferentes.');
    await advertiser(guest).dispatchEvent('click');
    await advertiser(guest).waitFor({state:'hidden'});
    for (const client of [page,guest]) {
      if (await caption(client).locator('span').textContent()!=='Vote Rafa') throw Error('A segunda propaganda interrompeu a primeira.');
    }
    await Promise.all([page,guest].map(client=>client.clock.fastForward(4_600)));
    const bia = await Promise.all([checkAd(page,'Bia','right',true),checkAd(guest,'Bia','left',false)]);
    if (bia[0].number!==bia[1].number || bia[0].skin!==bia[1].skin || bia[0].number===rafa[0].number) {
      throw Error('Identidade da segunda propaganda incorreta.');
    }
    for (const client of [page,guest]) {
      await client.clock.resume();
      await tv(client).waitFor({state:'detached'});
      if ((await announcement(client).textContent()).trim() || await client.evaluate(()=>window.micAttempts)!==0) {
        throw Error('O anúncio não foi limpo ou o microfone foi solicitado.');
      }
    }
    return {rafa,bia};
  } finally {
    await guest.close();
  }
}
