import {expect,test} from 'bun:test';
import {AutomaticProjects} from './AutomaticProjects';
import {PlenaryMatch} from './PlenaryMatch';
import {Gameplay} from './Gameplay';
import {CharacterProgression} from './CharacterProgression';
import {automaticProjectRules,type AutomaticProject} from '../src/automatic-projects';
import {privateOffices,officeRules} from '../src/private-offices';
import {INVENTORY_SLOTS,itemQuantity} from '../src/gameplay';
import type {Player} from '../src/map';

const players:Player[] = ['a','b','c','d','e','f'].map((id,character)=>({id,nick:id,character,x:140,y:146,direction:0,moving:false}));
const ids = players.map(p=>p.id);
function setup(enabled=true,mode:'classic'|'calote'='calote') {
  const match = new PlenaryMatch(1);
  match.start('a',players,0,()=>.9,2,false,false,false,false,false,false,false,false,mode,enabled);
  Reflect.get(match,'cash').spawned += 968;
  Reflect.set(match,'budget',1000);
  return match;
}
const view = (match:PlenaryMatch,at:number)=>match.view('a',ids,at);

test('automatic projects begin at five minutes, repeat every 90 seconds, hide the future and stop after four',()=>{
  for (const random of [()=>0,()=>.5,()=>.99]) {
    const projects = new AutomaticProjects();
    projects.reset(true,1000,random);
    expect(projects.view(1000,true)).toEqual({approved:[],total:4,nextIn:300,announcement:undefined});
    for (const at of [301000,391000,481000,571000]) {
      expect(projects.nextAt).toBe(at);
      projects.approve(6);
      expect(projects.view(at,true)?.announcement?.at).toBe(at);
      expect(projects.view(at+automaticProjectRules.announcementMs,true)?.announcement).toBeUndefined();
    }
    expect(projects.nextAt).toBeUndefined();
    expect(new Set(projects.view(600000,true)?.approved.map(p=>p.project)).size).toBe(4);
    projects.reset(false,0,random);
    expect(projects.view(0,true)).toBeUndefined();
    projects.reset(true,0,random);
    expect(projects.view(0,true)?.approved).toEqual([]);
  }
});

test('project expenses are charged exactly once and all effects reach living mandates including infiltrators',()=>{
  const match = setup();
  const deliveries:{recipients:readonly string[];project:AutomaticProject}[] = [];
  const advance = (at:number)=>match.advance(at,undefined,undefined,(recipients,project)=>deliveries.push({recipients,project}));
  advance(299999);
  expect(view(match,299999).automaticProjects?.approved).toEqual([]);
  advance(570000);
  const approved = view(match,570000).automaticProjects!.approved;
  expect(approved).toHaveLength(4);
  expect(approved.reduce((sum,p)=>sum+p.cost,0)).toBe(24);
  expect(deliveries).toHaveLength(2);
  for (const delivery of deliveries) expect([...delivery.recipients].sort()).toEqual(ids);
  for (const id of ids) expect(match.view(id,ids,570000).politics?.progression.available).toBe(2);
  const summary = match.economySummary(0);
  expect(summary.projects).toBe(24);
  advance(570000);
  expect(match.economySummary(0)).toEqual(summary);
});

test('salary increase preserves the previous receipt, applies next payday and accounts for exact quarter units',()=>{
  const match = setup();
  Reflect.set(Reflect.get(match,'automaticProjects'),'order',['reajuste']);
  match.advance(300000);
  expect(view(match,300000).payroll?.last?.received).toBe(1);
  expect(view(match,300000).payroll?.next?.cost).toBe(7.5);
  const before = view(match,300000).politics!.wallet;
  match.advance(360000);
  expect(view(match,360000).politics!.wallet-before).toBe(1.25);
  expect(view(match,360000).payroll?.last?.received).toBe(1.25);
  expect(view(match,360000).budget).toBe(959.5-match.economySummary(0).incidents);
  Reflect.get(match,'economy').spend('a',.1);
  expect(match.economySummary(0).discrepancy).toBe(0);
  const economy = Reflect.get(match,'economy');
  const wallet = economy.wallet('a');
  expect(economy.takeWallet('a')).toBe(wallet);
  expect(economy.wallet('a')).toBe(0);
});

test('project can cause debt; an expired debt countdown ends the game before a due project',()=>{
  const match = setup();
  Reflect.set(Reflect.get(match,'automaticProjects'),'order',['porrete']);
  Reflect.set(match,'budget',32);
  match.advance(300000);
  expect(view(match,300000)).toMatchObject({budget:-4,caloteIn:30});
  match.advance(330000);
  expect(view(match,330000).winner).toBe('Infiltrado');
  const expired = setup();
  Reflect.set(expired,'budget',1);
  expired.advance(300000);
  expect(view(expired,300000).automaticProjects?.approved).toEqual([]);
});

test('classic, disabled mode and tutorials have no automatic approvals or salary changes',()=>{
  for (const [enabled,mode] of [[false,'calote'],[true,'classic']] as const) {
    const match = setup(enabled,mode);
    match.advance(570000);
    expect(view(match,570000).automaticProjects).toBeUndefined();
    expect(view(match,570000).payroll?.last?.received).toBe(1);
  }
  const training = new PlenaryMatch(1);
  training.training = true;
  training.start('a',players,0,()=>.9,2,false,false,false,false,false,false,false,false,'calote',true);
  expect(view(training,0).automaticProjects).toBeUndefined();
});

test('bonus points allocate without XP, cannot be replayed and disappear in a fresh progression',()=>{
  const progression = new CharacterProgression(1);
  progression.grantPoints(2);
  expect(progression.view()).toMatchObject({xp:0,level:1,available:2});
  expect(progression.allocate({attribute:'burglary',matchId:1,revision:0})).toBe(true);
  expect(progression.allocate({attribute:'mobility',matchId:1,revision:0})).toBe(false);
  expect(progression.allocate({attribute:'mobility',matchId:1,revision:1})).toBe(true);
  expect(progression.allocate({attribute:'burglary',matchId:1,revision:2})).toBe(false);
  expect(new CharacterProgression(2).view().available).toBe(0);
});

test('project items stack in inventory and overflow to the personal cabinet, then the office floor',()=>{
  const game = new Gameplay();
  game.reset(0,()=>.5,players);
  const inventory = ()=>Reflect.get(game,'inventory').call(game,'a') as {data:{kind:string;quantity?:number}}[];
  game.distributeProjectItems('a','energyDrink',5);
  expect(inventory().filter(item=>item.data.kind==='energyDrink').map(item=>itemQuantity(item.data))).toEqual([5]);
  for (let i=inventory().length;i<INVENTORY_SLOTS;i++) Reflect.get(game,'create').call(game,'baton',{holder:'a'});
  const office = privateOffices.find(office=>office.id===Reflect.get(game,'privateOffices').ownedBy('a').id)!;
  const stash = ()=>Reflect.get(game,'officeStash').call(game,office.id) as unknown[];
  game.distributeProjectItems('a','energyDrink',5);
  expect(stash()).toHaveLength(0);
  game.distributeProjectItems('a','baton',officeRules.stashSlots+1);
  expect(stash()).toHaveLength(officeRules.stashSlots);
  const ground = [...(Reflect.get(game,'items') as Map<number,{data:{kind:string};place:{ground?:{x:number;y:number}}}>).values()].filter(item=>item.place.ground);
  expect(ground.some(item=>item.data.kind==='baton' && item.place.ground?.x===office.spawn.x && item.place.ground?.y===office.spawn.y)).toBe(true);
});

test('automatic countdown pauses during cassation ballots and restarts cleanly on rematch',()=>{
  const match = setup();
  const before = view(match,0).automaticProjects!.nextIn;
  Reflect.get(match,'openVote').call(match,'hearing',0,0,35000);
  expect(view(match,34000).automaticProjects!.nextIn).toBe(before);
  match.advance(35000);
  expect(view(match,35000).automaticProjects!.nextIn).toBe(before);
  match.advance(35001);
  expect(view(match,35001).automaticProjects!.approved).toEqual([]);
  Reflect.set(match,'phase','finished');
  expect(match.start('a',players,40000,()=>.9,2,false,false,false,false,false,false,false,false,'calote',true)).toBe(true);
  expect(view(match,40000).automaticProjects).toMatchObject({approved:[],total:4,nextIn:300});
});

test('eliminated mandates do not receive items or count toward project costs',()=>{
  const match = setup();
  Reflect.get(match,'election').leave('b',0);
  const received:string[][] = [];
  match.advance(300000,undefined,undefined,recipients=>received.push([...recipients]));
  expect(view(match,300000).automaticProjects?.approved[0].recipients).toBe(5);
  for (const recipients of received) expect(recipients).not.toContain('b');
});
