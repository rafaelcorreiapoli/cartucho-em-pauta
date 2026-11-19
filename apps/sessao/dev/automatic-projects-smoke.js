async page => {
  const server = new URL(page.url()).searchParams.get('qaServer') ?? 'http://127.0.0.1:26874';
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{throw Error('QA sem microfone');};
  });
  await page.reload();
  await page.setViewportSize({width:1280,height:720});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Projetos QA');
  await page.getByRole('button',{name:'Criar sala',exact:true}).click();
  const room = new URL(await page.getByRole('textbox',{name:'Link da sala'}).inputValue()).searchParams.get('sala');
  await page.waitForFunction(()=>document.querySelector('[aria-label="Modo de jogo"] button[aria-pressed="true"]')?.textContent==='Calote');
  for (const name of ['Projetos automáticos','Câmera e fotos','Eleição para eliminação']) {
    if (!await page.getByRole('checkbox',{name,exact:true}).isChecked()) throw Error('Wrong default: '+name);
  }
  for (const name of ['Retratos e área VIP','Decoração','Vigilância','Votações de projetos','Joguinhos de celular']) {
    if (await page.getByRole('checkbox',{name,exact:true}).isChecked()) throw Error('Wrong default: '+name);
  }
  await page.getByRole('button',{name:'Nenhum parlamentar NPC'}).click();
  await page.getByRole('button',{name:'Iniciar sessão',exact:true}).click();
  await page.locator('#role-intro').getByRole('button',{name:'Entendi',exact:true}).click();
  const history = page.locator('.automatic-projects-history');
  await history.waitFor();
  if (!/4:5\d|5:00/.test(await history.innerText())) throw Error('Initial countdown missing');
  if (await history.locator('li').filter({hasText:'?'}).count()!==4) throw Error('Future projects leaked');
  if (await page.locator('.calote-budget-zero').count()) throw Error('Zero label still rendered');
  const names = ['Pacote de Diálogo Parlamentar','Reajuste Emergencial de Subsídios','Programa Congresso Sem Dormir','PEC da Qualificação Parlamentar'];
  for (let index=0;index<names.length;index++) {
    const response = await page.request.post(`${server}/qa/next-project?room=${encodeURIComponent(room)}`,{data:{}});
    if (!response.ok()) throw Error('QA advance rejected: '+response.status()+' '+await response.text());
    const announcement = page.getByRole('status',{name:'Projeto aprovado automaticamente'});
    await announcement.getByRole('heading',{name:names[index],exact:true}).waitFor();
    await page.waitForFunction(()=>{const img=document.querySelector('.automatic-project-announcement img');return img?.complete && img.naturalWidth>0;});
    await page.setViewportSize({width:800,height:450});
    const box = await announcement.boundingBox();
    if (!box || box.x<0 || box.y<0 || box.x+box.width>801 || box.y+box.height>451) throw Error('Announcement outside compact viewport');
    await page.screenshot({path:`output/playwright/automatic-project-${index+1}.png`});
    await announcement.getByRole('button',{name:'Fechar anúncio do projeto'}).click();
    await announcement.waitFor({state:'hidden'});
    await page.waitForFunction(count=>document.querySelectorAll('.automatic-projects-history [data-approved="true"]').length===count,index+1);
    if (await history.locator('li').filter({hasText:'?'}).count()!==3-index) throw Error('Incorrect secret slots');
  }
  await history.getByText('Pauta encerrada').waitFor();
  await page.screenshot({path:'output/playwright/automatic-project-history.png'});
  return {defaults:true,secretCountdown:true,approvals:4,compactAnnouncement:true,history:true};
}
