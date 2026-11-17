async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      throw new DOMException('QA sem microfone','NotAllowedError');
    };
  });
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.reload();
  await page.evaluate(()=>{
    window.hudSlides = [];
    document.addEventListener('transitionrun',event=>{
      if (event.propertyName==='translate' && ['agenda-dock','legislative-dock'].includes(event.target.id)) {
        window.hudSlides.push(event.target.id);
      }
    });
  });
  const measureHud = async (width,height) => {
    await page.setViewportSize({width,height});
    const selectors = {
      profile:'#profile-dock', gear:'#equipped-gear', agenda:'#agenda-dock',
      first:'#item-slots button:nth-child(1)', third:'#item-slots button:nth-child(3)',
      fourth:'#item-slots button:nth-child(4)', sixth:'#item-slots button:nth-child(6)',
      apps:'#congress-apps [aria-label="Aplicativos"]', bag:'#congress-apps [aria-label="Mochila"]',
    };
    await page.locator(selectors.sixth).waitFor();
    const boxes = await page.evaluate(selectors=>Object.fromEntries(Object.entries(selectors).map(([key,selector])=>{
      const {left,right,top,bottom,width,height} = document.querySelector(selector).getBoundingClientRect();
      return [key,{left,right,top,bottom,width,height}];
    })),selectors);
    const {profile,gear,agenda,first,third,fourth,sixth,apps,bag} = boxes;
    const aligned = (a,b)=>Math.abs(a-b)<1;
    if (Object.values(boxes).some(box=>box.left<0 || box.right>width || box.top<0 || box.bottom>height || !box.width || !box.height) ||
      !aligned(profile.left,gear.left) || !aligned(profile.left,agenda.left) ||
      profile.bottom>gear.top || gear.bottom>agenda.top || agenda.right>fourth.left ||
      !aligned(first.top,third.top) || !aligned(first.top,apps.top) ||
      !aligned(fourth.top,sixth.top) || !aligned(fourth.top,bag.top) ||
      !aligned(first.left,fourth.left) || !aligned(apps.left,bag.left) ||
      first.bottom>fourth.top || third.right>apps.left || sixth.right>bag.left) {
      throw Error(`HUD layout at ${width}×${height}: ${JSON.stringify(boxes)}`);
    }
  };
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Histórico QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const npcs = page.locator('#parliamentarian-count [data-count="0"]');
  await npcs.click();
  await page.waitForFunction(()=>document.querySelector('#parliamentarian-count [data-count="0"]')?.getAttribute('aria-pressed')==='true');
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  const settingsButton = page.locator('#plenary-settings');
  await settingsButton.waitFor({state:'hidden'});
  await page.locator('.plenary-countdown').getByText('Votação de projeto').waitFor();
  await page.waitForFunction(()=>!document.querySelector('.character-dock').getAnimations().length);

  for (const [width,height] of [[1280,720],[1024,600],[800,600]]) await measureHud(width,height);
  await page.setViewportSize({width:1280,height:720});
  const countdown = page.locator('#ballot-countdown');
  await countdown.getByRole('status').getByText(/Votação começando em [1-5]…/).waitFor();
  await page.keyboard.press('Escape');
  if (!await countdown.isVisible()) throw Error('The countdown closed before the vote');
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await countdown.waitFor({state:'hidden'});
  const exploring = ['.character-dock','#agenda-dock','.deck-tools','#election-dock','#context-hud'];
  for (const selector of exploring) await page.locator(selector).waitFor({state:'hidden'});
  await page.locator('#congress-dock').waitFor({state:'visible'});
  const settings = page.getByRole('dialog',{name:'Configurações'});
  await settingsButton.click();
  await settings.getByRole('button',{name:'Ativar voz'}).waitFor();
  await page.keyboard.press('Escape');
  await settings.waitFor({state:'hidden'});
  await page.keyboard.press('k');
  await settings.waitFor({state:'visible'});
  await page.keyboard.press('Escape');
  await settings.waitFor({state:'hidden'});
  await page.locator('.plenary-countdown').waitFor({state:'hidden'});
  await page.waitForFunction(()=>['agenda-dock','legislative-dock'].every(id=>window.hudSlides.includes(id)));
  await page.locator('[data-vote="yes"]').waitFor();
  const sheet = page.getByRole('region',{name:'Votação de projeto'});
  await sheet.getByRole('heading',{name:'Auxílio Churrasco'}).waitFor();
  await sheet.getByText('Protocolado por Histórico QA').waitFor();
  const impactColors = await sheet.evaluate(dialog=>Object.fromEntries(['gain','loss','neutral'].map(tone=>[
    tone,getComputedStyle(dialog.querySelector(`.project-impact-value[data-effect="${tone}"]`)).color,
  ])));
  if (impactColors.gain!=='rgb(168, 231, 150)' || impactColors.loss!=='rgb(255, 154, 139)' || impactColors.neutral!=='rgb(224, 216, 198)') {
    throw Error('As cores de impacto da votação não batem com os tokens do HUD');
  }
  await sheet.getByRole('button',{name:'Recolher votação'}).click();
  await sheet.locator('.project-ballot-body').waitFor({state:'hidden'});
  await page.keyboard.press('y');
  const collapsedClock = await sheet.locator('.project-ballot-handle time').textContent();
  await page.waitForFunction(previous=>{
    const clock = document.querySelector('.project-ballot-handle time');
    return clock && clock.textContent!==previous;
  },collapsedClock);
  await sheet.getByRole('button',{name:'Expandir votação'}).waitFor();
  await sheet.getByRole('button',{name:'Expandir votação'}).click();
  if (await sheet.locator('[data-vote-state="yes"]').filter({hasText:'Histórico QA'}).count()) {
    throw Error('Y enviou voto com a cédula recolhida');
  }
  const yesButton = sheet.getByRole('button',{name:'Votar SIM'});
  await yesButton.evaluate(button=>button.removeAttribute('data-vote'));
  await page.keyboard.press('y');
  await yesButton.evaluate(button=>button.setAttribute('data-vote','yes'));
  const yesVoter = sheet.locator('[data-vote-state="yes"]').filter({hasText:'Histórico QA'});
  await yesVoter.getByText('Histórico QA').waitFor();
  await yesVoter.locator('.portrait.phone-contact-face[data-skin]').evaluate(async portrait=>{
    const source = getComputedStyle(portrait).backgroundImage.match(/url\(["']?([^"')]+)["']?\)/)?.[1];
    if (!source) throw Error('Voter portrait has no sprite sheet');
    const image = new Image();
    image.src = source;
    await image.decode();
  });
  await page.keyboard.press('r');
  await sheet.locator('[data-vote-state="no"]').getByText('Histórico QA').waitFor();
  await page.keyboard.press('n');
  await sheet.locator('[data-vote-state="abstain"]').getByText('Histórico QA').waitFor();
  await page.evaluate(()=>{ window.hudSlides.length = 0; });
  await page.locator('#session[data-phase="negotiation"]').waitFor({timeout:35000});
  await page.locator('#legislative-dock').waitFor({state:'hidden'});
  await settingsButton.waitFor({state:'hidden'});
  const brief = page.locator('#project-outcome-brief');
  await brief.locator('#brief-project').filter({hasText:'Auxílio Churrasco'}).waitFor({state:'attached'});
  if (await brief.getAttribute('hidden')!==null) throw Error('New outcome brief was not activated');
  await brief.locator('#brief-budget').filter({hasText:'R$ 0 mil'}).waitFor({state:'attached'});
  await brief.getByText('1 abstenção',{exact:true}).waitFor({state:'attached'});
  const stabilityColor = await brief.locator('#brief-stability').evaluate(node=>getComputedStyle(node).color);
  if (stabilityColor!==impactColors.loss) throw Error('Resumo da votação não preservou a cor de perda');
  await page.locator('#project-outcome-brief[hidden]').waitFor({state:'attached'});
  await page.waitForFunction(()=>['agenda-dock','legislative-dock'].every(id=>window.hudSlides.includes(id)));
  for (const selector of exploring.slice(0,3)) await page.locator(selector).waitFor({state:'visible'});
  await page.locator('#session[data-phase="ballot"]').waitFor();
  await page.locator('#session[data-phase="negotiation"]').waitFor({timeout:35000});
  await page.locator('#session[data-phase="ballot"]').waitFor();
  const history = page.locator('#vote-history');
  await history.locator('summary').click();
  const pages = history.locator('#vote-pages');
  if (await pages.getAttribute('aria-label')!=='Votação 2 de 2') throw Error('Latest ballot was not selected');
  if (await history.locator('#outcome-bill').textContent()!=='Wi-Fi na Praça') throw Error('Wrong latest project');
  await history.getByRole('button',{name:'Votação anterior'}).click();
  if (await pages.getAttribute('aria-label')!=='Votação 1 de 2') throw Error('Previous arrow did not update page');
  if (await history.locator('#outcome-bill').textContent()!=='Auxílio Churrasco') throw Error('Wrong previous project');
  const ballotClock = await sheet.locator('#project-ballot-body time').textContent();
  await page.waitForFunction(previous=>{
    const clock = document.querySelector('#project-ballot-body time');
    return clock && clock.textContent!==previous;
  },ballotClock);
  if (await pages.getAttribute('aria-label')!=='Votação 1 de 2') throw Error('A clock tick reset vote history');
  if (!await history.getByRole('button',{name:'Votação anterior'}).isDisabled()) throw Error('Previous arrow exceeded bounds');
  await history.getByRole('button',{name:'Próxima votação'}).click();
  if (!await history.getByRole('button',{name:'Próxima votação'}).isDisabled()) throw Error('Next arrow exceeded bounds');
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Votação lotada QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const start = page.getByRole('button',{name:'Iniciar sessão'});
  await start.waitFor();
  const roomId = (await page.locator('#room-label').textContent()).trim().split(' ')[1];
  await page.evaluate(async id=>{
    const {Client,server} = await import('/dev/megaphone-speech-client.ts');
    const {MAX_PLAYERS} = await import('/src/plenary.ts');
    const client = new Client(server);
    window.ballotGuests = await Promise.all(Array.from({length:MAX_PLAYERS-1},(_,index)=>
      client.joinById(id,{nick:`Parlamentar Longo ${index+1}`}).then(room=>{
        room.onMessage('*',()=>{});
        return room;
      }),
    ));
  },roomId);
  try {
    await start.click();
    await sheet.waitFor();
    const pending = sheet.locator('[data-vote-state="pending"]');
    await pending.nth(5).waitFor({state:'attached'});
    await page.evaluate(()=>window.ballotGuests[0].send('bill-vote',{vote:'abstain',token:1}));
    await sheet.getByRole('region',{name:'Abstenções',exact:true}).locator('[data-vote-state="abstain"]').waitFor();
    const pendingGroup = sheet.getByRole('region',{name:'Pendentes',exact:true});
    if (await pendingGroup.locator('[data-vote-state="abstain"]').count()) throw Error('Abstenção apareceu entre os pendentes');
    await page.evaluate(()=>window.ballotGuests.forEach(room=>room.send('bill-vote',{vote:'yes',token:2})));
    await page.keyboard.press('y');
    await sheet.locator('[data-vote-state="yes"]').nth(5).waitFor({state:'attached'});
    const board = sheet.locator('.project-ballot-score');
    for (const [width,height] of [[1280,720],[800,600]]) {
      await page.setViewportSize({width,height});
      const layout = await board.evaluate(score=>{
        const group = score.querySelector('[data-choice="yes"]');
        const list = group.querySelector('ul');
        const labels = [...list.querySelectorAll('.project-voter-name')];
        const bounds = score.getBoundingClientRect();
        const groupBounds = group.getBoundingClientRect();
        const canScroll = list.scrollHeight>list.clientHeight;
        list.scrollTop = list.scrollHeight;
        const last = list.lastElementChild.getBoundingClientRect();
        return {
          inside:groupBounds.bottom<=bounds.bottom && groupBounds.right<=bounds.right,
          lastVisible:last.bottom<=list.getBoundingClientRect().bottom+1,
          noWrap:labels.every(label=>getComputedStyle(label).whiteSpace==='nowrap'),
          ellipsis:labels.some(label=>label.scrollWidth>label.clientWidth && getComputedStyle(label).textOverflow==='ellipsis'),
          canScroll,
        };
      });
      if (!layout.inside || !layout.lastVisible || !layout.noWrap || !layout.ellipsis) {
        throw Error(`Cédula lotada em ${width}×${height}: ${JSON.stringify(layout)}`);
      }
      await page.screenshot({path:`/tmp/sessao-ballot-${width}x${height}.png`,animations:'disabled'});
    }
  } finally {
    await page.evaluate(()=>Promise.all(window.ballotGuests.map(room=>room.leave())));
  }
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('Voting attempted to access the microphone');
}
