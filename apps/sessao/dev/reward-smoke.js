async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    window.micAttempts = 0;
    navigator.mediaDevices.getUserMedia = async ()=>{
      window.micAttempts++;
      throw new DOMException('Teste sem microfone','NotAllowedError');
    };
  });
  const url = page.url();
  const results = [];
  for (const {width,height,reducedMotion} of [
    {width:1280,height:720,reducedMotion:'no-preference'},
    {width:1024,height:600,reducedMotion:'reduce'},
  ]) {
    await page.setViewportSize({width,height});
    await page.emulateMedia({reducedMotion});
    await page.goto(url);
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Recompensas QA');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    await page.locator('#session[data-phase="negotiation"]').waitFor();

    const animation = reducedMotion==='reduce' ? 'wallet-fade' : 'wallet-rise';
    async function observeGain(selector,text,trigger) {
      await page.evaluate(selector=>{
        const effects = document.querySelector('#wallet-effects');
        window.pendingReward = new Promise((resolve,reject)=>{
          const observer = new MutationObserver(()=>{
            const element = effects.querySelector(selector);
            if (!element) return;
            observer.disconnect();
            clearTimeout(timeout);
            try {
              resolve(sampleGain(element));
            } catch (error) {
              reject(error);
            }
          });
          observer.observe(effects,{childList:true,subtree:true});
          const timeout = setTimeout(()=>{
            observer.disconnect();
            reject(Error('Efeito de recompensa não apareceu.'));
          },15_000);
        });
        function sampleGain(element) {
          const box = element.getBoundingClientRect();
          const map = document.querySelector('#wallet-effects').getBoundingClientRect();
          const playback = element.getAnimations()[0];
          if (!playback) throw Error('Animação ausente.');
          const {endTime} = playback.effect.getComputedTiming();
          playback.pause();
          playback.currentTime = 0;
          const start = element.getBoundingClientRect();
          playback.currentTime = endTime*.8;
          const end = element.getBoundingClientRect();
          const lift = start.top-end.top;
          const fade = Number(getComputedStyle(element).opacity);
          playback.play();
          const {animationName,left,top} = getComputedStyle(element);
          return {
            text:element.textContent,animationName,anchored:!!element.style.left && !!element.style.top,
            inMap:box.left>=map.left && box.right<=map.right && box.top>=map.top && box.bottom<=map.bottom,
            lift,fade,left,top,
          };
        }
      },selector);
      await trigger();
      const gain = await page.evaluate(()=>window.pendingReward);
      const movedCorrectly = reducedMotion==='reduce' ? gain.lift===0 : gain.lift>0;
      if (gain.text!==text || gain.animationName!==animation || !gain.anchored || !gain.inMap ||
          !movedCorrectly || !(gain.fade>0 && gain.fade<1)) {
        throw Error('Efeito incorreto: '+JSON.stringify(gain));
      }
      await page.locator('#wallet-effects').locator(selector).waitFor({state:'detached'});
      return gain;
    }

    const xp = await observeGain('.xp-gain','+20 XP',()=>
      page.getByRole('button',{name:'Beber café'}).click());

    await page.getByRole('button',{name:'Aplicar verba',exact:true}).click();
    await page.getByRole('button',{name:'Desviar R$ 30 mil',exact:true}).click();
    const income = await observeGain('.wallet-gain:not(.xp-gain)','+R$ 30 mil',()=>
      page.getByRole('button',{name:'Aplicar verba de R$ 40 mil',exact:true}).click());
    if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O jogo solicitou o microfone.');
    results.push({width,height,reducedMotion,xp,income});
  }
  return results;
}
