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
  await install.click();
  const stations = page.getByRole('region',{name:'Ações próximas'});
  const progress = stations.getByRole('progressbar',{name:'Instalando decoração'});
  await progress.waitFor();
  await install.waitFor({state:'hidden'});
  await page.waitForFunction(()=>{
    const bar = document.getElementById('office-progress');
    return bar && Number(bar.getAttribute('aria-valuenow'))>0 &&
      Number(bar.getAttribute('aria-valuenow'))<Number(bar.getAttribute('aria-valuemax'));
  });
  await progress.waitFor({state:'hidden'});
  await page.getByRole('button',{name:'Retirar retrato',exact:true}).waitFor();
  if (await page.evaluate(()=>window.micAttempts)!==0) throw Error('O fluxo tentou usar o microfone');
}
