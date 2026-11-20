async page => {
  await page.goto(new URL('/dev/cassation-result-preview.html',page.url()).href);
  const result = page.locator('#cassation-reveal-dialog');
  for (const [width,height] of [[1280,720],[390,640],[800,600]]) {
    await page.setViewportSize({width,height});
    for (const role of ['Infiltrado','Parlamentar',undefined]) {
      await page.evaluate(()=>window.showBallot());
      const before = await page.locator('#legislative-dock .cassation-ballot').boundingBox();
      await page.evaluate(role=>window.showResult(role),role);
      for (const time of [0,600,1200,2100,3000,6600]) {
        await result.evaluate((dialog,time)=>{
          for (const animation of dialog.getAnimations({subtree:true})) {
            animation.pause();
            animation.currentTime = time;
          }
        },time);
        const after = await result.boundingBox();
        if (['x','y','width','height'].some(key=>Math.abs(before[key]-after[key])>1)) {
          throw Error(`Panel shifted at ${width}×${height}, ${role}, ${time}ms: ${JSON.stringify({before,after})}`);
        }
        if (time===600) {
          const fade = await result.evaluate(dialog=>({
            old:Number(getComputedStyle(dialog.querySelector('.cassation-ballot-snapshot')).opacity),
            next:Number(getComputedStyle(dialog.querySelector('.cassation-reveal')).opacity),
          }));
          if (fade.old<=0 || fade.old>=1 || fade.next!==0) throw Error('Expected ballot fade out before result fade in');
        }
        if (role && time===3000) {
          const filter = await result.locator('.cassation-reveal .portrait').evaluate(face=>getComputedStyle(face).filter);
          if (filter==='grayscale(0)' || filter==='grayscale(1)') throw Error('Portrait should be losing color gradually: '+filter);
        }
      }
      if (role) {
        await result.getByText(role==='Infiltrado' ? 'Era infiltrado.' : 'Não era infiltrado.',{exact:true}).waitFor();
        const filter = await result.locator('.cassation-reveal .portrait').evaluate(face=>getComputedStyle(face).filter);
        if (filter!=='grayscale(1)') throw Error('Portrait did not become black and white: '+filter);
      }
      const overflow = await result.evaluate(dialog=>{
        const layer=dialog.querySelector('.cassation-result-layer');
        const button=dialog.querySelector('.cassation-reveal button').getBoundingClientRect();
        const bounds=dialog.getBoundingClientRect();
        return layer.scrollWidth>layer.clientWidth+1 || button.bottom>bounds.bottom;
      });
      if (overflow) throw Error('Result overflowed the fixed ballot panel');
      if (role==='Parlamentar') await page.screenshot({path:`output/playwright/cassation-result-${width}.png`});
      await result.getByRole('button',{name:'Continuar',exact:true}).click();
      await result.waitFor({state:'hidden'});
      await page.evaluate(()=>new Promise(requestAnimationFrame));
    }
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.evaluate(()=>{window.showBallot();window.showResult('Infiltrado',true);});
  await result.getByRole('button',{name:'Continuar',exact:true}).waitFor();
  if (await result.locator('.cassation-reveal').evaluate(node=>node.getAnimations({subtree:true}).length)) throw Error('Reduced motion still animates');
  if (await page.locator('#session-finale').isVisible()) throw Error('Finale interrupted the reveal');
  await result.getByRole('button',{name:'Continuar',exact:true}).click();
  await page.locator('#session-finale').waitFor({state:'visible'});
  return {stablePanel:true,resolutions:3,roles:2,noElimination:true,reducedMotion:true,finaleQueued:true};
}
