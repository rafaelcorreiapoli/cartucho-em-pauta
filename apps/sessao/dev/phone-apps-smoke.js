// Run against a local solo server using dev/private-call-chrome.json.
async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{ throw new DOMException('QA sem microfone','NotAllowedError'); };
  });
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Celular QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase=negotiation]').waitFor();
  await page.keyboard.press('c');
  const dialog = page.locator('#gameplay-dialog');
  const home = async()=>{
    await dialog.getByRole('button',{name:'Fechar aplicativo'}).click();
    await dialog.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  };
  await dialog.getByRole('button',{name:'Telefone',exact:true}).waitFor();
  const viewport = page.viewportSize();
  await page.setViewportSize({width:800,height:450});
  await dialog.evaluate(async phone=>{ await Promise.all(phone.getAnimations().map(animation=>animation.finished)); });
  const phoneFrame = await dialog.boundingBox();
  for (const app of await dialog.locator('#phone-apps').getByRole('button').all()) {
    const bounds = await app.boundingBox();
    if (!phoneFrame || !bounds || bounds.y<phoneFrame.y || bounds.y+bounds.height>phoneFrame.y+phoneFrame.height-8) {
      throw Error('Aplicativo fora da tela do telefone em 800×450');
    }
  }
  const pixApp = dialog.getByRole('button',{name:'Pix',exact:true});
  const pixKey = await pixApp.getAttribute('aria-keyshortcuts');
  await pixApp.evaluate(button=>{
    window.syntheticPhoneClicks = 0;
    button.addEventListener('click',event=>{
      if (!event.isTrusted) window.syntheticPhoneClicks++;
    });
    button.removeAttribute('aria-keyshortcuts');
  });
  await page.keyboard.press(pixKey);
  await dialog.getByRole('heading',{name:'Pix',exact:true}).waitFor();
  if (await page.evaluate(()=>window.syntheticPhoneClicks)!==0) throw Error('O atalho do Pix simulou clique');
  await home();
  await page.setViewportSize(viewport);
  if (await dialog.locator('#phone-apps').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length)!==3) throw Error('Grade de apps');
  await page.screenshot({animations:'disabled',path:'/tmp/sessao-exploration-phone.png'});
  const palette = page.locator('#action-shortcuts');
  const viaPalette = async (button,label)=>{
    await button.evaluate(node=>node.setAttribute('aria-label','Controle original oculto'));
    await page.keyboard.press('F2');
    await palette.getByRole('button',{name:new RegExp(label)}).click();
    await palette.waitFor({state:'hidden'});
  };
  await viaPalette(dialog.getByRole('button',{name:'Câmera',exact:true}),'Câmera');
  await dialog.getByRole('heading',{name:'Câmera',exact:true}).waitFor();
  await viaPalette(dialog.getByRole('button',{name:'Selfie',exact:true}),'Selfie');
  await dialog.locator('.camera-selfie-portrait').waitFor();
  await home();
  await page.keyboard.press('2');
  await dialog.getByRole('heading',{name:'Joguinhos',exact:true}).waitFor();
  const games = dialog.locator('.phone-games-menu');
  const removeKey = button=>button.evaluate(node=>node.removeAttribute('aria-keyshortcuts'));
  for (const name of ['Snake','Combina Doces','Bets']) {
    await games.getByRole('button',{name,exact:true}).locator('.phone-app-icon').waitFor();
  }
  await removeKey(games.getByRole('button',{name:'Snake',exact:true}));
  await page.keyboard.press('1');
  await dialog.locator('.phone-snake canvas').waitFor();
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await page.keyboard.press('ArrowLeft');
  await dialog.getByText('Use as setas para começar',{exact:true}).waitFor();
  await page.keyboard.press('ArrowRight');
  await dialog.getByText('1 / 5 frutas',{exact:true}).waitFor();
  await dialog.getByText('Fim de jogo',{exact:true}).waitFor();
  const board = await dialog.getByRole('img',{name:'Tabuleiro do Snake'}).boundingBox();
  const replay = await dialog.getByRole('button',{name:'Jogar de novo'}).boundingBox();
  if (!board || !replay || Math.abs(board.x-replay.x)>1 || Math.abs(board.width-replay.width)>1 || replay.y<=board.y+board.height) {
    throw Error('Botão de reinício desalinhado com o tabuleiro');
  }
  await removeKey(dialog.getByRole('button',{name:'Jogar de novo'}));
  await page.keyboard.press('1');
  await dialog.getByText('0 / 5 frutas',{exact:true}).waitFor();
  await dialog.evaluate(node=>{
    window.snakePhoneClosed = new Promise(resolve=>node.addEventListener('close',resolve,{once:true}));
  });
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.snakePhoneClosed);
  await dialog.waitFor({state:'hidden'});
  await page.keyboard.press('c');
  await dialog.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  await page.keyboard.press('2');
  await games.getByRole('button',{name:'Snake',exact:true}).waitFor();
  await home();
  await page.keyboard.press('1');
  await dialog.getByRole('heading',{name:'Telefone',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Fechar aplicativo'}).click();
  await dialog.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  await page.keyboard.press('1');
  await dialog.getByRole('heading',{name:'Telefone',exact:true}).waitFor();
  await page.keyboard.press('Escape');
  await dialog.waitFor({state:'hidden'});
  await page.keyboard.press('c');
  await dialog.getByRole('heading',{name:'Celular',exact:true}).waitFor();
  await page.keyboard.press('2');
  await dialog.getByRole('button',{name:'Snake'}).waitFor();
  await page.keyboard.press('2');
  const candy = dialog.getByRole('region',{name:'Combina Doces'});
  await candy.getByRole('button',{name:/Fruta 25/}).waitFor();
  await candy.getByRole('button',{name:'Novo tabuleiro'}).locator('kbd',{hasText:/^1$/}).waitFor();
  const previousFruit = await candy.locator('.candy-fruit').allTextContents();
  await removeKey(candy.getByRole('button',{name:'Novo tabuleiro'}));
  await page.keyboard.press('1');
  await page.waitForFunction(previous=>[...document.querySelectorAll('.candy-fruit')]
    .some((fruit,index)=>fruit.textContent!==previous[index]),previousFruit);
  const findMove = () => candy.evaluate(async panel=>{
    const {candyFruit,candyWidth,swapCandy} = await import('/src/candy.ts');
    const board = [...panel.querySelectorAll('.candy-fruit')].map(node=>candyFruit.indexOf(node.textContent));
    for (let from=0;from<board.length;from++) {
      for (const to of [from+1,from+candyWidth]) {
        const move = swapCandy(board,from,to);
        if (move?.matches.size) return {from,to,points:move.matches.size,width:candyWidth};
      }
    }
  });
  let move = await findMove();
  for (let attempt=0;!move && attempt<4;attempt++) {
    const previous = await candy.locator('.candy-fruit').allTextContents();
    await page.keyboard.press('1');
    await page.waitForFunction(previous=>[...document.querySelectorAll('.candy-fruit')]
      .some((fruit,index)=>fruit.textContent!==previous[index]),previous);
    move = await findMove();
  }
  if (!move) throw Error('Nenhum tabuleiro de teste apresentou troca válida');
  for (let row=0;row<Math.floor(move.from/move.width);row++) await page.keyboard.press('ArrowDown');
  for (let col=0;col<move.from%move.width;col++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await candy.getByRole('button',{name:new RegExp('^Fruta '+(move.from+1)+' '),pressed:true}).waitFor();
  await page.keyboard.press(move.to===move.from+1 ? 'ArrowRight' : 'ArrowDown');
  await page.keyboard.press('Enter');
  await candy.getByRole('status').getByText(move.points+' pontos',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await home();
  await page.keyboard.press('2');
  await games.getByRole('button',{name:'Bets',exact:true}).waitFor();
  await page.keyboard.press('3');
  const bets = dialog.getByRole('region',{name:'Bets'});
  await bets.getByText('R$ 80 mil',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await bets.getByRole('button',{name:'R$ 2 mil',exact:true}).click();
  await removeKey(bets.getByRole('button',{name:/^Apostar/}));
  await page.keyboard.press('1');
  if (await bets.locator('.bets-reel').count()!==3) throw Error('Quantidade de rolos');
  const result = bets.getByRole('status');
  await bets.getByText(/Trinca!|Sem trinca/).waitFor();
  const balance = (await result.textContent()).startsWith('Trinca!') ? 'R$ 96 mil' : 'R$ 78 mil';
  await bets.getByText(balance,{exact:true}).waitFor();
  await home();
  await page.keyboard.press('3');
  const preview = dialog.getByRole('img',{name:'Enquadramento da câmera'});
  await preview.waitFor();
  await dialog.getByRole('button',{name:'Tirar foto'}).locator('kbd',{hasText:/^1$/}).waitFor();
  await dialog.getByRole('button',{name:'Selfie'}).locator('kbd',{hasText:/^2$/}).waitFor();
  await page.waitForFunction(()=>document.querySelector('.camera-preview').getContext('2d').getImageData(0,0,1,1).data[3]>0);
  await dialog.locator('.phone-camera-controls button').evaluateAll(buttons=>{
    window.syntheticCameraClicks = 0;
    for (const button of buttons) {
      button.removeAttribute('aria-keyshortcuts');
      button.addEventListener('click',event=>{
        if (!event.isTrusted) window.syntheticCameraClicks++;
      });
    }
  });
  await page.keyboard.press('2');
  await dialog.locator('.camera-selfie-portrait').waitFor();
  await viaPalette(dialog.getByRole('button',{name:'Tirar foto',exact:true}),'Tirar foto');
  await dialog.getByRole('button',{name:/Abrir álbum · 1\//}).waitFor();
  await page.keyboard.press('3');
  await preview.waitFor({state:'detached'});
  if (await page.evaluate(()=>window.syntheticCameraClicks)!==0) throw Error('A Câmera simulou clique');
  const photo = dialog.getByRole('button',{name:/Abrir fotografia/});
  await photo.click();
  await dialog.getByRole('img',{name:/^Selfie em/}).waitFor();
  await dialog.getByText('Original',{exact:true}).waitFor();
  if (await dialog.getByRole('img',{name:/^Selfie em/}).evaluate(canvas=>canvas.width)<600) throw Error('Low-resolution selfie canvas');
  await home();
  await page.keyboard.press('6');
  await dialog.getByRole('heading',{name:'Correio',exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Novo comunicado'}).click();
  await dialog.getByRole('button',{name:'Selecionar anexo'}).click();
  await dialog.getByRole('textbox',{name:'Buscar anexo'}).fill('inexistente');
  if (await dialog.locator('.mail-attachment-grid button').count()) throw Error('Attachment search did not filter');
  await dialog.getByRole('textbox',{name:'Buscar anexo'}).fill('fotografia');
  await dialog.getByRole('button',{name:/Fotografia #/}).click();
  await dialog.getByLabel('Assunto').fill('Selfie de teste');
  await dialog.getByLabel('Mensagem').fill('Segue a foto');
  await dialog.getByRole('button',{name:/^Publicar/}).click();
  await dialog.getByRole('heading',{name:'Selfie de teste'}).waitFor();
  await dialog.locator('#phone-mail canvas').waitFor();
  await home();
  await page.keyboard.press('7');
  const pix = dialog.getByRole('region',{name:'Transferência Pix'});
  await pix.getByText('Saldo disponível').waitFor();
  if (!await pix.getByRole('button',{name:'Transferir'}).isDisabled()) throw Error('Pix sem destinatário');
  await home();
  await dialog.getByRole('button',{name:'Fechar',exact:true}).click();
  await dialog.waitFor({state:'hidden'});
  for (const [key,title] of [['o','Inventário'],['e','Equipamentos']]) {
    await page.keyboard.press(key);
    await dialog.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.keyboard.press('Escape');
    await dialog.waitFor({state:'hidden'});
  }

}
