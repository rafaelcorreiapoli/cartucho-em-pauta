import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {stabilityRules} from '../plenary';
import {MissionRow, ParliamentMetrics} from './hud';
import {agendaDurationMs,targetedAgendas,type Mission} from '../politics';

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
  expect(markup).toContain('Antecâmara ou nas Comissões');
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

test('coffee delivery shows distinct recipient progress and the completion check',()=>{
  const mission = {id:9,kind:'entrega',current:2,target:3} as const;
  const active = renderToStaticMarkup(<MissionRow mission={mission}/>);
  expect(active).toContain('Entregue cafezinho a três jogadores diferentes.');
  expect(active).toContain('2 / 3');
  const done = renderToStaticMarkup(<MissionRow mission={{...mission,current:3}} done/>);
  expect(done).toContain('data-done="true"');
  expect(done).not.toContain('2 / 3');
});

test('campaign investment and phone call missions show the units players need',()=>{
  const investment = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'investimentoPolitico',current:2,target:5}}/>);
  const phone = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'debateTelefonico',current:12_500,target:20_000}}/>);
  expect(investment).toContain('R$ 20 mil / R$ 50 mil');
  expect(phone).toContain('12 / 20 s');
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

test('savings shows net progress in reais and Pauta Prioritária names the deadline',()=>{
  const savings = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'poupancaInstitucional',current:7.5,target:10}}/>);
  const gift = renderToStaticMarkup(<MissionRow mission={{id:2,kind:'pautaPrioritaria',current:0,target:1}}/>);
  expect(savings).toContain('R$ 75 mil / R$ 100 mil');
  expect(gift).toContain('Presente Institucional antes da votação');
});

test('Segurança Parlamentar explains continuous proximity and renders server time',()=>{
  const markup = renderToStaticMarkup(<MissionRow mission={{id:1,kind:'segurancaParlamentar',current:6000,target:10_000}}/>);
  expect(markup).toContain('mesmo parlamentar');
  expect(markup).toContain('sem atacar');
  expect(markup).toContain('6 / 10 s');
});
