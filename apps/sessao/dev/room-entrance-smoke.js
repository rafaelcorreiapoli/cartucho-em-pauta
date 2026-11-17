async page => {
  const base = page.url();
  await page.context().addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new Error('QA sem microfone'); };
  });
  await page.goto(base);
  const nick = page.getByRole('textbox',{name:'Seu nick'});
  await nick.fill('!!!');
  await page.getByRole('button',{name:'Criar sala'}).click();
  if (await nick.evaluate(input=>input.validity.valid)) throw new Error('Nick inválido aceito');
  await nick.fill('  Rafa   QA  ');
  await page.getByRole('button',{name:'Criar sala'}).click();
  const inviteField = page.getByRole('textbox',{name:'Link da sala'});
  await inviteField.waitFor();
  const invite = await inviteField.inputValue();
  const code = new URL(invite).searchParams.get('sala');
  if (!code) throw new Error('Convite sem código');

  const guest = await page.context().newPage();
  try {
    await guest.goto(invite);
    const guestNick = guest.getByRole('textbox',{name:'Seu nick'});
    const guestCode = guest.getByRole('textbox',{name:'Código da sala'});
    if (await guestCode.inputValue()!==code) throw new Error('Código do convite não preenchido');
    if (await guestNick.inputValue()!=='Rafa QA') throw new Error('Nick normalizado não restaurado');
    await guestCode.press('Enter');
    await guest.getByRole('status').filter({hasText:'Esse nick já está em uso'}).waitFor();
    if (!await guestNick.evaluate(input=>input===document.activeElement)) throw new Error('Nick não recebeu foco');
    await guestNick.fill('Convidada QA');
    await guest.getByRole('button',{name:'Entrar',exact:true}).click();
    await guest.getByRole('textbox',{name:'Link da sala'}).waitFor();
    if (await guest.getByRole('textbox',{name:'Link da sala'}).inputValue()!==invite) throw new Error('Convidada entrou na sala errada');
  } finally {
    await guest.close();
  }
  return {code,joined:true,duplicateNickRejected:true};
}
