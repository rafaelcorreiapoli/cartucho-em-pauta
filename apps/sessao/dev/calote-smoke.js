async page => {
  await page.addInitScript(()=>{
    localStorage.setItem('cartuchao.sessao.audio',JSON.stringify({muted:true}));
    navigator.mediaDevices.getUserMedia = async ()=>{throw new Error('QA sem microfone');};
  });
  await page.reload();
  await page.setViewportSize({width:800,height:450});
  await page.getByRole('textbox',{name:'Seu nick'}).fill('Calote QA');
  await page.getByRole('button',{name:'Criar sala',exact:true}).click();
  await page.getByRole('button',{name:'Configurar partida',exact:true}).click();
  const room = new URL(await page.getByRole('textbox',{name:'Link da sala'}).inputValue()).searchParams.get('sala');
  if (!room) throw Error('Missing room ID');
  await page.getByRole('button',{name:'Calote',exact:true}).click();
  await page.waitForFunction(()=>document.querySelector('[aria-label="Modo de jogo"] button[aria-pressed="true"]')?.textContent==='Calote');
  await page.screenshot({path:'output/playwright/calote-lobby.png'});
  const options = page.locator('.lobby-options input[type=checkbox]');
  for (let index=0;index<await options.count();index++) {
    if (await options.nth(index).isChecked()) await options.nth(index).click();
    await page.waitForFunction(index=>!document.querySelectorAll('.lobby-options input[type=checkbox]')[index].checked,index);
  }
  await page.getByRole('button',{name:'Nenhum visitante'}).click();
  await page.getByRole('button',{name:'Voltar ao lobby',exact:true}).click();
  await page.getByRole('button',{name:'Iniciar sessão',exact:true}).click();
  const intro = page.locator('#role-intro');
  await intro.getByText(/Evite 30 segundos seguidos no vermelho/).waitFor();
  await intro.getByRole('button',{name:'Entendi',exact:true}).click();
  await page.setViewportSize({width:1280,height:720});
  await page.waitForTimeout(600);
  const metrics = page.getByRole('region',{name:'Parlamento',exact:true});
  const meter = metrics.getByRole('meter',{name:'Orçamento público',exact:true});
  await meter.waitFor();
  if ((await metrics.textContent()).toLocaleLowerCase().includes('estabilidade')) throw Error('Calote leaked stability');
  await page.locator('#session-timers-mount').getByRole('timer',{name:'Tempo restante da sessão'}).waitFor();
  const server = new URL('/qa/budget',new URL(page.url()).searchParams.get('qaServer') ?? 'http://127.0.0.1:26874');
  server.searchParams.set('room',room);
  const setBudget = async (balance,age=0)=>{
    server.searchParams.set('balance',String(balance));
    server.searchParams.set('age',String(age));
    const response = await page.request.get(server.href);
    if (response.status()!==204) throw Error('Budget fixture rejected: '+response.status());
  };
  const checkFill = async direction=>{
    await page.waitForFunction(direction=>{
      const track = document.querySelector('.calote-budget-track');
      const fill = track?.querySelector('.calote-budget-fill');
      if (!track || !fill || track.dataset.direction!==direction) return false;
      const bounds = track.getBoundingClientRect(), colored = fill.getBoundingClientRect();
      const center = bounds.x+bounds.width/2;
      return direction==='zero' ? colored.width<.2 :
        Math.abs((direction==='positive' ? colored.x : colored.right)-center)<.5 && Math.abs(colored.width-bounds.width/4)<.5;
    },direction);
  };
  await setBudget(-1);
  const central = page.locator('.center-game-alert');
  await central.getByText('ORÇAMENTO NEGATIVO',{exact:true}).waitFor();
  const centralStyle = await central.evaluate(element=>({pointer:getComputedStyle(element).pointerEvents,background:getComputedStyle(element).backgroundColor}));
  if (centralStyle.pointer!=='none' || centralStyle.background!=='rgba(0, 0, 0, 0)') throw Error('Central warning blocks play or has a panel');
  await central.waitFor({state:'hidden',timeout:5000});
  await setBudget(16);
  await checkFill('positive');
  await page.screenshot({path:'output/playwright/calote-positive.png'});
  if (await metrics.getByRole('timer',{name:'Tempo até o calote'}).count()) throw Error('Positive balance has countdown');
  await page.evaluate(()=>{
    window.caloteInvalidFill = false;
    const inspect = ()=>{
      const track = document.querySelector('.calote-budget-track');
      const fill = track?.querySelector('.calote-budget-fill');
      if (track && fill) {
        const bounds = track.getBoundingClientRect(), colored = fill.getBoundingClientRect();
        const center = bounds.x+bounds.width/2;
        if (track.dataset.direction==='positive' && Math.abs(colored.x-center)>.5 ||
            track.dataset.direction==='negative' && Math.abs(colored.right-center)>.5 ||
            track.dataset.direction==='zero' && colored.width>.5) window.caloteInvalidFill = true;
      }
      window.caloteFrame = requestAnimationFrame(inspect);
    };
    inspect();
  });
  await setBudget(-16,10_000);
  await checkFill('negative');
  const timer = metrics.getByRole('timer',{name:'Tempo até o calote'});
  await timer.waitFor();
  await page.waitForFunction(()=>/DERROTA POR CALOTE EM\s*(19|20) s/.test(document.querySelector('.calote-countdown')?.textContent ?? ''));
  await page.screenshot({path:'output/playwright/calote-negative.png'});
  for (const size of [{width:1280,height:720},{width:800,height:450}]) {
    await page.setViewportSize(size);
    const rect = await metrics.boundingBox();
    if (!rect || rect.x<0 || rect.y<0 || rect.x+rect.width>size.width || rect.y+rect.height>size.height) throw Error('Budget HUD overflow at '+size.width);
    if (size.width===800) await page.screenshot({path:'output/playwright/calote-compact.png'});
  }
  await page.setViewportSize({width:1280,height:720});
  await setBudget(0);
  await checkFill('zero');
  await page.waitForFunction(()=>!document.querySelector('.calote-countdown'));
  await setBudget(-16);
  await checkFill('negative');
  await page.waitForFunction(()=>/(?:Calote em|DERROTA POR CALOTE EM)\s*(29|30) s/.test(document.querySelector('.calote-countdown')?.textContent ?? ''));
  if (await page.evaluate(()=>{cancelAnimationFrame(window.caloteFrame);return window.caloteInvalidFill;})) throw Error('Budget fill crossed the center during updates');
  await setBudget(-16,30_001);
  await page.getByRole('heading',{name:'O Congresso deu calote!',exact:true}).waitFor();
  return {mode:'calote',centeredBudget:true,positiveRight:true,negativeLeft:true,recoveryResetsTimer:true,loss:true};
}
