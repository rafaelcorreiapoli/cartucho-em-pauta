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
    const originalViewport = page.viewportSize();
    await page.setViewportSize({width:800,height:360});
    await page.keyboard.press('l');
    await receiver.keyboard.press('l');
    const bia = polls.getByRole('button',{name:'Bia',exact:true});
    await bia.locator('.portrait[data-skin]').waitFor();
    const layout = await polls.evaluate(dialog=>{
      const body = dialog.querySelector('.election-poll-content');
      const header = dialog.querySelector('header');
      const start = header.getBoundingClientRect().top;
      body.scrollTop = body.scrollHeight;
      const bottom = dialog.getBoundingClientRect().bottom;
      const confirmBottom = dialog.querySelector('#support-form button[type=submit]').getBoundingClientRect().bottom;
      return {scroll:body.scrollTop,headerTop:header.getBoundingClientRect().top,headerPinned:start===header.getBoundingClientRect().top,bottom,confirmBottom};
    });
    if (!layout.scroll || !layout.headerPinned || layout.headerTop<0 || layout.bottom>360 || layout.confirmBottom>layout.bottom) {
      throw Error('Pesquisa eleitoral cortada: '+JSON.stringify(layout));
    }
    const directKey = async key=>{
      const button = polls.locator(`button[aria-keyshortcuts="${key}"]`);
      await button.evaluate(control=>control.removeAttribute('aria-keyshortcuts'));
      await page.keyboard.press(key);
    };
    const palette = page.locator('#action-shortcuts');
    async function sendSupportThroughPalette(label) {
      const original = polls.getByRole('button',{name:label,exact:true});
      await original.evaluate(button=>button.setAttribute('aria-label','Botão original oculto do F2'));
      await page.keyboard.press('F2');
      await palette.getByRole('button',{name:new RegExp(label)}).click();
      await palette.waitFor({state:'hidden'});
    }
    await page.keyboard.press('F2');
    await palette.waitFor();
    if (await palette.getByRole('button',{name:/Declarar apoio|Retirar apoio/}).count()) {
      throw Error('O F2 ofereceu confirmação antes de mudar o apoio');
    }
    await page.keyboard.press('Escape');
    await palette.waitFor({state:'hidden'});
    await directKey('1');
    await bia.and(polls.locator('[aria-pressed="true"]')).waitFor();
    await sendSupportThroughPalette('Declarar apoio');
    await receiverPolls.getByText('Apoia Bia',{exact:true}).waitFor();
    await polls.getByText('Apoia Bia',{exact:true}).waitFor();
    await directKey('9');
    await polls.getByRole('button',{name:'Retirar apoio',exact:true}).and(polls.locator(':enabled')).waitFor();
    await sendSupportThroughPalette('Retirar apoio');
    await receiverPolls.getByText('Apoia Bia',{exact:true}).waitFor({state:'hidden'});
    for (const client of [page,receiver]) {
      await client.keyboard.press('Escape');
      await client.locator('#election-poll-dialog').waitFor({state:'hidden'});
    }
    if (originalViewport) await page.setViewportSize(originalViewport);
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
    await page.keyboard.press('c');
    await page.keyboard.press('1');
    const dial = page.locator(dialog).getByRole('button',{name:'Ligar para Bia',exact:true});
    await dial.evaluate(button=>button.setAttribute('aria-label','Contato original oculto'));
    await page.keyboard.press('F2');
    await palette.getByRole('button',{name:/Ligar para Bia/}).click();
    const decline = receiver.locator(dialog).getByRole('button',{name:'Recusar',exact:true});
    await decline.evaluate(button=>button.removeAttribute('aria-keyshortcuts'));
    await receiver.keyboard.press('2');
    await dial.waitFor();
    await page.keyboard.press('Escape');
    await receiver.keyboard.press('Escape');
    await page.locator(dialog).waitFor({state:'hidden'});
    await receiver.locator(dialog).waitFor({state:'hidden'});
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
    const transfer = pix.getByRole('button',{name:'Transferir',exact:true});
    if (!await transfer.isDisabled()) throw Error('O Pix deve exigir um destinatário');
    await page.keyboard.press('1');
    await page.keyboard.press('2');
    await pix.getByRole('button',{name:'Bia',exact:true,pressed:true}).waitFor();
    await page.keyboard.press('ArrowRight');
    await pix.getByText('R$ 20 mil',{exact:true}).waitFor();
    await page.keyboard.press('ArrowLeft');
    await pix.getByText('R$ 10 mil',{exact:true}).waitFor();
    await transfer.evaluate(button=>{
      window.syntheticPixClicks = 0;
      button.addEventListener('click',event=>{
        if (!event.isTrusted) window.syntheticPixClicks++;
      });
      button.removeAttribute('aria-keyshortcuts');
      button.setAttribute('aria-label','Transferência original oculta do F2');
    });
    await page.keyboard.press('F2');
    await palette.getByRole('button',{name:/Transferir/}).click();
    await pix.locator('.pix-balance').getByText('R$ 70 mil',{exact:true}).waitFor();
    if (await page.evaluate(()=>window.syntheticPixClicks)!==0) throw Error('O atalho simulou clique para transferir');

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
    const publish = mail.getByRole('button',{name:/^Publicar/});
    await publish.evaluate(button=>{
      button.removeAttribute('aria-keyshortcuts');
      button.focus();
    });
    await page.keyboard.press('1');
    await receiver.locator(dialog).getByRole('heading',{name:'Aviso do Cafezinho'}).waitFor();
  } finally {
    await receiver.close();
  }
  return {electionSupportDeclaredAndWithdrawnViaF2:true,pixAndMailReplicated:true};
}
