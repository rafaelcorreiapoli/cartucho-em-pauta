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
  await page.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click();

  const results = [];
  const shortcuts = page.locator('#action-shortcuts');
  for (const [width,height] of [[1280,720],[1024,600],[800,600],[800,360]]) {
    await page.setViewportSize({width,height});
    await page.getByRole('button',{name:'Consultar câmeras'}).click();
    const terminal = page.getByRole('dialog',{name:'Sala de Segurança'});
    await terminal.getByText('Ao vivo',{exact:true}).waitFor();
    const snacks = terminal.getByRole('button',{name:'Lanchonete',exact:true});
    if (height===360) {
      await snacks.evaluate(button=>button.setAttribute('aria-label','Rótulo original alterado'));
      await page.keyboard.press('F2');
      await shortcuts.getByRole('button',{name:'Lanchonete',exact:true}).click();
      await terminal.getByRole('button',{name:'Rótulo original alterado',pressed:true}).waitFor();
    } else {
      await snacks.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
      await page.keyboard.press('6');
      await terminal.getByRole('button',{name:'Lanchonete',exact:true,pressed:true}).waitFor();
    }
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
    const closeTerminal = terminal.getByRole('button',{name:'Fechar terminal'});
    if (height===360) {
      await closeTerminal.evaluate(button=>button.setAttribute('aria-label','Fechamento original alterado'));
      await page.keyboard.press('F2');
      await shortcuts.getByRole('button',{name:'Fechar terminal',exact:true}).click();
    } else {
      await closeTerminal.click();
    }
    await terminal.waitFor({state:'hidden'});
    await page.keyboard.press('v');
    const surveillance = page.getByRole('dialog',{name:'Central de Vigilância'});
    await surveillance.getByRole('button',{name:'Escutas 0'}).click();
    await surveillance.getByText('Nenhuma escuta instalada.').waitFor();
    await surveillance.getByRole('button',{name:'Fechar vigilância'}).click();
    await surveillance.waitFor({state:'hidden'});
    results.push({width,height,terminalScroll:bounds.scroll});
  }
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('button',{name:'Consultar câmeras'}).click();
  const coverage=page.getByRole('dialog',{name:'Sala de Segurança'});
  for (const [label,width,height] of [['Apoio Técnico',223,87],['Tesouraria',266,122],['Lanchonete',126,122]]) {
    await coverage.getByRole('button',{name:label==='Lanchonete' ? /Lanchonete|Rótulo original alterado/ : label,exact:true}).click();
    await coverage.getByText('Ao vivo',{exact:true}).waitFor();
    await page.waitForFunction(({width,height})=>{
      const canvas=document.querySelector('#security-dialog canvas');
      return canvas?.width===width*4 && canvas?.height===height*4;
    },{width,height});
  }
  await coverage.getByRole('button',{name:/Fechar terminal|Fechamento original alterado/}).click();
  await coverage.waitFor({state:'hidden'});
  await page.keyboard.press('v');
  const surveillance = page.getByRole('dialog',{name:'Central de Vigilância'});
  const viewport = surveillance.getByLabel('Visão ao vivo da câmera');
  const canvas = viewport.locator('canvas');
  async function useShortcut(button) {
    await button.waitFor();
    const key = await button.evaluate(control=>{
      const shortcut = control.getAttribute('aria-keyshortcuts') ?? control.querySelector('kbd')?.textContent;
      control.removeAttribute('aria-keyshortcuts');
      return shortcut;
    });
    if (!key) throw Error('Controle da vigilância sem atalho');
    await page.keyboard.press(key);
  }
  async function usePalette(button,label) {
    await button.evaluate(control=>control.setAttribute('aria-label','Controle original oculto do F2'));
    await page.keyboard.press('F2');
    const palette = page.locator('#action-shortcuts');
    const action = palette.getByRole('button',{name:new RegExp(label)});
    if (!await action.count()) await page.keyboard.press('ArrowRight');
    await action.click();
    await palette.waitFor({state:'hidden'});
  }
  async function openCamera(name,previousCanvas) {
    const button = surveillance.getByRole('button',{name:new RegExp(name)});
    if (previousCanvas) await usePalette(button,name);
    else await useShortcut(button);
    await surveillance.getByRole('heading',{name,exact:true}).waitFor();
    if (previousCanvas) await previousCanvas.waitFor({state:'detached'});
    await surveillance.locator('.spy-viewport[aria-busy="false"]').waitFor();
    await canvas.waitFor();
    if (await canvas.count()!==1) throw Error('Mais de um canvas na câmera '+name);
    // The shared map renderer can use WebGL. Read the displayed pixels through
    // Playwright rather than requesting an incompatible 2D context from its canvas.
    const screenshot = await canvas.screenshot({scale:'css'});
    const hasScene = await page.evaluate(async encoded=>{
      const image = new Image();
      image.src = 'data:image/png;base64,'+encoded;
      await image.decode();
      const sample = document.createElement('canvas');
      sample.width = image.width;
      sample.height = image.height;
      const context = sample.getContext('2d');
      context.drawImage(image,0,0);
      const pixels = context.getImageData(0,0,sample.width,sample.height).data;
      for (let index=4;index<pixels.length;index+=64) {
        if (pixels[index]!==pixels[0] || pixels[index+1]!==pixels[1] || pixels[index+2]!==pixels[2]) return true;
      }
      return false;
    },screenshot.toString('base64'));
    if (!hasScene) throw Error('Primeiro quadro sem cenário na câmera '+name);
  }
  async function markCanvas(id) {
    const channel = await canvas.evaluate((node,mark)=>{
      node.dataset.testCanvas = mark;
      return node.parentElement.dataset.channel;
    },id);
    // Phaser can reuse the same canvas element when a different channel opens.
    return page.locator(`.spy-viewport[data-channel="${channel}"] canvas[data-test-canvas="${id}"]`);
  }
  await openCamera('Câmera Cafezinho');
  const first = await markCanvas('first');
  await openCamera('Câmera Biblioteca',first);
  await usePalette(surveillance.getByRole('button',{name:'Fotografar',exact:true}),'Fotografar');
  await page.getByText('Foto guardada no álbum.',{exact:true}).waitFor();
  await usePalette(surveillance.getByRole('button',{name:'Renomear',exact:true}),'Renomear');
  await surveillance.getByRole('textbox',{name:'Nome do canal'}).fill('Biblioteca QA');
  await usePalette(surveillance.getByRole('button',{name:'Salvar',exact:true}),'Salvar');
  await surveillance.getByRole('heading',{name:'Biblioteca QA',exact:true}).waitFor();
  await useShortcut(surveillance.getByRole('button',{name:'Fechar canal'}));
  await viewport.waitFor({state:'detached'});
  await openCamera('Câmera Cafezinho');
  const reopened = await markCanvas('reopened');
  await surveillance.getByRole('button',{name:'Fechar vigilância'}).click();
  await surveillance.waitFor({state:'hidden'});
  await reopened.waitFor({state:'detached'});
  await page.keyboard.press('v');
  await surveillance.getByText('Selecione um canal.').waitFor();
  if (await viewport.count()) throw Error('Monitor reabriu com a câmera anterior');

  // Native close events are queued. Reopen and select again before that event fires.
  await surveillance.evaluate(dialog=>{
    const press = key=>document.activeElement.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
    dialog.close();
    press('v');
    if (!dialog.open) throw Error('A Vigilância não reabriu');
    dialog.querySelector('.spy-channel[aria-keyshortcuts="1"]')?.removeAttribute('aria-keyshortcuts');
    press('1');
  });
  await surveillance.getByRole('heading',{name:'Câmera Cafezinho',exact:true}).waitFor();
  await canvas.waitFor();


  if (await page.evaluate(()=>window.micAttempts)) throw Error('O teste tentou abrir o microfone');
  return results;
}
