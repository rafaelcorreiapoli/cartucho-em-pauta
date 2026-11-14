async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{throw new DOMException('QA sem microfone','NotAllowedError');};
  });
  await page.reload();
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Planta QA');
  await page.getByRole('button',{name:'Criar sala'}).click();
  await page.getByRole('button',{name:'Iniciar sessão'}).click();
  await page.locator('#session[data-phase="negotiation"]').waitFor();
  await page.keyboard.down('Tab');
  const plan = page.getByRole('region',{name:'Planta do Congresso'});
  await plan.waitFor();
  for (const room of ['Tesouraria','Gabinete de Luxo','Enfermaria','Plenário']) {
    await plan.getByText(room,{exact:true}).waitFor();
  }
  if (!await plan.locator('.floor-plan-wall').count() || await plan.getByText('Planta QA').count()) {
    throw Error('A planta deve mostrar paredes e apenas informações estáticas.');
  }
  await page.keyboard.up('Tab');
  await plan.waitFor({state:'hidden'});
  await page.keyboard.down('Tab');
  await plan.waitFor();
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));
  await plan.waitFor({state:'hidden'});
  await page.keyboard.up('Tab');
}
