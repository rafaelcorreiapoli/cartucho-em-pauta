// Run against a local solo server using dev/private-call-chrome.json.
async page => {
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Celular QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase=negotiation]').waitFor();
  await page.keyboard.press('c');
  const dialog = page.locator('#gameplay-dialog');
  await dialog.getByRole('button',{name:'Telefone',pressed:true}).waitFor();
  await page.keyboard.press('2');
  await dialog.getByRole('button',{name:'Joguinhos',pressed:true}).waitFor();
  await page.keyboard.press('5');
  await dialog.locator('.phone-snake canvas').waitFor();
  await page.keyboard.press('ArrowRight');
  await dialog.getByText('1 / 5 frutas',{exact:true}).waitFor();
  await dialog.getByText('Fim de jogo',{exact:true}).waitFor();
  await page.keyboard.press('5');
  await dialog.getByText('0 / 5 frutas',{exact:true}).waitFor();
  await page.keyboard.press('1');
  await dialog.getByRole('button',{name:'Telefone',pressed:true}).waitFor();
  await page.keyboard.press('2');
  await dialog.getByRole('button',{name:'Snake'}).waitFor();
  await page.keyboard.press('3');
  const preview = dialog.getByRole('img',{name:'Enquadramento da câmera'});
  await preview.waitFor();
  await page.waitForFunction(()=>document.querySelector('.camera-preview').getContext('2d').getImageData(0,0,1,1).data[3]>0);
  await page.keyboard.press('6');
  await dialog.getByRole('button',{name:/Abrir álbum · 1\//}).waitFor();
  await page.keyboard.press('7');
  await preview.waitFor({state:'detached'});
  const photo = dialog.getByRole('button',{name:/Abrir fotografia/});
  await photo.click();
  await dialog.getByRole('img',{name:/^Selfie em/}).waitFor();
  await dialog.getByText('Original',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Excluir do meu álbum'}).click();
  await dialog.getByText('O álbum está vazio.',{exact:true}).waitFor();
  await dialog.getByRole('button',{name:'Publicadas'}).click();
  await dialog.getByText('Nenhuma foto publicada.',{exact:true}).waitFor();
}
