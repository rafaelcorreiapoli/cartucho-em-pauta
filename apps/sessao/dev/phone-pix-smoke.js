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
  async function runShortcut(client, original, name) {
    await original.evaluate(button=>button.setAttribute('aria-label','Rótulo original alterado'));
    await client.keyboard.press('F2');
    await client.locator('#action-shortcuts').getByRole('button',{name,exact:false}).click();
  }
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
    const originalViewport = page.viewportSize();
    await page.setViewportSize({width:640,height:360});
    await page.keyboard.press('l');
    await polls.getByRole('progressbar',{name:'Intenção de voto de Bia'}).waitFor();
    const layout = await polls.evaluate(dialog=>{
      const body = dialog.querySelector('.election-poll-content');
      const header = dialog.querySelector('header');
      const start = header.getBoundingClientRect().top;
      body.scrollTop = body.scrollHeight;
      return {headerTop:header.getBoundingClientRect().top,headerPinned:start===header.getBoundingClientRect().top,
        bottom:dialog.getBoundingClientRect().bottom,lastPollBottom:body.querySelector('li:last-child').getBoundingClientRect().bottom};
    });
    if (!layout.headerPinned || layout.headerTop<0 || layout.bottom>360 || layout.lastPollBottom>layout.bottom) {
      throw Error('Pesquisa eleitoral cortada: '+JSON.stringify(layout));
    }
    const palette = page.locator('#action-shortcuts');
    await page.keyboard.press('F2');
    await palette.getByRole('button',{name:'Fechar pesquisa eleitoral'}).click();
    await polls.waitFor({state:'hidden'});
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
    const accept = receiver.locator('#object-request').getByRole('button',{name:'Aceitar',exact:true});
    await accept.evaluate(button=>button.setAttribute('aria-label','Aceite original alterado'));
    await receiver.keyboard.press('F2');
    const acceptShortcut = receiver.locator('#action-shortcuts').getByRole('button',{name:'Aceitar',exact:true});
    await acceptShortcut.waitFor();
    await receiver.keyboard.press(await acceptShortcut.getAttribute('aria-keyshortcuts'));
    await receiver.locator('#object-request').waitFor({state:'hidden'});
    await bag.getByRole('button',{name:'Café',exact:true}).waitFor({state:'hidden'});
    await page.keyboard.press('Escape');
    await receiver.keyboard.press('o');
    await receiver.locator(dialog).getByRole('button',{name:'Café',exact:true}).waitFor();
    await receiver.keyboard.press('Escape');

    await page.keyboard.press('c');
    await page.locator(dialog).getByRole('button',{name:'Câmera',exact:true}).waitFor();
    await page.keyboard.press('3');
    await page.locator(dialog).getByRole('button',{name:'Tirar foto',exact:true}).click();
    const openAlbum = page.locator(dialog).getByRole('button',{name:/Abrir álbum · 1\//});
    await openAlbum.click();
    await page.locator(dialog).getByRole('button',{name:/Abrir fotografia/}).click();
    await page.locator(dialog).getByRole('button',{name:'Bia',exact:true}).click();
    await runShortcut(page,page.locator(dialog).getByRole('button',{name:'Enviar cópia',exact:true}),'Enviar cópia');
    const photoRequest = receiver.locator('#object-request');
    await runShortcut(receiver,photoRequest.getByRole('button',{name:'Aceitar',exact:true}),'Aceitar fotografia');
    await photoRequest.waitFor({state:'hidden'});
    await receiver.keyboard.press('c');
    await receiver.keyboard.press('4');
    await receiver.locator(dialog).getByRole('button',{name:/Abrir fotografia/}).click();
    await receiver.locator(dialog).getByText('Cópia verificada',{exact:true}).waitFor();
    await receiver.locator(dialog).getByRole('img',{name:/Foto em/}).waitFor();
    await receiver.keyboard.press('Escape');
    await page.keyboard.press('Escape');
    for (const client of [page,receiver]) await client.locator(dialog).waitFor({state:'hidden'});

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
    await runShortcut(page,mail.getByRole('button',{name:'Novo comunicado'}),'Novo comunicado');
    await mail.getByLabel('Assunto').fill('Aviso do Cafezinho');
    await mail.getByLabel('Mensagem').fill('Enviado pelo celular');
    await mail.getByRole('button',{name:'Selecionar anexo'}).click();
    await mail.getByRole('button',{name:'Projeto de teste',exact:true}).click();
    const publish = mail.getByRole('button',{name:/^Publicar/});
    await publish.evaluate(button=>{
      button.removeAttribute('aria-keyshortcuts');
      button.focus();
    });
    await page.keyboard.press('1');
    const receivedMail = receiver.locator(dialog).locator('#phone-mail');
    await receivedMail.getByRole('heading',{name:'Aviso do Cafezinho'}).waitFor();
    await runShortcut(receiver,receivedMail.getByRole('button',{name:'Realizar perícia'}),'Realizar perícia · Aviso do Cafezinho');
    await runShortcut(receiver,receivedMail.getByRole('button',{name:'Consumir kit'}),'Consumir kit · Aviso do Cafezinho');
    await receivedMail.getByText(/VERDADEIRO/).waitFor();
    if (await mail.getByText(/VERDADEIRO/).count()) throw Error('O laudo privado vazou para outro jogador');
    await runShortcut(receiver,receivedMail.getByRole('button',{name:'Encaminhar'}),'Encaminhar · Aviso do Cafezinho');
    await receivedMail.getByLabel('Mensagem').fill('Encaminhado após perícia');
    await receivedMail.getByRole('button',{name:/^Publicar/}).focus();
    await receiver.keyboard.press('1');
    await mail.getByRole('heading',{name:'Enc: Aviso do Cafezinho',exact:true}).waitFor();
    await mail.getByText('Encaminhado após perícia',{exact:true}).waitFor();

    await page.reload();
    await page.getByRole('textbox',{name:'Seu nick'}).fill('Denúncia QA');
    await page.getByRole('button',{name:'Criar sala'}).click();
    await page.getByRole('button',{name:'Iniciar sessão'}).waitFor();
    await receiver.goto(await page.getByLabel('Link da sala').inputValue());
    await receiver.getByRole('textbox',{name:'Seu nick'}).fill('Jogo QA');
    await receiver.getByRole('button',{name:'Entrar',exact:true}).click();
    await receiver.locator('#lobby-back').waitFor();
    await page.locator('#parliamentarian-count [data-count="0"]').click();
    await page.getByRole('button',{name:'Iniciar sessão'}).click();
    for (const client of [page,receiver]) await client.locator('#session[data-phase=negotiation]').waitFor();
    const denounce = page.getByRole('button',{name:'Denunciar',exact:true});
    await denounce.waitFor();
    await receiver.locator('#asset-loading').waitFor({state:'hidden'});
    await receiver.locator('#map').press('c');
    await receiver.locator(dialog).getByRole('button',{name:'Joguinhos'}).waitFor();
    await receiver.keyboard.press('2');
    await receiver.locator(dialog).getByRole('button',{name:'Snake',exact:true}).waitFor();
    await receiver.keyboard.press('1');
    await receiver.locator(dialog).getByText('Use as setas para começar',{exact:true}).waitFor();
    await page.keyboard.press('c');
    await page.locator(dialog).getByRole('button',{name:'Câmera',exact:true}).waitFor();
    await page.keyboard.press('3');
    await page.locator(dialog).getByRole('button',{name:'Tirar foto',exact:true}).click();
    await page.locator(dialog).getByRole('button',{name:/Abrir álbum · 1\//}).waitFor();
    await page.keyboard.press('Escape');
    await page.locator(dialog).waitFor({state:'hidden'});
    await denounce.click();
    const complaint = page.getByRole('dialog',{name:'Denunciar',exact:true});
    await runShortcut(page,complaint.getByRole('button',{name:'Selecionar foto',exact:true}),'Selecionar foto');
    await runShortcut(page,complaint.getByRole('button',{name:/Abrir fotografia/}),'Abrir fotografia');
    await runShortcut(page,complaint.getByRole('button',{name:/Denunciar Jogo QA/}),'Denunciar Jogo QA');
    await complaint.getByText('Nenhuma foto com irregularidades denunciáveis.',{exact:true}).waitFor();

    await receiver.keyboard.press('Escape');
    await receiver.locator(dialog).waitFor({state:'hidden'});
    await receiver.keyboard.press('c');
    await receiver.locator(dialog).getByRole('button',{name:'Correio',exact:true}).click();
    const bulletin = receivedMail.locator('article').filter({
      has:receiver.getByRole('heading',{name:'Infração confirmada · Jogo no celular',exact:true}),
    });
    await bulletin.getByText('Jogo QA perdeu popularidade após a confirmação de uma denúncia de jogo no celular.',{exact:true}).waitFor();
  } finally {
    await receiver.close();
  }
  return {electionPollClosedViaF2:true,pixAndMailReplicated:true,photoComplaintSubmittedViaF2:true,itemOfferAcceptedViaF2:true,photoCopyAcceptedViaF2:true};
}
