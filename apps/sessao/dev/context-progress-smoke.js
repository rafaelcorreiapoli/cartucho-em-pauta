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
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Progresso QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  const install = page.getByRole('button',{name:'Pendurar retrato',exact:true});
  await install.waitFor();
  await page.evaluate(()=>{
    // Observe the short-lived progress inside the browser before starting the installation.
    const stations = document.getElementById('stations');
    const observer = new MutationObserver(()=>{
      const bar = document.getElementById('office-progress');
      if (!bar || bar.hidden || stations.hidden) return;
      const current = Number(bar.getAttribute('aria-valuenow'));
      const maximum = Number(bar.getAttribute('aria-valuemax'));
      const hasInstall = [...stations.querySelectorAll('button')].some(button=>
        button.getClientRects().length>0 && button.textContent.includes('Pendurar retrato'));
      if (current>0 && current<maximum && !hasInstall) {
        window.sawInstallationProgress = true;
        observer.disconnect();
      }
    });
    observer.observe(stations,{attributes:true,childList:true,subtree:true});
  });
  await install.click();
  await page.waitForFunction(()=>window.sawInstallationProgress===true);
  await page.getByRole('region',{name:'Ações próximas'})
    .getByRole('progressbar',{name:'Instalando decoração'}).waitFor({state:'hidden'});
  const removeFromMap = page.getByRole('button',{name:'Retirar retrato',exact:true});
  await removeFromMap.waitFor();
  const collect = page.getByRole('button',{name:'Pegar extintor',exact:true});
  await collect.waitFor();
  await page.getByRole('button',{name:'Objetos próximos',exact:true}).waitFor({state:'hidden'});
  await removeFromMap.evaluate(button=>button.setAttribute('aria-label','Rótulo original alterado'));
  await page.keyboard.press('F2');
  const shortcuts = page.locator('#action-shortcuts');
  const remove = shortcuts.getByRole('button',{name:'Retirar retrato',exact:true});
  await remove.waitFor();
  await page.keyboard.press(await remove.getAttribute('aria-keyshortcuts'));
  await shortcuts.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Rótulo original alterado',exact:true}).waitFor({state:'hidden'});
  await collect.click();
  await collect.waitFor({state:'hidden'});
  await page.keyboard.press('o');
  await page.getByRole('dialog',{name:'Inventário',exact:true}).getByRole('button',{name:'Retrato oficial',exact:true}).waitFor();
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');
}
