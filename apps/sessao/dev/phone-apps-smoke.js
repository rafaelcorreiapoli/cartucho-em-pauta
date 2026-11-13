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
  await page.keyboard.press('1');
  await dialog.getByRole('button',{name:'Telefone',pressed:true}).waitFor();
  await page.keyboard.press('2');
  await dialog.getByRole('button',{name:'Snake'}).waitFor();
}
