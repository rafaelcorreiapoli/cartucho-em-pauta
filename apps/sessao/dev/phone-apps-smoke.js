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
  if (await dialog.locator('#phone-apps').evaluate(grid=>getComputedStyle(grid).gridTemplateColumns.split(' ').length)!==3) throw Error('Grade de apps');
  await page.keyboard.press('2');
  await dialog.getByRole('heading',{name:'Joguinhos',exact:true}).waitFor();
  const games = dialog.locator('.phone-games-menu');
  for (const name of ['Snake','Combina Doces','Bets']) {
    await games.getByRole('button',{name,exact:true}).locator('.phone-app-icon').waitFor();
  }
  await page.keyboard.press('1');
  await dialog.locator('.phone-snake canvas').waitFor();
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await page.keyboard.press('ArrowRight');
  await dialog.getByText('1 / 5 frutas',{exact:true}).waitFor();
  await dialog.getByText('Fim de jogo',{exact:true}).waitFor();
  const board = await dialog.getByRole('img',{name:'Tabuleiro do Snake'}).boundingBox();
  const replay = await dialog.getByRole('button',{name:'Jogar de novo'}).boundingBox();
  if (!board || !replay || Math.abs(board.x-replay.x)>1 || Math.abs(board.width-replay.width)>1 || replay.y<=board.y+board.height) {
    throw Error('Botão de reinício desalinhado com o tabuleiro');
  }
  await page.keyboard.press('1');
  await dialog.getByText('0 / 5 frutas',{exact:true}).waitFor();
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
  await page.keyboard.press('1');
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await home();
  await page.keyboard.press('2');
  await games.getByRole('button',{name:'Bets',exact:true}).waitFor();
  await page.keyboard.press('3');
  const bets = dialog.getByRole('region',{name:'Bets'});
  await bets.getByText('R$ 80 mil',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:/Voltar aos joguinhos/}).waitFor({state:'detached'});
  await bets.getByRole('button',{name:'R$ 2 mil',exact:true}).click();
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
  await page.keyboard.press('2');
  await dialog.locator('.camera-selfie-portrait').waitFor();
  await page.keyboard.press('1');
  await dialog.getByRole('button',{name:/Abrir álbum · 1\//}).waitFor();
  await page.keyboard.press('3');
  await preview.waitFor({state:'detached'});
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
