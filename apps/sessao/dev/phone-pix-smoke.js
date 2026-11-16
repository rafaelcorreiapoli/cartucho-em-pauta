// Run with the Pix smoke server and the muted Chrome configuration.
async page => {
  await page.context().addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async()=>{throw new DOMException('QA sem microfone','NotAllowedError');};
  });
  await page.reload();
  const receiver = await page.context().newPage();
  const dialog = '#gameplay-dialog';
  try {
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Alice');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
    const code = (await page.locator('#room-label').textContent()).trim().split(' ')[1];
    await receiver.goto(page.url());
    await receiver.getByRole('textbox',{name:'Seu nick'}).fill('Bia');
    await receiver.getByRole('textbox',{name:'Código da sala'}).fill(code);
    await receiver.getByRole('button',{name:'Entrar',exact:true}).click();
    await receiver.locator('#lobby-back').waitFor();
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    for (const client of [page,receiver]) await client.locator('#session[data-phase=negotiation]').waitFor();
    await page.getByRole('button',{name:'Objetos próximos',exact:true}).click();
    await page.getByRole('button',{name:'Pegar Café',exact:true}).click();
    await page.keyboard.press('o');
    const bag = page.locator(dialog);
    await bag.getByRole('button',{name:'Café',exact:true}).click();
    await bag.getByLabel('Jogador').selectOption({label:'Bia'});
    await bag.getByRole('button',{name:'Oferecer',exact:true}).click();
    await receiver.locator('#object-request').getByRole('button',{name:'Aceitar',exact:true}).click();
    await bag.getByRole('button',{name:'Café',exact:true}).waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await receiver.keyboard.press('o');
    await receiver.locator(dialog).getByRole('button',{name:'Café',exact:true}).waitFor();
    await receiver.keyboard.press('Escape');
    for (const client of [page,receiver]) {
      await client.keyboard.press('c');
      await client.locator(dialog).getByRole('button',{name:'Pix',exact:true}).click();
      await client.locator(dialog).locator('.pix-balance').getByText('R$ 80 mil',{exact:true}).waitFor();
    }
    if (await page.locator('#trade-dock, #trade-contact').count()) throw Error('Legacy transfer controls are still mounted');
    for (const form of ['#cabinet-form','#hearing-form']) {
      if (!await page.locator('#institutional-dock '+form).count()) throw Error('Missing institutional action: '+form);
    }
    const pix = page.locator(dialog).getByRole('region',{name:'Transferência Pix'});
    await pix.getByRole('button',{name:'Bia',exact:true}).click();
    await page.keyboard.press('5');
    await pix.locator('.pix-balance').getByText('R$ 70 mil',{exact:true}).waitFor();

    await receiver.locator(dialog).locator('.pix-balance').getByText('R$ 90 mil',{exact:true}).waitFor();
    await receiver.getByText('Pix recebido',{exact:true}).waitFor();
    if (await page.getByText('Pix recebido',{exact:true}).count()) throw Error('Sender received the private Pix notification');

    await receiver.locator(dialog).getByRole('button',{name:'Fechar aplicativo'}).click();
    await receiver.locator(dialog).getByRole('button',{name:'Fechar',exact:true}).click();
    await receiver.locator(dialog).waitFor({state:'hidden'});
    await receiver.locator('#map').focus();
    await receiver.keyboard.down('ArrowDown');
    await receiver.waitForTimeout(900);
    await receiver.keyboard.up('ArrowDown');
    await page.keyboard.press('5');
    await pix.locator('.pix-balance').getByText('R$ 60 mil',{exact:true}).waitFor();
    await page.locator(dialog).getByRole('button',{name:'Fechar aplicativo'}).click();
    await receiver.keyboard.press('c');
    for (const client of [page,receiver]) {
      await client.locator(dialog).getByRole('button',{name:'Correio',exact:true}).click();
    }
    const mail = page.locator(dialog).locator('#phone-mail');
    await mail.getByRole('button',{name:'Novo comunicado'}).click();
    await mail.getByLabel('Assunto').fill('Aviso do Cafezinho');
    await mail.getByLabel('Mensagem').fill('Enviado pelo celular');
    await mail.getByRole('button',{name:/^Publicar/}).click();
    await receiver.locator(dialog).getByRole('heading',{name:'Aviso do Cafezinho'}).waitFor();
  } finally {
    await receiver.close();
  }
}
