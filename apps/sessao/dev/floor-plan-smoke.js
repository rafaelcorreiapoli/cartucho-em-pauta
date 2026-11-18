async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{throw new DOMException('QA sem microfone','NotAllowedError');};
  });
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Planta QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  await page.keyboard.down('Tab');
  const plan = page.getByRole('region',{name:'Planta do Congresso'});
  await plan.waitFor();
  for (const room of ['Tesouraria','Gabinete de Luxo','Enfermaria','Plenário']) {
    await plan.getByText(room,{exact:true}).waitFor();
  }
  if (!await plan.locator('.floor-plan-wall').count() || await plan.getByText('Planta QA').count()) {
    throw Error('A planta deve mostrar paredes sem identificar outros jogadores.');
  }
  const marker = plan.getByRole('img',{name:'Sua posição'});
  await marker.waitFor();
  await marker.locator('.portrait[data-skin]').waitFor();
  if (await plan.getByRole('img').count()!==1) throw Error('A planta deve mostrar apenas o seu marcador.');
  const position = await marker.getAttribute('style');
  if (!position?.includes('left:') || !position.includes('top:')) throw Error('Marcador sem coordenadas.');
  await page.screenshot({animations:'disabled',path:'/tmp/sessao-exploration-map.png'});
  await page.keyboard.up('Tab');
  await plan.waitFor({state:'hidden'});
  await page.keyboard.down('Tab');
  await plan.waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await plan.waitFor({state:'hidden'});
  await page.keyboard.up('Tab');
}
