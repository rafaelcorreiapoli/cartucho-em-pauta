// Run with the Pix smoke server and the muted Chrome configuration.
async page => {
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
    for (const client of [page,receiver]) {
      await client.locator('#session[data-phase=negotiation]').waitFor();
      await client.keyboard.press('c');
      await client.locator(dialog).getByRole('button',{name:'Pix',exact:true}).click();
      await client.locator(dialog).locator('.pix-balance').getByText('R$ 80 mil',{exact:true}).waitFor();
    }
    const pix = page.locator(dialog).getByRole('region',{name:'Transferência Pix'});
    await pix.getByRole('button',{name:'Bia',exact:true}).click();
    await page.keyboard.press('5');
    await pix.locator('.pix-balance').getByText('R$ 70 mil',{exact:true}).waitFor();
    await receiver.locator(dialog).locator('.pix-balance').getByText('R$ 90 mil',{exact:true}).waitFor();

    await receiver.keyboard.press('Escape');
    await receiver.locator(dialog).waitFor({state:'hidden'});
    await receiver.locator('#map').focus();
    await receiver.keyboard.down('ArrowDown');
    try {
      await pix.getByRole('button',{name:'Bia',exact:true}).waitFor({state:'detached',timeout:5000});
    } finally { await receiver.keyboard.up('ArrowDown'); }
    if (!await pix.getByRole('button',{name:'Transferir'}).isDisabled()) throw Error('Pix kept a distant recipient enabled');
    await page.keyboard.press('5');
    await pix.locator('.pix-balance').getByText('R$ 70 mil',{exact:true}).waitFor();
  } finally {
    await receiver.close();
  }
}
