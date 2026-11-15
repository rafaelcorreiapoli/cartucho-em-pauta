import {fireRules,fireSites} from '../src/fire';
import { expect, test } from 'bun:test';
import { ELECTION_RULES as rules } from '../src/elections';
import { stations, NEGOTIATION_MS, BALLOT_MS } from '../src/plenary';
import type { Player } from '../src/map';
import { ElectionCycle } from './ElectionCycle';
import { PlenaryMatch } from './PlenaryMatch';

const people = ['a','b','c','d','e','f'].map(id => ({id,name:id.toUpperCase()}));
const players = people.slice(0,3).map(({id,name},character):Player => ({id,nick:name,character,x:140+character*36,y:146,direction:0,moving:false}));
const ids = players.map(({id}) => id);
const at = (player:Player, key:keyof typeof stations):Player => ({...player,...stations[key]});

test('one human loses their mandate, payroll excludes them, and the floor is preserved',()=>{
  const election = new ElectionCycle();
  election.reset(Array.from({length:6},(_,index)=>({id:String(index),name:String(index)})),0,()=>.5);
  election.addDeputy('npc');
  const payroll:string[][] = [];
  const settle = (ids:string[])=>{
    payroll.push(ids);
    return new Map(ids.map(id=>[id,rules.salary]));
  };
  const popularity = (id:string)=>Number(id)*10;
  election.advance(rules.interval,popularity,settle);
  election.advance(rules.interval,popularity,settle);
  expect(payroll).toHaveLength(1);
  expect(payroll[0]).toEqual(['1','2','3','4','5','npc']);
  expect(election.view('0',rules.interval,popularity,true)).toMatchObject({mandate:false,result:{eliminated:'0',salary:0}});
  expect(election.view('1',rules.interval,popularity,true).polls.some(person=>person.id==='npc')).toBe(false);
  for (let cycle=2;cycle<=4;cycle++) election.advance(cycle*rules.interval,popularity,settle);
  expect(payroll).toHaveLength(3);
  expect(payroll.at(-1)).toEqual(['3','4','5','npc']);
});

test('the production match requires six humans, including when NPCs are supplied',()=>{
  const match = new PlenaryMatch();
  const humans = Array.from({length:6},(_,index)=>({...players[0],id:String(index)}));
  expect(match.start('0',[...humans.slice(0,5),{...humans[5],npc:true}],0)).toBe(false);
  expect(match.start('0',humans,0,()=>0)).toBe(true);
  expect(match.view('0',humans.map(p=>p.id),0).mandate).toBe(true);
});

test('TV requires voice and the studio, expires on schedule, and cannot be spammed', () => {
  const match = new PlenaryMatch(1);
  match.start('a',players,0,() => .5);
  const interview = (player:Player, now:number, voice:boolean) => match.electionAction(player,{kind:'interview'},now,voice);
  interview(at(players[0],'tv'),100,false);
  interview(players[0],200,true);
  expect(match.speaker(200)).toBeUndefined();
  interview(at(players[0],'tv'),300,true);
  expect(match.speaker(300)).toBe('a');
  interview(at(players[1],'tv'),400,true);
  expect(match.speaker(400)).toBe('a');
  expect(match.speaker(300+rules.interviewLength)).toBeUndefined();
  interview(at(players[0],'tv'),500+rules.interviewLength+rules.interviewGap,true);
  expect(match.speaker(500+rules.interviewLength+rules.interviewGap)).toBeUndefined();
});

test('private discovery leaves the race intact until the evidence is published', () => {
  const match = new PlenaryMatch(1);
  match.start('a',players,0,() => .9);
  const estimate = () => match.view('c',ids,0).election!.polls.find(p => p.id==='a')!.estimate;
  const before = estimate();
  match.politics(at(players[0],'cabinet'),{kind:'grant',diverted:3},players,2);
  match.act(at(players[1],'audit'),'audit',3);
  expect(estimate()).toBe(before);
  const record = match.view('b',ids,0).politics!.evidence[0];
  expect(record.kind).toBe('diversion');
  match.politics(at(players[1],'press'),{kind:'publish',evidence:record.id},players,4);
  expect(estimate()).toBeLessThan(before);
  expect(match.view('c',ids,0).politics!.ledger).toContainEqual(record);
});

test('payroll is funded by the budget and eliminating both infiltrators wins without stability damage',()=>{
  const match = new PlenaryMatch();
  const humans = Array.from({length:6},(_,index)=>({...players[0],id:String(index)}));
  const ids = humans.map(player=>player.id);
  match.start('0',humans,0,()=>0,2);
  const view = (id:string,now:number)=>match.view(id,ids,now);
  const world = match.gameplayWorld(humans,0,()=>false);
  // Break the initial tie so the two infiltrators finish last in succession.
  for (const player of humans.slice(2)) world.deposit!(player.id,4);
  world.deposit!('1',1);
  match.advance(fireRules.firstAfter);
  const site = view('2',fireRules.firstAfter).fire!.site;
  expect(match.actOnFire({...humans[2],...fireSites[site]},'extinguish',site,fireRules.firstAfter,true)).toBe('Incêndio apagado.');
  match.advance(NEGOTIATION_MS);
  match.vote('2','yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  match.advance(rules.interval-1);
  const before = view('2',rules.interval);
  match.advance(rules.interval);
  const after = view('2',rules.interval);
  expect(after.election?.result?.eliminated).toBe('0');
  expect(view('0',rules.interval)).toMatchObject({mandate:false,phase:'negotiation',election:{result:{salary:0}}});
  expect(after.stability).toBe(before.stability);
  expect(after.budget).toBeCloseTo(before.budget-rules.publicDuty-rules.salary*5);
  expect(after.election?.result?.salary).toBe(rules.salary);
  match.advance(NEGOTIATION_MS*2+BALLOT_MS);
  match.vote('0','yes',NEGOTIATION_MS*2+BALLOT_MS+1);
  expect(view('0',NEGOTIATION_MS*2+BALLOT_MS+1).vote).toBeUndefined();
  expect(match.canHandleObjects('0',NEGOTIATION_MS*2+BALLOT_MS+1)).toBe(true);
  expect(match.gameplayWorld(humans,0,()=>false).hasMandate!('0')).toBe(false);
  match.advance((NEGOTIATION_MS+BALLOT_MS)*2);
  match.advance(rules.interval*2);
  expect(view('2',rules.interval*2)).toMatchObject({winner:'Parlamentar',election:{result:{eliminated:'1'}}});
});

test('a short budget pays equal fractional salaries and preserves the rounding remainder',()=>{
  const match = new PlenaryMatch();
  const humans = Array.from({length:6},(_,index)=>({...players[0],id:String(index)}));
  const ids = humans.map(player=>player.id);
  match.start('0',humans,0,()=>0);
  match.addParliamentarian({...players[0],id:'npc',npc:true});
  match.advance(NEGOTIATION_MS);
  for (const id of ids) match.vote(id,'yes',NEGOTIATION_MS+1);
  match.advance(NEGOTIATION_MS+BALLOT_MS);
  const budget = match.view('0',ids,rules.interval).budget;
  const world = match.gameplayWorld(humans,0,()=>false);
  const npcBefore = world.wallet!('npc');
  match.advance(rules.interval);
  const next = match.view('0',ids,rules.interval);
  expect(budget).toBe(4);
  expect(next.election?.result?.salary).toBe(.2);
  expect(next.budget).toBe(.4);
  expect(world.wallet!('npc')).toBeCloseTo(npcBefore+.2);
  expect(match.view('5',ids,rules.interval).election?.result?.salary).toBe(0);
  const paid = world.wallet!('npc');
  match.advance(rules.interval);
  expect(world.wallet!('npc')).toBe(paid);
});
