// Run with the Pix smoke server and the muted Chrome configuration.
async page => {
  await page.context().addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    Object.defineProperty(navigator.clipboard,'writeText',{value:async text=>{
      if (window.denyInviteClipboard) throw new DOMException('Clipboard indisponível','NotAllowedError');
      window.copiedInvite = text;
    }});
    navigator.mediaDevices.getUserMedia = async()=>{throw new DOMException('QA sem microfone','NotAllowedError');};
  });
  await page.reload();
  const receiver = await page.context().newPage();
  const dialog = '#gameplay-dialog';
  try {
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Alice');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
    const invite = await page.getByLabel('Link da sala').inputValue();
    const code = new URL(invite).searchParams.get('sala');
    if (!code) throw Error('O convite não contém o código da sala');
    await page.getByRole('button',{name:'Copiar link'}).click();
    await page.getByRole('button',{name:'Link copiado'}).waitFor();
    if (await page.evaluate(()=>window.copiedInvite)!==invite) throw Error('O link copiado diverge do convite');
    await page.evaluate(()=>{window.denyInviteClipboard = true;});
    await page.locator('#lobby-copy-invite').click();
    await page.waitForFunction(value=>{
      const input = document.querySelector('#lobby-invite-url');
      return input.value.slice(input.selectionStart,input.selectionEnd)===value;
    },invite);
    await receiver.goto(invite);
    await receiver.getByRole('textbox',{name:'Seu nick'}).fill('Bia');
    if (await receiver.getByRole('textbox',{name:'Código da sala'}).inputValue()!==code) throw Error('O convite não preenche a sala');
    await receiver.getByRole('button',{name:'Entrar',exact:true}).click();
    await receiver.locator('#lobby-back').waitFor();
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    for (const client of [page,receiver]) await client.locator('#session[data-phase=negotiation]').waitFor();
    await page.getByLabel('Link da sala').waitFor({state:'hidden'});
    const polls = page.locator('#election-poll-dialog');
    const receiverPolls = receiver.locator('#election-poll-dialog');
    await page.keyboard.press('l');
    await receiver.keyboard.press('l');
    const bia = polls.getByRole('button',{name:'Bia',exact:true});
    await bia.locator('.portrait[data-skin]').waitFor();
    await page.keyboard.press('1');
    await bia.and(polls.locator('[aria-pressed="true"]')).waitFor();
    await page.keyboard.press('0');
    await receiverPolls.getByText('Apoia Bia',{exact:true}).waitFor();
    await polls.getByText('Apoia Bia',{exact:true}).waitFor();
    await page.keyboard.press('9');
    await polls.getByRole('button',{name:'Retirar apoio',exact:true}).and(polls.locator(':enabled')).waitFor();
    await page.keyboard.press('0');
    await receiverPolls.getByText('Apoia Bia',{exact:true}).waitFor({state:'hidden'});
    for (const client of [page,receiver]) {
      await client.keyboard.press('Escape');
      await client.locator('#election-poll-dialog').waitFor({state:'hidden'});
    }
    const nearby = page.getByRole('button',{name:'Objetos próximos',exact:true});
    await nearby.waitFor();
    const nearbyKey = await nearby.getAttribute('aria-keyshortcuts');
    if (!nearbyKey) throw Error('Objetos próximos sem atalho');
    await page.keyboard.press(nearbyKey);
    const coffee = page.getByRole('button',{name:'Pegar Café',exact:true});
    await coffee.waitFor();
    await page.keyboard.press('Escape');
    await coffee.waitFor({state:'hidden'});
    await page.keyboard.press(await nearby.getAttribute('aria-keyshortcuts'));
    await coffee.waitFor();
    await page.keyboard.press(await coffee.getAttribute('aria-keyshortcuts'));
    await nearby.waitFor({state:'hidden'});
    await page.keyboard.press('o');
    const bag = page.locator(dialog);
    await bag.getByRole('button',{name:'Café',exact:true}).click();
    const bind = bag.getByRole('button',{name:'Vincular ao slot 1',exact:true});
    await page.keyboard.press('Shift+1');
    await bind.and(bag.locator('[aria-pressed="true"]')).waitFor();
    const use = bag.getByRole('button',{name:'Beber',exact:true});
    if (await use.getAttribute('aria-keyshortcuts')!=='1') throw Error('O primeiro atalho do item deve ser 1');
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
    if (!await page.locator('#institutional-dialog #institutional-actions').count()) throw Error('Missing institutional panel');
    if (await page.locator('#cabinet-form,#hearing-form').count()) throw Error('Institutional actions should require station proximity');
    const pix = page.locator(dialog).getByRole('region',{name:'Transferência Pix'});
    const cashReward = await receiver.locator('[aria-label="Objetivos ativos"]')
      .getByText('Receba dinheiro de outro parlamentar',{exact:true}).count();
    await pix.getByRole('button',{name:'Bia',exact:true}).click();
    await page.keyboard.press('1');
    await pix.locator('.pix-balance').getByText('R$ 70 mil',{exact:true}).waitFor();

    const receivedBalance = receiver.locator(dialog).locator('.pix-balance');
    await receivedBalance.getByText(cashReward ? 'R$ 110 mil' : 'R$ 90 mil',{exact:true}).waitFor();
    await receiver.getByText('Pix recebido',{exact:true}).waitFor();
    if (await page.getByText('Pix recebido',{exact:true}).count()) throw Error('Sender received the private Pix notification');

    await receiver.locator(dialog).getByRole('button',{name:'Fechar aplicativo'}).click();
    await receiver.locator(dialog).getByRole('button',{name:'Fechar',exact:true}).click();
    await receiver.locator(dialog).waitFor({state:'hidden'});
    await receiver.locator('#map').focus();
    await receiver.keyboard.down('ArrowDown');
    await receiver.waitForTimeout(900);
    await receiver.keyboard.up('ArrowDown');
    await page.keyboard.press('1');
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
