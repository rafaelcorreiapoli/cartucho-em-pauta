async page => {
  const url = page.url();
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new DOMException('QA sem microfone','NotAllowedError'); };
  });
  await page.goto(url);
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Atalhos QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  await page.getByRole('button',{name:'Aplicativos',exact:true}).click();
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
  if (await page.locator('#open-settings').isVisible()) throw Error('Botão avulso de configurações durante a partida');
  const launcher = page.getByRole('button',{name:'Aplicativos',exact:true});
  if (await launcher.getAttribute('aria-expanded')==='false') await launcher.click();
  for (const [name,key] of [['Equipamentos','E'],['Personagem','P'],['Celular','C'],['Microfone','M'],['Configurações','K']]) {
    const app = page.locator('#congress-app-panel').getByRole('button',{name,exact:true});
    if (await app.getAttribute('aria-keyshortcuts')!==key) throw Error('Atalho ausente: '+name);
  }
  await page.keyboard.press('Escape');
  await page.keyboard.press('k');
  const settings = page.getByRole('dialog',{name:'Configurações'});
  await settings.waitFor();
  await settings.getByRole('button',{name:'Fechar configurações'}).click();
  await settings.waitFor({state:'hidden'});
  await page.keyboard.press('k');
  await settings.waitFor();
  await page.keyboard.press('Escape');
  await settings.waitFor({state:'hidden'});
  await page.keyboard.press('p');
  const attributes = page.getByRole('dialog',{name:/Atributos/i});
  await attributes.waitFor();
  await page.keyboard.press('F2');
  await palette.waitFor();
  const closeAction = palette.locator('.shortcut-list button').filter({hasText:'Fechar'});
  const key = await closeAction.getAttribute('aria-keyshortcuts');
  await page.keyboard.press(key);
  await palette.waitFor({state:'hidden'});
  await attributes.waitFor({state:'hidden'});
}
