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
  await page.keyboard.press('i');
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
