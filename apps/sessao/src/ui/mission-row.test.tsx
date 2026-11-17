import {decorationInstallMs,installationSites} from '../installations';
import {PhoneSession} from '../../server/PhoneSession';

import {publishProjectFiling} from '../../server/project-test-fixture';
import {InternalMail} from '../../server/InternalMail';
import {ELECTION_RULES} from '../elections';
import {internalMailRules} from '../internal-mail';
import {Gameplay} from '../../server/Gameplay';
import {npcs} from '../npcs';
import {spyRules} from '../surveillance';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {BALLOT_MS,bills,NEGOTIATION_MS,policyDuration,stabilityRules,stations} from '../plenary';
import {stationRecharge} from '../station-recharge';
import {MissionRow, ParliamentMetrics} from './hud';
import {CRISIS_MISSION_STABILITY_LIMIT,agendaDurationMs,targetedAgendas,urgentCallMission,type Mission} from '../politics';

test('active and completed targeted missions render the public nickname',()=>{
  for (const kind of Object.keys(targetedAgendas) as (keyof typeof targetedAgendas)[]) {
    const mission:Mission = {id:1,kind,current:0,target:1,person:{id:'private-session',name:'Bia'}};
    const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
    const complete = renderToStaticMarkup(<MissionRow mission={{...mission,current:1}} done/>);
    expect(active).toContain('Bia');
    expect(active).not.toContain('private-session');
    expect(complete).toContain('Bia');
    expect(complete).toContain('data-done="true"');
  }
});

test('the furniture spending objective displays currency on both sides of its progress',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'ostentacao',current:3,target:5}}/>);
  expect(markup).toContain('R$ 30 mil / R$ 50 mil');
});

test('an opposition mission shows progress across successive ballots',()=>{
  const mission:Mission = {id:3,kind:'oposicao',current:1,target:2};
  const markup = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(markup).toContain('Vote contra dois projetos rejeitados');
  expect(markup).toContain('1 / 2');
  expect(renderToStaticMarkup(<MissionRow mission={{...mission,current:2}} done/>)).toContain('data-done="true"');
});

test('the parliament HUD uses the configured threshold and explains the budget penalty',()=>{
  const atTarget = renderToStaticMarkup(<ParliamentMetrics stability={stabilityRules.target} budget={32}/>);
  const below = renderToStaticMarkup(<ParliamentMetrics stability={stabilityRules.target-1} budget={32}/>);
  expect(atTarget).toContain('data-tone="stability"');
  expect(below).toContain('data-tone="danger"');
  expect(atTarget).toContain(`meta da sessão é ${stabilityRules.target}`);
  expect(atTarget).toContain(`custa ${stabilityRules.deficitRate} pontos`);
});


test('the VIP inspection identifies the visitor as the subject of the photo',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'fiscalVip',current:0,target:1}}/>);
  expect(markup).toContain('Fotografe um visitante na área VIP de outro parlamentar.');
});

test('the phone photo objective names both eligible rooms',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'celularFoto',current:0,target:1}}/>);
  expect(markup).toContain('Antecâmara ou na Sala de Segurança');
});

test('publishing a qualifying selfie changes the Agenda row to completed',()=>{
  const mission:Mission = {id:4,kind:'publicouSelfie',current:1,target:1};
  const markup = renderToStaticMarkup(<MissionRow mission={mission} done/>);
  expect(markup).toContain('Publique uma selfie sua com pelo menos dois colegas.');
  expect(markup).toContain('data-done="true"');
});

test('a scandal objective identifies the two kinds of proof the player can publish',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:5,kind:'escandalo',current:0,target:1}}/>);
  expect(markup).toContain('Divulgue uma prova de desvio ou pagamento clandestino');
});

test('the pizza mission shows the shared table as a way to complete it',()=>{
  const mission:Mission = {id:6,kind:'pizza',current:0,target:1};
  expect(renderToStaticMarkup(<MissionRow mission={mission}/>)).toContain('pegue uma fatia no Cafezinho');
});

test('the signature objective identifies the same-document requirement and shows distinct signer progress',()=>{
  const mission:Mission = {id:7,kind:'assinaturas',current:1,target:2};
  const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(active).toContain('duas assinaturas no mesmo documento');
  expect(active).toContain('1 / 2');
  expect(renderToStaticMarkup(<MissionRow mission={{...mission,current:2}} done/>)).toContain('data-done="true"');
});

test('timed mission labels and progress display the same duration in seconds',()=>{
  for (const kind of Object.keys(agendaDurationMs) as (keyof typeof agendaDurationMs)[]) {
    const target = agendaDurationMs[kind];
    const html = renderToStaticMarkup(<MissionRow mission={{id:8,kind,current:1500,target}}/>);
    expect(html).toContain(`${target/1000} segundos`);
    expect(html).toContain(`1 / ${target/1000} s`);
  }
});

test('urgent calls show the minimum per call and progress by distinct contact',()=>{
  const {minCallMs,contacts} = urgentCallMission;
  const html = renderToStaticMarkup(<MissionRow mission={{id:8,kind:'chamadasUrgentes',current:1,target:contacts}}/>);
  expect(html).toContain(`${minCallMs/1000} segundos com ${contacts} colegas diferentes`);
  expect(html).toContain(`1 / ${contacts}`);
});

test('coffee delivery shows distinct recipient progress and the completion check',()=>{
  const mission = {id:9,kind:'entrega',current:2,target:3} as const;
  const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(active).toContain('Entregue cafezinho a três jogadores diferentes.');
  expect(active).toContain('2 / 3');
  const done = renderToStaticMarkup(<MissionRow mission={{...mission,current:3}} done/>);
  expect(done).toContain('data-done="true"');
  expect(done).not.toContain('2 / 3');
});

test('phone call missions show time in seconds',()=>{
  const phone = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'debateTelefonico',current:12_500,target:20_000}}/>);
  expect(phone).toContain('12 / 20 s');
  expect(phone).toContain("20 segundos na mesma chamada durante a articulação");
});

test('the surveillance mission renders sampled progress without exposing any channel',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'escutaAtiva',current:8250,target:15_000}}/>);
  expect(markup).toContain('8 / 15 s');
  expect(markup).toContain('Monitore um grampo por 15 segundos');
});

test('commission mission shows three signatures and keeps the document requirement',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'comissaoImprovisada',current:2,target:3}}/>);
  expect(markup).toContain('três assinaturas no mesmo documento');
  expect(markup).toContain('2 / 3');
});

test('counter-surveillance missions describe discovery and removal separately', () => {
  const discovery = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'varredura',current:0,target:1}}/>);
  const removal = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'limpeza',current:1,target:1}}/>);
  expect(discovery).toContain('Detector de Escutas');
  expect(removal).toContain('Remova um dispositivo clandestino descoberto');
});

test('the office phone mission shows time remaining as seconds', () => {
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'produtividade',current:5000,target:30_000}}/>);
  expect(markup).toContain('no seu gabinete');
  expect(markup).toContain('5 / 30 s');
});

test('concealed transport shows the authoritative progress in seconds', () => {
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'nadaADeclarar',current:9000,target:15_000}}/>);
  expect(markup).toContain('Transporte dinheiro oculto');
  expect(markup).toContain('9 / 15 s');
});

test('Cerimonial Oficial names the installed portrait and marks completion',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'cerimonialOficial',current:1,target:1}} done/>);
  expect(markup).toContain('Tire uma selfie perto de um Retrato Oficial instalado');
  expect(markup).toContain('data-done="true"');
});

test('Visita de Cortesia identifies the target and suggests an interaction',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'visitaCortesia',current:0,target:1,person:{id:'b',name:'Bia'}}}/>);
  expect(markup).toContain('Interaja dentro do gabinete de Bia');
  expect(markup).toContain('tire uma foto');
});

test('cash mission instructions distinguish handing over the exact amount from receiving cash',()=>{
  const send = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'dinheiroPresencialVinte',current:0,target:1}}/>);
  const receive = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'caixaDois',current:1,target:1}} done/>);
  expect(send).toContain('Entregue R$ 20 mil em espécie');
  expect(receive).toContain('Receba dinheiro em espécie');
  expect(receive).toContain('data-done="true"');
});

test('Raio X missions identify which kind of balance to reveal',()=>{
  const safe = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'fiscalizacaoParalela',current:0,target:1}}/>);
  const npc = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'patrimonioSuspeito',current:1,target:1}} done/>);
  expect(safe).toContain('cofre de outro parlamentar com o Raio X');
  expect(npc).toContain('saldo de um parlamentar NPC com o Raio X');
  expect(npc).toContain('data-done="true"');
});

test('the extraordinary collection mission shows its partial delivery and two steps',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'recolhimentoExtraordinario',current:1,target:2}}/>);
  expect(markup).toContain('entregue parte dela à Tesouraria');
  expect(markup).toContain('1 / 2');
});

test('savings shows net progress in reais',()=>{
  const savings = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'poupancaInstitucional',current:7.5,target:10}}/>);
  expect(savings).toContain('R$ 75 mil / R$ 100 mil');
});

test('Segurança Parlamentar explains continuous proximity and renders server time',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'segurancaParlamentar',current:6000,target:10_000}}/>);
  expect(markup).toContain('mesmo parlamentar');
  expect(markup).toContain('sem atacar');
  expect(markup).toContain('6 / 10 s');
});

test('Plantão de Emergência tells players to enter the room and extinguish the fire',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'plantaoEmergencia',current:0,target:1}}/>);
  expect(markup).toContain('Apague um incêndio ou ajude no reparo elétrico dentro da sala afetada');
});

test('Reunião de Alto Nível identifies the installed VIP plaque and shows the countdown progress',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'reuniaoVip',current:6000,target:15_000}}/>);
  expect(markup).toContain('outro parlamentar perto de uma Placa VIP instalada');
  expect(markup).toContain('6 / 15 s');
});

test('the expansion renders archive progress and explains the installation and exchange requirements',()=>{
  const render = (kind:'plantaoArquivo'|'privilegioAdquirido'|'amizadeInstitucional'|'passeio'|'pausaCafe',current=0,target=1,done=false)=>
    renderToStaticMarkup(<MissionRow mission={{id:1,kind,current,target}} done={done}/>);
  expect(render('plantaoArquivo',7000,30_000)).toContain('7 / 30 s');
  expect(render('plantaoArquivo')).toContain('seguidos no Arquivo');
  expect(render('privilegioAdquirido',1,1,true)).toContain('data-done="true"');
  expect(render('privilegioAdquirido')).toContain('Instale uma Placa VIP');
  expect(render('amizadeInstitucional')).toContain('receba dele um item diferente');
  expect(render('passeio')).toContain('três salas públicas diferentes');
  expect(render('pausaCafe')).toContain('no Cafezinho durante a articulação');
});

test('the portrait and transfer objectives state the actual time and amount required',()=>{
  const portrait = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'solenidadeInauguracao',current:0,target:1}}/>);
  const payment = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'dinheiroAlvo',current:0,target:1,person:{id:'b',name:'Bia'}}}/>);
  expect(portrait).toContain('Retrato Oficial de outro jogador instalado há até 60 segundos');
  expect(payment).toContain('Transfira R$ 10 mil para Bia');
});

test('campaign investment shows only the paid amount confirmed by the gameserver',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'investimentoPolitico',current:4,target:5}}/>);
  expect(markup).toContain('em propaganda eleitoral');
  expect(markup).toContain('R$ 40 mil / R$ 50 mil');
});

test('the agenda renders only payable Pix missions and tracks distinct senders from the server',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    nick,id:nick,x:140,y:146,character,direction:0,moving:false,
  }));
  const [rafa,bia,caio] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(rafa.id,players,0,()=>.9)).toBe(true);
  const economy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(rafa.id);
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['pixVinte','doisPix','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
  };
  const pay = (from:Player,to:Player,now:number)=>match.politics(from,{kind:'transfer',to:to.id,amount:1},players,now);
  const view = ()=>match.view(rafa.id,ids,100).politics!;
  const render = ()=>{
    const {active,completed} = view().missions;
    return renderToStaticMarkup(<ul>
      {active.map(mission=><MissionRow key={mission.id} mission={mission}/>)}
      {completed.map(mission=><MissionRow key={mission.id} mission={mission} done/>)}
    </ul>);
  };
  const remaining = view().paymentsLeft;
  for (let i=0;i<remaining;i++) expect(pay(rafa,bia,1+i)).toBe(true);
  draw();
  expect(render()).not.toContain('Envie um Pix de R$ 20 mil');
  expect(render()).toContain('0 / 2');
  expect(pay(bia,rafa,20)).toBe(true);
  expect(pay(bia,rafa,21)).toBe(true);
  expect(render()).toContain('Receba Pix de dois jogadores distintos');
  expect(render()).toContain('1 / 2');
  expect(render()).not.toContain('data-done="true"');
  expect(pay(caio,rafa,22)).toBe(true);
  expect(render()).toContain('data-done="true"');
});

test('the solo security mission displays distinct institutional cameras from the private server view',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>0)).toBe(true);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['vigilanciaInstitucional','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const missions = ()=>match.view(player.id,[player.id],2).politics!.missions;
  const active = ()=>missions().active.find(mission=>mission.kind==='vigilanciaInstitucional')!;
  const world = match.gameplayWorld([player],1,()=>false);
  const consult = (place:string,at:number)=>world.publish({
    type:'security-camera-viewed',actor:player.id,position:player,at,place,witnesses:[],
  });
  const initial = renderToStaticMarkup(<MissionRow mission={active()}/>);
  expect(initial).toContain('Consulte duas câmeras diferentes na Sala de Segurança');
  expect(initial).toContain('0 / 2');
  consult('corridor',1);
  consult('corridor',2);
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('1 / 2');
  consult('coffee',3);
  const completed = missions().completed.find(mission=>mission.kind==='vigilanciaInstitucional')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
});

test('electrical repair is a multiplayer mission and shows authoritative completion',()=>{
  const draw = (players:Player[])=>{
    const match = new PlenaryMatch(1);
    const [player] = players;
    expect(match.start(player.id,players,0,()=>.9)).toBe(true);
    const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['manutencaoEmergencia','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
    return match.view(player.id,players.map(({id})=>id),1).politics!.missions.active;
  };
  const rafa:Player = {id:'rafa',nick:'Rafa',character:0,x:140,y:146,direction:0,moving:false};
  expect(draw([rafa]).some(mission=>mission.kind==='manutencaoEmergencia')).toBe(false);
  const mission = draw([rafa,{...rafa,id:'bia',nick:'Bia'}]).find(mission=>mission.kind==='manutencaoEmergencia')!;
  const pending = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(pending).toContain('Conclua o reparo de uma pane elétrica junto a outro jogador');
  expect(pending).not.toContain('data-done="true"');
  expect(renderToStaticMarkup(<MissionRow mission={{...mission,current:1}} done/>)).toContain('data-done="true"');
});

test('cleanup requires a private discovery, works without the detector and expires on removal',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    nick,id:nick,character,x:254,y:252,direction:0,moving:false,
  }));
  const [owner,detective,peer] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(owner.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,players);
  const economy = Reflect.get(match,'economy');
  const resetDeck = (id:string,kind:'limpeza'|'varredura'='limpeza')=>{
    const account = Reflect.get(economy,'accounts').get(id);
    Object.assign(account,{
      owns:(kind:Parameters<Gameplay['owns']>[1])=>game.owns(id,kind),
      hasKnownForeignSpy:()=>game.hasKnownForeignSpy(id),
    });
    Reflect.set(account.agenda,'missions',[]);
    Reflect.set(account.agenda,'missionDeck',[kind,'cafe','passeio','selfieSolo']);
  };
  for (const {id} of players) resetDeck(id);
  match.refreshAgendaEligibility();
  const missions = (player:Player,now:number)=>match.view(player.id,ids,now).politics!.missions;
  const markup = (player:Player,now:number)=>{
    const {active,completed} = missions(player,now);
    return renderToStaticMarkup(<ul>
      {active.map(mission=><MissionRow key={mission.id} mission={mission}/>)}
      {completed.map(mission=><MissionRow key={mission.id} mission={mission} done/>)}
    </ul>);
  };
  const buy = (player:Player,kind:'spyCamera'|'bugDetector')=>{
    Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    const world = match.gameplayWorld(players,1,()=>false);
    game.act(player,{kind:'open-shop',target:'vendor'},world);
    const token = game.view(player,world).dialogue?.token;
    game.act(player,{kind:'shop-buy',target:kind,token},world);
    return game.view(player,world).inventory.find(item=>item.kind===kind)!;
  };
  const camera = buy(owner,'spyCamera');
  const detector = buy(detective,'bugDetector');
  Object.assign(owner,{x:240,y:250});
  Object.assign(detective,{x:254,y:252});
  const world = match.gameplayWorld(players,2,()=>false);
  const at = (now:number)=>match.gameplayWorld(players,now,()=>false);
  const title = 'Remova um dispositivo clandestino descoberto';
  game.spyAction(owner,{kind:'install',site:'coffee',item:camera.id},world);
  const installed = 2+spyRules.install;
  game.tick(at(installed),true);
  match.refreshAgendaEligibility();
  for (const player of players) expect(markup(player,installed)).not.toContain(title);
  game.spyAction(detective,{kind:'inspect',site:'coffee',item:detector.id},at(installed));
  resetDeck(detective.id,'varredura');
  match.refreshAgendaEligibility();
  const firstDiscovery = installed+spyRules.inspect;
  game.tick(at(firstDiscovery),true);
  const first = missions(detective,firstDiscovery).completed.find(mission=>mission.kind==='varredura')!;
  expect(renderToStaticMarkup(<MissionRow mission={first} done/>)).toContain('data-done="true"');
  const xp = match.view(detective.id,ids,firstDiscovery).politics!.progression.xp;
  resetDeck(detective.id,'varredura');
  const detectiveAgenda = Reflect.get(economy,'accounts').get(detective.id).agenda;
  Reflect.set(detectiveAgenda,'missionDeck',['varredura','cafe','passeio']);
  match.refreshAgendaEligibility();
  game.spyAction(detective,{kind:'keep',site:'coffee'},at(firstDiscovery));
  game.spyAction(detective,{kind:'inspect',site:'coffee',item:detector.id},at(firstDiscovery));
  const rescanned = firstDiscovery+spyRules.inspect;
  game.tick(at(rescanned),true);
  expect(match.view(detective.id,ids,rescanned).politics!.progression.xp).toBe(xp);
  game.spyAction(owner,{kind:'recover',site:'coffee'},at(rescanned));
  const recovered = rescanned+spyRules.remove;
  game.tick(at(recovered),true);
  const recoveredCamera = game.view(owner,at(recovered)).inventory.find(item=>item.kind==='spyCamera')!;
  expect(recoveredCamera.id).not.toBe(camera.id);
  game.spyAction(owner,{kind:'install',site:'coffee',item:recoveredCamera.id},at(recovered));
  const reinstalled = recovered+spyRules.install;
  game.tick(at(reinstalled),true);
  game.spyAction(detective,{kind:'inspect',site:'coffee',item:detector.id},at(reinstalled));
  const discovered = reinstalled+spyRules.inspect;
  game.tick(at(discovered),true);
  expect(match.view(detective.id,ids,discovered).politics!.progression.xp).toBe(xp);
  const scan = missions(detective,discovered).active.find(mission=>mission.kind==='varredura')!;
  expect(scan.current).toBe(0);
  expect(renderToStaticMarkup(<MissionRow mission={scan}/>)).not.toContain('data-done="true"');
  game.act(detective,{kind:'drop',item:detector.id},at(discovered));
  expect(game.owns(detective.id,'bugDetector')).toBe(false);
  expect(economy.spend(detective.id,match.view(detective.id,ids,discovered).politics!.wallet)).toBe(true);
  resetDeck(detective.id);
  match.refreshAgendaEligibility();
  expect(markup(detective,discovered)).toContain(title);
  expect(markup(peer,discovered)).not.toContain(title);
  expect(markup(owner,discovered)).not.toContain(title);
  Object.assign(peer,{x:254,y:252});
  game.act(peer,{kind:'collect',item:detector.id},at(discovered));
  expect(game.owns(peer.id,'bugDetector')).toBe(true);
  game.spyAction(peer,{kind:'inspect',site:'coffee',item:detector.id},at(discovered));
  const secondDiscovery = discovered+spyRules.inspect;
  game.tick(at(secondDiscovery),true);
  resetDeck(peer.id);
  match.refreshAgendaEligibility();
  expect(markup(peer,secondDiscovery)).toContain(title);
  game.spyAction(detective,{kind:'remove',site:'coffee'},at(secondDiscovery));
  const removed = secondDiscovery+spyRules.remove;
  game.tick(at(removed),true);
  const complete = missions(detective,removed).completed.find(mission=>mission.kind==='limpeza')!;
  expect(renderToStaticMarkup(<MissionRow mission={complete} done/>)).toContain('data-done="true"');
  expect(missions(detective,removed).active.some(mission=>mission.kind==='limpeza')).toBe(false);

  expect(markup(peer,removed)).not.toContain(title);
  expect(missions(peer,removed).completed.some(mission=>mission.kind==='limpeza')).toBe(false);
});

test('Investigação Particular counts two physical cameras across reinstallation',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:0,y:0};
  const ids = [player.id];
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  const account = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  account.ownsSpyCameras = ()=>game.ownsSpyCameras(player.id);
  Reflect.set(account.agenda,'missions',[]);
  Reflect.set(account.agenda,'missionDeck',['duasCameras','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const at = (now:number)=>match.gameplayWorld([player],now,()=>false);
  const view = (now:number)=>match.view(player.id,ids,now).politics!;
  expect(view(0).missions.active.some(mission=>mission.kind==='duasCameras')).toBe(false);
  Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  game.act(player,{kind:'open-shop',target:'vendor'},at(1));
  for (let index=0;index<2;index++) {
    const token = game.view(player,at(1)).dialogue?.token;
    game.act(player,{kind:'shop-buy',target:'spyCamera',token},at(1));
  }
  const [first,second] = game.view(player,at(1)).inventory.filter(item=>item.kind==='spyCamera');
  Object.assign(player,{x:254,y:252});
  game.spyAction(player,{kind:'install',site:'coffee',item:first.id},at(10));
  game.tick(at(10+spyRules.install),true);
  const original = game.spyView(player,at(10+spyRules.install)).channels[0];
  Object.assign(player,{x:933,y:244});
  game.spyAction(player,{kind:'install',site:'press',item:second.id},at(5020));
  game.tick(at(5020+spyRules.install),true);
  const secondInstalledAt = 5020+spyRules.install;
  const other = game.spyView(player,at(secondInstalledAt)).channels.find(channel=>channel.id!==original.id)!;
  Reflect.set(account.agenda,'missions',[]);
  Reflect.set(account.agenda,'missionDeck',['duasCameras','cafe','passeio']);
  match.refreshAgendaEligibility();
  const progress = (now:number)=>view(now).missions.active.find(mission=>mission.kind==='duasCameras')!;
  expect(progress(secondInstalledAt).current).toBe(0);
  game.spyAction(player,{kind:'open',channel:original.id},at(secondInstalledAt+1));
  expect(progress(secondInstalledAt+1).current).toBe(0);
  expect(game.spyFrame(player,at(secondInstalledAt+1))).toBeDefined();
  game.confirmSpyFrame(player,at(secondInstalledAt+1));
  expect(progress(secondInstalledAt+1).current).toBe(1);
  Object.assign(player,{x:254,y:252});
  game.spyAction(player,{kind:'recover',site:'coffee'},at(secondInstalledAt+10));
  const recoveredAt = secondInstalledAt+10+spyRules.remove;
  game.tick(at(recoveredAt),true);
  const recovered = game.view(player,at(recoveredAt)).inventory.find(item=>item.kind==='spyCamera')!;
  game.spyAction(player,{kind:'install',site:'coffee',item:recovered.id},at(recoveredAt));
  const reinstalledAt = recoveredAt+spyRules.install;
  game.tick(at(reinstalledAt),true);
  const replacement = game.spyView(player,at(reinstalledAt)).channels.find(channel=>!channel.removed && channel.id!==other.id)!;
  game.spyAction(player,{kind:'open',channel:replacement.id},at(reinstalledAt+1));
  expect(game.spyFrame(player,at(reinstalledAt+1))).toBeDefined();
  game.confirmSpyFrame(player,at(reinstalledAt+1));
  expect(renderToStaticMarkup(<MissionRow mission={progress(reinstalledAt+1)}/>)).toContain('1 / 2');
  game.spyAction(player,{kind:'open',channel:other.id},at(reinstalledAt+2));
  expect(game.spyFrame(player,at(reinstalledAt+2))).toBeDefined();
  game.confirmSpyFrame(player,at(reinstalledAt+2));
  const completed = view(reinstalledAt+2).missions.completed.find(mission=>mission.kind==='duasCameras')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view(reinstalledAt+2).progression.xp).toBe(30);
});

test('free coffee missions can be drawn and completed with an empty wallet',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...stations.coffee};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  const economy = Reflect.get(match,'economy');
  const account = Reflect.get(economy,'accounts').get(player.id);
  expect(economy.spend(player.id,account.wallet)).toBe(true);
  Reflect.set(account.agenda,'missions',[]);
  Reflect.set(account.agenda,'missionDeck',['cafeEstrategico','fiscalCafe','passeio']);
  match.refreshAgendaEligibility();
  const view = (now:number)=>match.view(player.id,[player.id],now).politics!;
  const find = (now:number,kind:Mission['kind'],done=false)=>{
    const mission = view(now).missions[done ? 'completed' : 'active'].find(mission=>mission.kind===kind)!;
    return renderToStaticMarkup(<MissionRow mission={mission} done={done}/>);
  };
  expect(view(0).wallet).toBe(0);
  expect(find(0,'cafeEstrategico')).toContain('Beba um café no Cafezinho');
  expect(find(0,'fiscalCafe')).toContain('0 / 3');
  Reflect.set(account.agenda,'missionDeck',['selfieSolo','visitaArquivo','passeio']);
  for (let cup=0;cup<3;cup++) {
    const now = 1+cup*stationRecharge.coffee.duration;
    const world = match.gameplayWorld([player],now,()=>false);
    expect(game.act(player,{kind:'supply',place:'coffee'},world)).toBe('Objeto guardado no inventário.');
    const coffee = game.view(player,world).inventory.find(item=>item.kind==='coffee')!;
    expect(game.act(player,{kind:'use',item:coffee.id},world)).toBe('Objeto utilizado.');
    if (!cup) {
      expect(find(now,'cafeEstrategico',true)).toContain('data-done="true"');
      expect(find(now,'fiscalCafe')).toContain('1 / 3');
    }
  }
  expect(find(1+2*stationRecharge.coffee.duration,'fiscalCafe',true)).toContain('data-done="true"');
  expect(view(1+2*stationRecharge.coffee.duration).wallet).toBe(0);
});

test('a furniture subsidy updates agenda eligibility and the HUD shows what the shop actually charged',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    nick,id:nick,character,direction:0,moving:false,...npcs.furnitureVendor.interaction,
  }));
  const [buyer,limited] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  let now = 0;
  expect(match.start(buyer.id,players,now,()=>.9)).toBe(true);
  game.reset(now,()=>.9,players);
  match.setAgendaCommerce(()=>now);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),id=>game.officeStock(id));
  const economy = Reflect.get(match,'economy');
  expect(economy.spend(limited.id,5.5)).toBe(true);
  const view = (player:Player)=>match.view(player.id,ids,now);
  const draw = (player:Player,kind:Mission['kind'])=>{
    const {agenda} = Reflect.get(economy,'accounts').get(player.id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',[kind,'cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
    return view(player).politics!.missions.active.find(mission=>mission.kind===kind);
  };
  expect(draw(limited,'doisMoveis')).toBeUndefined();
  expect(draw(buyer,'ostentacao')).toBeDefined();
  now = 1;
  match.gameplayWorld(players,now,()=>false).publish({
    type:'filed',actor:buyer.id,item:1,project:bills.findIndex(bill=>bill.id==='PROJ-N07'),
    position:stations.amendment,at:now,witnesses:[],
  });
  now += NEGOTIATION_MS;
  match.advance(now);
  match.vote(buyer.id,'yes',now+1);
  match.vote(limited.id,'yes',now+1);
  now += BALLOT_MS;
  match.advance(now);
  expect(draw(limited,'doisMoveis')).toBeDefined();
  const before = view(buyer);
  const world = match.gameplayWorld(players,++now,()=>false);
  game.act(buyer,{kind:'open-shop',target:'furnitureVendor'},world);
  const token = game.view(buyer,world).dialogue?.token;
  expect(game.act(buyer,{kind:'shop-buy',target:'officeTv',token},world)).toBe('Compra instalada no seu gabinete.');
  const after = view(buyer);
  expect(after.politics!.wallet).toBe(before.politics!.wallet-1.8);
  expect(after.budget).toBeCloseTo(before.budget-1.2);
  const mission = after.politics!.missions.active.find(mission=>mission.kind==='ostentacao')!;
  expect(renderToStaticMarkup(<MissionRow mission={mission}/>)).toContain('R$ 18 mil / R$ 50 mil');
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
  now += policyDuration;
  expect(draw(limited,'doisMoveis')).toBeUndefined();
});

test('the HUD replaces mail objectives if the next publication falls at the session deadline',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...stations.press};
  const match = new PlenaryMatch(1);
  const mail = new InternalMail();
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  match.setAgendaMailAvailability(id=>mail.nextPublicationAt(id));
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['mensagemComAnexo','cafe','passeio','selfieSolo']);
  const publish = (now:number)=>mail.publish(player,{subject:'Comunicado',body:'Sem anexo'},match.gameplayWorld([player],now,()=>false));
  const view = (now:number)=>match.view(player.id,[player.id],now).politics!.missions;
  const hud = (now:number)=>renderToStaticMarkup(<ul>{view(now).active.map(mission=><MissionRow key={mission.id} mission={mission}/>)}</ul>);
  expect(publish(1)).toBeUndefined();
  match.refreshAgendaEligibility();
  expect(hud(1)).toContain('Publique um comunicado com anexo');
  expect(publish(2)).toContain('Aguarde');
  const last = ELECTION_RULES.matchDuration-internalMailRules.cooldownMs;
  expect(publish(last)).toBeUndefined();
  expect(mail.nextPublicationAt(player.id)).toBe(ELECTION_RULES.matchDuration);
  match.refreshAgendaEligibility();
  expect(hud(last)).not.toContain('Publique um comunicado com anexo');
  expect(view(last).active).toHaveLength(3);
  expect(view(last).completed).toHaveLength(0);
});

test.each([true,false])('the final campaign slot is consumed once and only the last minute earns XP (%s)',isLastMinute=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...stations.press};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  // Use a long articulation in the fixture so election renewal runs without project votes.
  Reflect.set(match,'ends',ELECTION_RULES.matchDuration);
  match.advance(ELECTION_RULES.interval);
  match.advance(ELECTION_RULES.interval*2);
  const economy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['campanhaUltimaHora','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const now = ELECTION_RULES.interval*ELECTION_RULES.cycles-60_000-Number(!isLastMinute);
  const view = ()=>match.view(player.id,[player.id],now).politics!;
  const before = view();
  expect(before.missions.active.some(mission=>mission.kind==='campanhaUltimaHora')).toBe(true);
  expect(match.electionAction(player,{kind:'advertise'},now,false)).toBeDefined();
  const after = view();
  expect(after.missions.active.some(mission=>mission.kind==='campanhaUltimaHora')).toBe(false);
  expect(after.missions.active).toHaveLength(3);
  const completed = after.missions.completed.find(mission=>mission.kind==='campanhaUltimaHora');
  expect(!!completed).toBe(isLastMinute);
  expect(after.progression.xp-before.progression.xp).toBe(isLastMinute ? 30 : 0);
  if (completed) expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
});

test('office diplomacy keeps HUD progress after the visited owner leaves',()=>{
  const players:Player[] = ['Rafa','Bia','Caio','Duda'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:445,y:143,
  }));
  const [visitor,firstOwner,secondOwner,withoutOffice] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(visitor.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,players.slice(0,3));
  expect(game.hasOffice(withoutOffice.id)).toBe(false);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,id=>game.hasOffice(id));
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(visitor.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['visitaDoisGabinetes','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  let now = 100;
  const tick = (present=players)=>game.tick(match.gameplayWorld(present,now+=100,()=>false),true);
  const view = ()=>match.view(visitor.id,players.map(({id})=>id),now).politics!;
  const active = ()=>view().missions.active.find(mission=>mission.kind==='visitaDoisGabinetes')!;
  tick();
  Object.assign(visitor,game.officeSpawn(firstOwner.id));
  tick();
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('1 / 2');
  match.leave(firstOwner.id,now);
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('1 / 2');
  const remaining = players.filter(({id})=>id!==firstOwner.id);
  Object.assign(visitor,game.officeSpawn(secondOwner.id));
  tick(remaining);
  const completed = view().missions.completed.find(mission=>mission.kind==='visitaDoisGabinetes')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view().progression.xp).toBe(35);
});

test('the signature mission keeps the signed document visible after a signer leaves',()=>{
  const players:Player[] = ['Rafa','Bia','Caio','Duda'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:83+character*3,y:247,
  }));
  const [author,first,second,third] = players;
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(author.id,players,0,()=>.9)).toBe(true);
  game.reset(0,()=>.9,players);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(author.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['comissaoImprovisada','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const view = (now:number)=>match.view(author.id,players.map(({id})=>id),now).politics!;
  const world = match.gameplayWorld(players,1,()=>false);
  game.act(author,{kind:'supply',place:'secretary',target:'queue'},world);
  const document = game.view(author,world).inventory.find(item=>item.kind==='document')!;
  const sign = (signer:Player,now:number)=>{
    const state = match.gameplayWorld(players.filter(player=>now<4 || player!==first),now,()=>false);
    game.act(author,{kind:'sign-request',target:signer.id,item:document.id},state);
    const request = game.view(signer,state).requests[0];
    game.act(signer,{kind:'accept',item:request.id},state);
  };
  sign(first,2);
  match.leave(first.id,3);
  const mission = view(3).missions.active.find(mission=>mission.kind==='comissaoImprovisada')!;
  expect(renderToStaticMarkup(<MissionRow mission={mission}/>)).toContain('1 / 3');
  sign(second,4);
  sign(third,5);
  const completed = view(5).missions.completed.find(mission=>mission.kind==='comissaoImprovisada')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view(5).progression.xp).toBe(65);
});

test('the plenary visit objective requires entry and exit within the same articulation',()=>{
  const outside = {x:445,y:143};
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...outside};
  const match = new PlenaryMatch(1);
  const game = new Gameplay();
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  publishProjectFiling(match,player);
  game.reset(0,()=>.9,[player]);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['presencaPlenario','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const tick = (now:number)=>game.tick(match.gameplayWorld([player],now,()=>false),match.phase==='negotiation');
  const view = (now:number)=>match.view(player.id,[player.id],now).politics!;
  const active = (now:number)=>view(now).missions.active.find(mission=>mission.kind==='presencaPlenario')!;
  tick(1);
  Object.assign(player,{x:480,y:665});
  tick(2);
  match.advance(NEGOTIATION_MS);
  tick(NEGOTIATION_MS);
  const resumedAt = NEGOTIATION_MS+BALLOT_MS;
  match.advance(resumedAt);
  tick(resumedAt);
  Object.assign(player,outside);
  tick(resumedAt+1);
  expect(active(resumedAt+1).current).toBe(0);
  expect(renderToStaticMarkup(<MissionRow mission={active(resumedAt+1)}/>)).not.toContain('data-done="true"');

  Object.assign(player,{x:480,y:665});
  tick(resumedAt+2);
  Object.assign(player,outside);
  tick(resumedAt+3);
  const completed = view(resumedAt+3).missions.completed.find(mission=>mission.kind==='presencaPlenario')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view(resumedAt+3).progression.xp).toBe(25);
});

test('urgent calls retain confirmed HUD progress after the first contact leaves',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:445,y:143,
  }));
  const [caller,first,second] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(caller.id,players,0,()=>.9)).toBe(true);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(caller.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['chamadasUrgentes','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  const phone = new PhoneSession();
  let now = 0;
  const world = ()=>match.gameplayWorld(players,now,()=>true);
  const view = ()=>match.view(caller.id,players.map(({id})=>id),now).politics!;
  const mission = ()=>view().missions.active.find(({kind})=>kind==='chamadasUrgentes')!;
  const call = (contact:Player)=>{
    now++;
    expect(phone.act(caller,{kind:'call',target:contact.id},world())).toBe('Chamando…');
    expect(phone.act(contact,{kind:'answer'},world())).toBe('Ligação atendida.');
    for (let elapsed=0;elapsed<10_000;elapsed+=100) {
      now+=100;
      phone.tick(world(),true);
    }
    phone.act(caller,{kind:'hangup'},world());
  };

  expect(renderToStaticMarkup(<MissionRow mission={mission()}/>)).toContain('0 / 2');
  call(first);
  expect(renderToStaticMarkup(<MissionRow mission={mission()}/>)).toContain('1 / 2');
  match.leave(first.id,now);
  expect(renderToStaticMarkup(<MissionRow mission={mission()}/>)).toContain('1 / 2');
  call(second);
  const completed = view().missions.completed.find(({kind})=>kind==='chamadasUrgentes')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view().progression.xp).toBe(45);
});

test('what the HUD counts as debate time pauses while either caller is knocked out',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:445,y:143,
  }));
  const [caller,receiver] = players;
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  expect(match.start(caller.id,players,0,()=>.9)).toBe(true);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(caller.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['debateTelefonico','cafe','passeio']);
  match.refreshAgendaEligibility();

  const phone = new PhoneSession();
  let now = 0;
  const world = ()=>match.gameplayWorld(players,now,()=>true);
  const view = ()=>match.view(caller.id,ids,now).politics!;
  const active = ()=>view().missions.active.find(({kind})=>kind==='debateTelefonico')!;
  const tick = ()=>{ now+=100; phone.tick(world(),true); };
  expect(phone.act(caller,{kind:'call',target:receiver.id},world())).toBe('Chamando…');
  expect(phone.act(receiver,{kind:'answer'},world())).toBe('Ligação atendida.');
  for (let i=0;i<199;i++) tick();
  expect(active().current).toBe(19_900);
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('19 / 20 s');

  receiver.knockedOut = true;
  tick();
  tick();
  expect(active().current).toBe(19_900);
  expect(view().progression.xp).toBe(0);
  receiver.knockedOut = undefined;
  tick();
  expect(active().current).toBe(19_900);
  tick();
  const completed = view().missions.completed.find(({kind})=>kind==='debateTelefonico')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view().progression.xp).toBe(35);
});

test('Escuta Ativa credits only time after opening or unmuting a real wiretap',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:0,y:0};
  const ids = [player.id];
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  const account = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  const {agenda} = account;
  account.ownsWiretap = ()=>game.ownsWiretap(player.id);
  const world = (now:number)=>match.gameplayWorld([player],now,()=>true);
  Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  game.act(player,{kind:'open-shop',target:'vendor'},world(1));
  const token = game.view(player,world(1)).dialogue?.token;
  expect(game.act(player,{kind:'shop-buy',target:'wiretap',token},world(1))).toBe('Compra guardada no inventário.');
  const wiretap = game.view(player,world(1)).inventory.find(({kind})=>kind==='wiretap')!;
  Object.assign(player,{x:254,y:252});
  game.spyAction(player,{kind:'install',site:'coffee',item:wiretap.id},world(10));
  let now = 10+spyRules.install;
  game.tick(world(now),true);
  const channel = game.spyView(player,world(now)).channels[0].id;
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['escutaAtiva','cafe','passeio']);
  match.refreshAgendaEligibility();

  const view = ()=>match.view(player.id,ids,now).politics!;
  const active = ()=>view().missions.active.find(({kind})=>kind==='escutaAtiva')!;
  const tick = (elapsed:number)=>game.tick(world(now+=elapsed),true);
  game.spyAction(player,{kind:'open',channel},world(now+99));
  tick(100);
  expect(active().current).toBe(1);
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('0 / 15 s');

  game.spyAction(player,{kind:'mute',channel},world(now));
  tick(100);
  expect(active().current).toBe(1);
  game.spyAction(player,{kind:'mute',channel},world(now+99));
  tick(100);
  expect(active().current).toBe(2);

  for (let i=0;i<149;i++) tick(100);
  tick(97);
  expect(active().current).toBe(14_999);
  expect(renderToStaticMarkup(<MissionRow mission={active()}/>)).toContain('14 / 15 s');
  tick(1);
  const completed = view().missions.completed.find(({kind})=>kind==='escutaAtiva')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view().progression.xp).toBe(35);
});

test('Discurso Histórico credits the final active interval without counting time past expiry',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:0,y:0};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind));
  const world = (now:number)=>match.gameplayWorld([player],now,()=>true);
  Object.assign(player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  game.act(player,{kind:'open-shop',target:'vendor'},world(1));
  const token = game.view(player,world(1)).dialogue?.token;
  expect(game.act(player,{kind:'shop-buy',target:'megaphone',token},world(1))).toBe('Compra equipada.');
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['discursoMegafone','cafe','passeio']);
  match.refreshAgendaEligibility();

  const start = 100;
  expect(game.act(player,{kind:'toggle-megaphone'},world(start))).toBe('Megafone ativo.');
  for (let elapsed=5_100;elapsed<=14_900;elapsed+=100) game.tick(world(start+elapsed),true);
  game.tick(world(start+14_950),true);
  const view = (now:number)=>match.view(player.id,[player.id],now).politics!;
  const active = view(start+14_950).missions.active.find(({kind})=>kind==='discursoMegafone')!;
  expect(active.current).toBe(9_950);
  expect(renderToStaticMarkup(<MissionRow mission={active}/>)).toContain('9 / 10 s');

  const after = world(start+15_050);
  const samples:number[] = [];
  game.tick({...after,publish:event=>{
    if (event.type==='megaphone-time') samples.push(event.duration!);
    return after.publish(event);
  }},true);
  expect(samples).toEqual([50]);
  expect(game.megaphoneSpeaker()).toBeUndefined();
  const completed = view(after.now).missions.completed.find(({kind})=>kind==='discursoMegafone')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view(after.now).progression.xp).toBe(35);
});

test('the VIP reservation mission uses a chair the player can actually reserve',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:0,y:0};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,
    (id,kind,replacement)=>game.hasAgendaDecoration(id,kind,replacement));
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(player.id);
  const view = (now:number)=>match.view(player.id,[player.id],now).politics!;
  const world = (now:number)=>match.gameplayWorld([player],now,()=>false);
  let now = 1;
  for (const place of ['technicalVip','lobbyVip','libraryVip','pressVip'] as const) {
    Object.assign(player,npcs.credentialsVendor.interaction);
    game.act(player,{kind:'open-shop',target:'credentialsVendor'},world(now));
    const token = game.view(player,world(now)).dialogue?.token;
    expect(game.act(player,{kind:'shop-buy',target:'vip',token},world(now))).toBe('Compra guardada no inventário.');
    const item = game.view(player,world(now)).inventory.find(item=>item.kind==='vip')!;
    Object.assign(player,installationSites[place].point);
    expect(game.act(player,{kind:'install',place,item:item.id},world(++now))).toBe('Instalando decoração…');
    now += decorationInstallMs;
    game.tick(world(now),true);
  }
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['reserva','privilegioAdquirido','cafe','passeio']);
  match.refreshAgendaEligibility();
  expect(view(now).missions.active.map(({kind})=>kind)).toEqual(['cafe','passeio']);
  const plaque = game.view(player,world(now)).interactive.find(({kind})=>kind==='vip')!;
  expect(game.act(player,{kind:'uninstall',item:plaque.id},world(++now))).toBe('Objeto retirado.');
  const active = view(now).missions.active.find(({kind})=>kind==='reserva')!;
  expect(renderToStaticMarkup(<MissionRow mission={active}/>)).toContain('Reserve uma cadeira');
  expect(game.act(player,{kind:'install',place:'pressVip',item:plaque.id},world(++now))).toBe('Instalando decoração…');
  now += decorationInstallMs;
  game.tick(world(now),true);
  const completed = view(now).missions.completed.find(({kind})=>kind==='reserva')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
});

test('Presença Parlamentar shows the full visit objective and completion check',()=>{
  const mission = {id:1,kind:'presencaPlenario',current:0,target:1} as const;
  const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(active).toContain('Entre e saia do Plenário durante a articulação');
  expect(active).not.toContain('data-done="true"');
  const completed = renderToStaticMarkup(<MissionRow mission={{...mission,current:1}} done/>);
  expect(completed).toContain('data-done="true"');
});

test('the crisis and urgent call instructions use the same limits as the gameserver',()=>{
  const call = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'chamadasUrgentes',current:1,target:2}}/>);
  expect(call).toContain(`Faça chamadas de ${urgentCallMission.minCallMs/1000} segundos com ${urgentCallMission.contacts} colegas diferentes`);
  expect(call).toContain('1 / 2');
  const crisis = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'heroiInesperado',current:0,target:1}}/>);
  expect(crisis).toContain(`Estabilidade abaixo de ${CRISIS_MISSION_STABILITY_LIMIT}`);
});

test('the HUD replaces Fiscalização Paralela when the last foreign safe leaves the match',()=>{
  const players:Player[] = ['Rafa','Bia','Caio'].map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:445,y:143,
  }));
  const [inspector,owner,withoutOffice] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(inspector.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[inspector,owner]);
  Object.assign(inspector,{x:npcs.vendor.x,y:npcs.vendor.y+11});
  const world = match.gameplayWorld(players,1,()=>false);
  game.act(inspector,{kind:'open-shop',target:'vendor'},world);
  game.act(inspector,{kind:'shop-buy',target:'xray',token:game.view(inspector,world).dialogue?.token},world);
  expect(game.owns(inspector.id,'xray')).toBe(true);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,id=>game.hasOffice(id));
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(inspector.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['fiscalizacaoParalela','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const view = ()=>match.view(inspector.id,[inspector.id,withoutOffice.id],10).politics!;
  const renderAgenda = ()=>view().missions.active.map(mission=>renderToStaticMarkup(<MissionRow mission={mission}/>)).join('');

  expect(renderAgenda()).toContain('cofre de outro parlamentar');
  match.setPlayerConnected(owner.id,false);
  expect(renderAgenda()).toContain('cofre de outro parlamentar');
  match.leave(owner.id,10);
  expect(renderAgenda()).not.toContain('cofre de outro parlamentar');
  expect(view().missions.active).toHaveLength(3);
  expect(view().missions.completed).toEqual([]);
  expect(view().progression.xp).toBe(0);
});

test('Flagrante de Gabinete is playable when only the photographer owns an office',()=>{
  const photographer:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,x:445,y:143};
  const visitor:Player = {...photographer,id:'bia',nick:'Bia',character:1};
  const players = [photographer,visitor];
  const match = new PlenaryMatch(1);
  expect(match.start(photographer.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[photographer]);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,id=>game.hasOffice(id));
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(photographer.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['flagraGabinete','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const view = (now:number)=>match.view(photographer.id,players.map(({id})=>id),now).politics!;
  const mission = view(10).missions.active.find(mission=>mission.kind==='flagraGabinete')!;
  expect(renderToStaticMarkup(<MissionRow mission={mission}/>)).toContain('Fotografe um visitante dentro de um gabinete');

  game.act(photographer,{kind:'photo'},match.gameplayWorld(players,100,()=>false));
  expect(view(100).missions.completed).toEqual([]);
  const point = game.officeSpawn(photographer.id)!;
  Object.assign(photographer,point);
  Object.assign(visitor,{x:point.x+6,y:point.y});
  game.act(photographer,{kind:'photo'},match.gameplayWorld(players,3000,()=>false));
  const completed = view(3000).missions.completed.find(mission=>mission.kind==='flagraGabinete')!;
  expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
  expect(view(3000).progression.xp).toBe(45);
});

test.each([true,false])('transfer progress follows the number of remaining distinct senders, available=%s',anotherSender=>{
  const players:Player[] = (anotherSender ? ['Rafa','Bia','Caio','Duda'] : ['Rafa','Bia','Caio']).map((nick,character)=>({
    id:nick,nick,character,direction:0,moving:false,x:445,y:143,
  }));
  const [recipient,credited,next] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(recipient.id,players,0,()=>.9)).toBe(true);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(recipient.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['articulacao','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  const view = (now:number)=>match.view(recipient.id,players.map(({id})=>id),now).politics!;
  const active = (now:number)=>view(now).missions.active.find(mission=>mission.kind==='articulacao');
  const pay = (sender:Player,now:number)=>match.politics(sender,{kind:'transfer',to:recipient.id,amount:1},players,now);
  expect(active(0)?.current).toBe(0);
  expect(pay(credited,1)).toBe(true);
  expect(pay(credited,2)).toBe(true);
  expect(active(2)?.current).toBe(1);
  match.leave((anotherSender ? credited : next).id,3);

  if (anotherSender) {
    expect(renderToStaticMarkup(<MissionRow mission={active(3)!}/>)).toContain('1 / 2');
    expect(pay(next,4)).toBe(true);
    const completed = view(4).missions.completed.find(mission=>mission.kind==='articulacao')!;
    expect(renderToStaticMarkup(<MissionRow mission={completed} done/>)).toContain('data-done="true"');
    expect(view(4).progression.xp).toBe(30);
  } else {
    expect(active(3)).toBeUndefined();
    expect(view(3).missions.active).toHaveLength(3);
    expect(view(3).missions.completed).toEqual([]);
    expect(view(3).progression.xp).toBe(0);
  }
});

test('Bandeja Gourmet appears with two obtainable foods and counts consumption in the office',()=>{
  const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...npcs.snackVendor.interaction};
  const match = new PlenaryMatch(1);
  expect(match.start(player.id,[player],0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,[player]);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,undefined,undefined,id=>game.hasOffice(id));
  const economy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const world = match.gameplayWorld([player],1,()=>false);
  const view = ()=>match.view(player.id,[player.id],1).politics!;
  const render = (done=false)=>view().missions[done ? 'completed' : 'active'].map(mission=>
    renderToStaticMarkup(<MissionRow mission={mission} done={done}/>)).join('');
  const draw = ()=>{
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['bandejaGourmet','cafe','passeio','selfieSolo']);
    match.refreshAgendaEligibility();
  };

  expect(economy.spend(player.id,view().wallet)).toBe(true);
  draw();
  expect(render()).not.toContain('Consuma dois alimentos diferentes');
  economy.earn(player.id,1);
  game.act(player,{kind:'open-shop',target:'snackVendor'},world);
  game.act(player,{kind:'shop-buy',target:'coxinha',token:game.view(player,world).dialogue?.token},world);
  game.act(player,{kind:'shop-buy',target:'coxinha',token:game.view(player,world).dialogue?.token},world);
  expect(view().wallet).toBe(0);
  expect(game.owns(player.id,'coxinha')).toBe(true);
  draw();
  expect(render()).toContain('Consuma dois alimentos diferentes');
  expect(render()).toContain('0 / 2');

  const snack = game.view(player,world).inventory.find(item=>item.kind==='coxinha')!;
  expect(game.act(player,{kind:'use',item:snack.id},world)).toBe('Objeto utilizado.');
  expect(render()).toContain('0 / 2');

  Object.assign(player,stations.coffee);
  expect(game.act(player,{kind:'supply',place:'coffee'},world)).toBe('Objeto guardado no inventário.');
  Object.assign(player,game.officeSpawn(player.id)!);
  let xpAfterCoffee = 0;
  for (const kind of ['coffee','coxinha'] as const) {
    const item = game.view(player,world).inventory.find(item=>item.kind===kind)!;
    expect(game.act(player,{kind:'use',item:item.id},world)).toBe('Objeto utilizado.');
    if (kind==='coffee') {
      expect(render()).toContain('1 / 2');
      xpAfterCoffee = view().progression.xp;
    }
  }
  expect(render(true)).toContain('Consuma dois alimentos diferentes');
  expect(view().progression.xp).toBe(xpAfterCoffee+35);
});

test.each([true,false])('selfies retain distinct colleagues who already counted, credited departure=%s',creditedDeparture=>{
  const photographer:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...stations.coffee};
  const [bia,caio,duda] = ['bia','caio','duda'].map(id=>({...photographer,id,nick:id}));
  let players = [photographer,bia,caio,duda];
  const match = new PlenaryMatch(1);
  expect(match.start(photographer.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,players);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(photographer.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['selfie','cafe','passeio','visitaArquivo']);
  match.refreshAgendaEligibility();

  const view = (now:number)=>match.view(photographer.id,players.map(({id})=>id),now).politics!;
  const render = (now:number,done=false)=>view(now).missions[done ? 'completed' : 'active'].filter(mission=>mission.kind==='selfie').map(mission=>
    renderToStaticMarkup(<MissionRow mission={mission} done={done}/>)).join('');
  const capture = (now:number)=>game.act(photographer,{kind:'selfie'},match.gameplayWorld(players,now,()=>false));
  Object.assign(bia,{x:photographer.x+8});
  Object.assign(caio,npcs.furnitureVendor.interaction);
  Object.assign(duda,npcs.credentialsVendor.interaction);
  capture(100);
  expect(render(100)).toContain('1 / 3');
  capture(3_000);
  expect(render(3_000)).toContain('1 / 3');

  const departing = creditedDeparture ? bia : duda;
  match.leave(departing.id,4_000);
  players = players.filter(person=>person!==departing);
  if (!creditedDeparture) {
    expect(render(4_000)).not.toContain('Tire selfies com três parlamentares diferentes');
    expect(view(4_000).progression.xp).toBe(0);
    return;
  }
  expect(render(4_000)).toContain('1 / 3');
  Object.assign(caio,{x:photographer.x+8,y:photographer.y});
  Object.assign(duda,{x:photographer.x-8,y:photographer.y});
  capture(6_000);
  expect(render(6_000,true)).toContain('Tire selfies com três parlamentares diferentes');
  expect(view(6_000).progression.xp).toBe(35);
});

test('the pizza mission keeps its first slice after that guest leaves',()=>{
  const players:Player[] = ['rafa','bia','caio'].map(id=>({
    id,nick:id,character:0,direction:0,moving:false,...npcs.snackVendor.interaction,
  }));
  const [host,bia,caio] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(host.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,players);
  const world = (now:number)=>match.gameplayWorld(players,now,()=>false);
  const {agenda} = Reflect.get(Reflect.get(match,'economy'),'accounts').get(host.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['fatias','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  game.act(host,{kind:'open-shop',target:'snackVendor'},world(1));
  game.act(host,{kind:'shop-buy',target:'pizza',token:game.view(host,world(1)).dialogue?.token},world(1));
  const pizza = game.view(host,world(1)).inventory.find(item=>item.kind==='pizza')!;
  players.forEach(player=>Object.assign(player,installationSites.pizza.point));
  expect(game.act(host,{kind:'install',place:'pizza',item:pizza.id},world(2))).toBe('Objeto instalado.');

  const view = (now:number)=>match.view(host.id,players.map(({id})=>id),now).politics!;
  const render = (now:number,done=false)=>{
    const mission = view(now).missions[done ? 'completed' : 'active'].find(row=>row.kind==='fatias')!;
    expect(mission).toBeDefined();
    return renderToStaticMarkup(<MissionRow mission={mission} done={done}/>);
  };
  expect(game.act(bia,{kind:'slice',item:pizza.id},world(3))).toBe('Fatia servida.');
  match.leave(bia.id,4);
  players.splice(players.indexOf(bia),1);
  expect(render(4)).toContain('1 / 2');
  expect(game.act(caio,{kind:'slice',item:pizza.id},world(5))).toBe('Fatia servida.');
  expect(render(5,true)).toContain('data-done="true"');
});

test('Solenidade appears with a fresh rival portrait and disappears once another visitor marks it',()=>{
  const players:Player[] = ['rafa','bia','caio'].map(id=>({
    id,nick:id,character:0,direction:0,moving:false,...npcs.credentialsVendor.interaction,
  }));
  const [owner,visitor,rival] = players;
  const match = new PlenaryMatch(1);
  expect(match.start(owner.id,players,0,()=>.9)).toBe(true);
  const game = new Gameplay();
  game.reset(0,()=>.9,players);
  let now = 1;
  const world = ()=>match.gameplayWorld(players,now,()=>false);
  match.setAgendaInventory((id,kind)=>game.owns(id,kind),undefined,
    (id,kind,replacement)=>game.hasAgendaDecoration(id,kind,replacement,now));
  const accounts = Reflect.get(Reflect.get(match,'economy'),'accounts');
  for (const player of players) {
    const {agenda} = accounts.get(player.id);
    Reflect.set(agenda,'missions',[]);
    Reflect.set(agenda,'missionDeck',['solenidadeInauguracao','cafe','passeio','selfieSolo']);
  }
  const view = (player:Player)=>match.view(player.id,players.map(({id})=>id),now).politics!;
  const render = (player:Player,done=false)=>view(player).missions[done ? 'completed' : 'active']
    .map(mission=>renderToStaticMarkup(<MissionRow mission={mission} done={done}/>)).join('');
  const label = 'Rabisque um Retrato Oficial';
  match.refreshAgendaEligibility();
  expect(render(visitor)).not.toContain(label);

  game.act(owner,{kind:'open-shop',target:'credentialsVendor'},world());
  expect(game.act(owner,{kind:'shop-buy',target:'portrait',token:game.view(owner,world()).dialogue?.token},world()))
    .toBe('Compra guardada no inventário.');
  const portrait = game.view(owner,world()).inventory.find(item=>item.kind==='portrait')!;
  players.forEach(player=>Object.assign(player,installationSites.hall.point));
  expect(game.act(owner,{kind:'install',place:'hall',item:portrait.id},world())).toBe('Instalando decoração…');
  now += decorationInstallMs;
  game.tick(world(),true);
  // Eligibility is applied on the next draw when the Agenda already has three missions.
  for (const player of [visitor,rival]) Reflect.set(accounts.get(player.id).agenda,'missions',[]);
  match.refreshAgendaEligibility();
  expect(render(owner)).not.toContain(label);
  expect(render(visitor)).toContain(label);
  expect(render(rival)).toContain(label);

  expect(game.act(rival,{kind:'mark',item:portrait.id},world())).toBe('Retrato rabiscado.');
  expect(render(rival,true)).toContain(label);
  expect(view(rival).progression.xp).toBe(30);
  expect(render(visitor)).not.toContain(label);
  expect(view(visitor).progression.xp).toBe(0);
});
