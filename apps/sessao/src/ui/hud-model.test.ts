import {expect,test} from 'bun:test';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {PoliticalEconomy} from '../../server/PoliticalEconomy';
import {missionReward} from '../politics';
import type {Player} from '../map';
import {NEGOTIATION_MS} from '../plenary';
import {terminals} from '../gameplay';
import {createHudModel} from './hud-model';

const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...terminals.coffee.point};

test('movement snapshots only notify stamina consumers when the displayed value changes',()=>{
  const hud = createHudModel();
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  hud.profile.subscribe(()=>updates.push('profile'));
  const unsubscribe = hud.stamina.subscribe(()=>updates.push('stamina'));
  hud.player({...player,stamina:89.9,staminaMax:110});
  const snapshot = hud.stamina.get();
  const moved = {...player,x:player.x+10,stamina:89.1,staminaMax:110};
  hud.player(moved);
  expect(hud.stamina.get()).toBe(snapshot);
  expect(snapshot).toEqual({current:89,max:110});
  expect(updates).toEqual(['stamina']);
  unsubscribe();
  hud.player({stamina:90,staminaMax:110});
  expect(updates).toEqual(['stamina']);
});

test('a server mission completion updates agenda and XP without repainting public metrics',()=>{
  const hud = createHudModel();
  const match = new PlenaryMatch(1);
  match.start(player.id,[{...player}],0,()=>0);
  const view = ()=>match.view(player.id,[player.id],0);
  hud.render(view());
  expect(hud.agenda.get()?.active.some(mission=>mission.kind==='cafe')).toBe(true);
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.profile.subscribe(()=>updates.push('profile'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  expect(match.roomActivity(player,'coffee',1)?.activity).toBe('coffee');
  hud.render(view());
  hud.render(view());
  expect(updates).toEqual(['profile','agenda']);
  expect(hud.profile.get()?.xp).toBe(20);
  expect(hud.agenda.get()?.announcement).toContain('Concluído');
  expect(hud.agenda.get()?.recent.map(mission=>mission.kind)).toEqual(['cafe']);

  const reconnected = createHudModel();
  reconnected.render(view());
  expect(reconnected.profile.get()).toEqual(hud.profile.get());
  expect(reconnected.agenda.get()?.recent).toEqual(hud.agenda.get()?.recent);
  expect(reconnected.agenda.get()?.announcement).toBe('');

  hud.render({...view(),phase:'lobby'});
  expect(hud.profile.get()).toBeUndefined();
  expect(hud.resources.get()).toBeUndefined();
  expect(hud.agenda.get()).toBeUndefined();
});

test('the television notice follows the interview lifecycle and ignores unrelated snapshots',()=>{
  const hud = createHudModel();
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  const updates:unknown[] = [];
  hud.television.subscribe(()=>updates.push(hud.television.get()));
  const view = match.view(player.id,[player.id],1);
  const election = view.election!;
  const active = {...view,election:{...election,broadcast:{id:player.id,name:player.nick,remaining:12}}};
  hud.render(active);
  hud.render({...active,budget:active.budget-1});
  expect(updates).toEqual([{name:'Rafa',remaining:12}]);
  hud.render(view);
  expect(updates).toEqual([{name:'Rafa',remaining:12},undefined]);
  hud.render(active);
  hud.render({...active,phase:'finished'});
  expect(hud.television.get()).toBeUndefined();
});

test('the central countdown follows the authoritative last 30 seconds before voting',()=>{
  const match = new PlenaryMatch(1);
  const hud = createHudModel();
  match.start(player.id,[{...player}],0,()=>0);
  const render = (now:number) => hud.render(match.view(player.id,[player.id],now));
  const deadline = match.view(player.id,[player.id],0).remaining*1000;
  render(deadline-31_000);
  expect(hud.countdown.get()).toBeUndefined();
  render(deadline-30_000);
  expect(hud.countdown.get()).toEqual({kind:'bill',seconds:30});
  render(deadline-1000);
  expect(hud.countdown.get()).toEqual({kind:'bill',seconds:1});
  hud.render({...match.view(player.id,[player.id],deadline-1000),cassationIn:20});
  expect(hud.countdown.get()).toEqual({kind:'cassation',seconds:20});
  match.advance(deadline);
  render(deadline);
  expect(hud.countdown.get()).toBeUndefined();
});

test('replayed pizza installation leaves the HUD unchanged until a valid Pizzada is completed',()=>{
  const players = [player,...['bia','caio','dani'].map(id=>({...player,id,nick:id}))];
  const ids = players.map(({id})=>id);
  const match = new PlenaryMatch(1);
  match.start(player.id,players,0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  const event = {actor:player.id,position:terminals.coffee.point,item:15,kind:'pizza'} as const;
  const installation = {...event,type:'installed',at:1} as const;
  const serve = (at:number)=>{
    for (const [index,target] of ids.slice(1).entries()) {
      economy.recordGameplay({...event,type:'slice',target,at:at+index,witnesses:[]});
    }
  };
  economy.recordGameplay({...installation,witnesses:[]});
  economy.recordOfficialScandal();
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['pizzada','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();

  const hud = createHudModel();
  const render = ()=>hud.render(match.view(player.id,ids,0));
  render();
  const previous = hud.agenda.get();
  expect(previous?.active).toContainEqual(expect.objectContaining({kind:'pizzada',current:0}));
  const xp = hud.profile.get()?.xp ?? 0;
  let agendaUpdates = 0;
  hud.agenda.subscribe(()=>agendaUpdates++);

  economy.recordGameplay({...installation,witnesses:[]});
  serve(2);
  render();
  expect(hud.agenda.get()).toBe(previous);
  expect(hud.profile.get()?.xp).toBe(xp);
  expect(agendaUpdates).toBe(0);

  economy.recordGameplay({...installation,at:10,witnesses:[]});
  serve(11);
  render();
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'pizzada',current:3}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('pizzada').xp);
  expect(agendaUpdates).toBe(1);
});

test('the HUD replaces a credited voting mission without offering it again on the last ballot',()=>{
  const match = new PlenaryMatch(1);
  match.start(player.id,[player],0,()=>0);
  Reflect.set(match,'round',2);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(player.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['votacao','apoio','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  match.advance(NEGOTIATION_MS);
  const hud = createHudModel();
  const render = ()=>hud.render(match.view(player.id,[player.id],NEGOTIATION_MS+1));
  render();
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).toContain('votacao');
  match.vote(player.id,'no',NEGOTIATION_MS+1);
  render();
  expect(hud.agenda.get()?.recent.map(mission=>mission.kind)).toContain('votacao');
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).not.toContain('votacao');
  expect(hud.agenda.get()?.active.map(mission=>mission.kind)).toContain('apoio');
});

test('the HUD receives both campaign investments settled at the same server time',()=>{
  const match = new PlenaryMatch(1);
  const candidate = {...player,...terminals.press.point};
  match.start(candidate.id,[candidate],0,()=>0);
  const economy:PoliticalEconomy = Reflect.get(match,'economy');
  const {agenda} = Reflect.get(economy,'accounts').get(candidate.id);
  Reflect.set(agenda,'missions',[]);
  Reflect.set(agenda,'missionDeck',['investimentoPolitico','cafe','passeio','selfieSolo']);
  match.refreshAgendaEligibility();
  const hud = createHudModel();
  const render = ()=>hud.render(match.view(candidate.id,[candidate.id],10));
  match.electionAction(candidate,{kind:'invest',amount:2},10,false);
  render();
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'investimentoPolitico',current:2}));
  match.electionAction(candidate,{kind:'invest',amount:2},10,false);
  render();
  expect(hud.agenda.get()?.active).toContainEqual(expect.objectContaining({kind:'investimentoPolitico',current:4}));
  const xp = hud.profile.get()?.xp ?? 0;
  match.electionAction(candidate,{kind:'invest',amount:1},10,false);
  render();
  expect(hud.agenda.get()?.recent).toContainEqual(expect.objectContaining({kind:'investimentoPolitico',current:5}));
  expect(hud.profile.get()?.xp).toBe(xp+missionReward('investimentoPolitico').xp);
});
