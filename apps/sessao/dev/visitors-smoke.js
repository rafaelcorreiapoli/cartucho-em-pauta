async page => {
  const loaded = new Set();
  page.on('requestfinished',request=>{
    const file = request.url().split('/').at(-1);
    if (file) loaded.add(file);
  });
  await page.addInitScript(()=>localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true})));
  await page.reload();
  await page.setViewportSize({width:1280,height:800});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Visitantes QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.locator('#parliamentarian-count [data-count="8"]').click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click();
  const state = async ()=>(await page.request.get('http://127.0.0.1:26874/qa/visitors')).json();
  const initial = await state();
  const visitors = initial.people.filter(player=>player.npc);
  const bots = initial.people.filter(player=>player.bot);
  if (visitors.length!==8 || bots.length!==5) throw Error('Incorrect visitor/bot populations');
  if (new Set(visitors.map(player=>player.visitor)).size!==8) throw Error('Repeated visitor identity');
  if (bots.some(player=>player.visitor || player.npc || !player.office)) throw Error('Bots lost their parliamentary identity');
  if (visitors.some(player=>player.office)) throw Error('A visitor has a mandate');
  for (const visitor of visitors) for (const action of ['walk','hit','fall']) {
    const file = `${visitor.visitor}-${action}.${action==='walk'?'png':'webp'}`;
    if (!loaded.has(file)) throw Error(`Missing sprite: ${file}`);
  }
  if (await page.getByRole('button',{name:/^Conversar ·/}).count()) throw Error('Visitor negotiation still offered');
  if (await page.locator('#parliamentarian-dialog').count()) throw Error('Legacy negotiation dialog still exists');
  await page.screenshot({path:'output/playwright/visitors-walking.png'});
  let down;
  for (let hit=0;hit<9;hit++) {
    await page.keyboard.press('Space');
    await page.waitForTimeout(1300);
    down = (await state()).people.find(player=>player.visitor==='nestor-cervero');
    if (down?.knockedOut) break;
  }
  if (!down?.knockedOut) throw Error('Visitor did not get knocked out');
  const rob = page.getByRole('button',{name:'Roubar dinheiro · Nestor Cerveró',exact:true});
  await rob.waitFor();
  await page.screenshot({path:'output/playwright/visitors-knockout.png'});
  await rob.click();
  await page.getByRole('button',{name:'Cancelar roubo',exact:true}).waitFor();
  const during = await state();
  const robber = during.people.find(player=>!player.npc && !player.bot);
  if (!robber.robberyTarget || robber.robberyTarget.x!==down.x || robber.robberyTarget.y!==down.y) {
    throw Error('The robbery animation lost its victim position');
  }
  await page.screenshot({path:'output/playwright/visitors-robbing.png'});
  await page.getByText('Maleta roubada. Leve-a ao seu cofre.',{exact:true}).waitFor();
  const after = await state();
  const nestor = after.people.find(player=>player.visitor==='nestor-cervero');
  if (nestor.wallet!==0 || !after.inventory.some(item=>item.kind==='briefcase' && item.cash===7)) throw Error('Robbery cash mismatch');
  if (after.economy.discrepancy!==0) throw Error('Robbery broke cash conservation');
  await page.screenshot({path:'output/playwright/visitors-robbed.png'});
  return {visitors:visitors.length,bots:bots.length,robbed:7};
}
