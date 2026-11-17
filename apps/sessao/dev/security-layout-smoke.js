// Run against Vite pointed at security-layout-smoke-server.ts, using private-call-chrome.json.
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
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Vigilância QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();

  const results = [];
  for (const [width,height] of [[1280,720],[1024,600],[800,600],[800,360]]) {
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'Consultar câmeras'}).click();
    const terminal = page.getByRole('dialog',{name:'Sala de Segurança'});
    await terminal.getByText('Ao vivo',{exact:true}).waitFor();
    await terminal.getByRole('button',{name:'Lanchonete',exact:true}).click();
    await terminal.getByRole('button',{name:'Lanchonete',exact:true,pressed:true}).waitFor();
    await terminal.getByText('Ao vivo',{exact:true}).waitFor();
    const bounds = await terminal.evaluate(dialog=>{
      const outer = dialog.getBoundingClientRect();
      const console = dialog.querySelector('.security-console');
      console.scrollTop = console.scrollHeight;
      const header = dialog.querySelector('header').getBoundingClientRect();
      return {top:outer.top,bottom:outer.bottom,left:outer.left,right:outer.right,
        scroll:console.scrollTop,dialogOverflow:dialog.scrollHeight-dialog.clientHeight,headerTop:header.top};
    });
    if (bounds.top<0 || bounds.bottom>height || bounds.left<0 || bounds.right>width ||
        bounds.headerTop<bounds.top || bounds.dialogOverflow>1 || (height===360 && bounds.scroll===0)) {
      throw Error(`Terminal em ${width}×${height}: ${JSON.stringify(bounds)}`);
    }
    await terminal.getByRole('button',{name:'Fechar terminal'}).click();
    await terminal.waitFor({state:'hidden'});
    await page.keyboard.press('v');
    const surveillance = page.getByRole('dialog',{name:'Central de Vigilância'});
    await surveillance.getByRole('button',{name:'Escutas 0'}).click();
    await surveillance.getByText('Nenhuma escuta instalada.').waitFor();
    await surveillance.getByRole('button',{name:'Fechar vigilância'}).click();
    await surveillance.waitFor({state:'hidden'});
    results.push({width,height,terminalScroll:bounds.scroll});
  }
  if (await page.evaluate(()=>window.micAttempts)) throw Error('O teste tentou abrir o microfone');
  return results;
}
