import {expect,test} from 'bun:test';
import {PlenaryMatch} from './PlenaryMatch';
import {PoliticalEconomy} from './PoliticalEconomy';
import {PersonalAgenda} from './PersonalAgenda';
import {caloteRules,type GameMode} from '../src/game-modes';
import {ELECTION_RULES} from '../src/elections';
import {payrollRules,stations,CASSATION_NOTICE_MS} from '../src/plenary';
import {cassationFee} from '../src/npcs';
import {HEARING_MS} from '../src/politics';
import type {Player} from '../src/map';

const players:Player[] = ['a','b','c','d','e','f'].map((id,character)=>({id,nick:id,character,x:140+36*character,y:146,direction:0,moving:false}));
const ids = players.map(({id})=>id);
function start(mode:GameMode='calote') {
  const match = new PlenaryMatch(1);
  expect(match.start(ids[0],players,0,()=>.9,1,false,false,false,false,false,false,false,false,mode)).toBe(true);
  return match;
}
const view = (match:PlenaryMatch,now:number)=>match.view(ids[0],ids,now);
function budget(match:PlenaryMatch,balance:number,now:number) {
  Reflect.get(match,'changeBudget').call(match,balance-view(match,now).budget,now);
}

test('calote loses at exactly 30 consecutive debt seconds, not earlier; extra spending never restarts the timer',()=>{
  const match = start();
  budget(match,-1,1_000);
  expect(view(match,1_000)).toMatchObject({gameMode:'calote',budget:-1,caloteIn:30});
  expect(view(match,1_000).debtPenaltyIn).toBeUndefined();
  budget(match,-2,20_000);
  match.advance(30_999);
  expect(match.running).toBe(true);
  expect(view(match,30_999).caloteIn).toBe(1);
  match.advance(31_000);
  expect(view(match,31_000)).toMatchObject({phase:'finished',winner:'Infiltrado',reason:expect.stringContaining('30 segundos')});
});

test.each([0,1])('treasury recovery to %s cancels debt and a later deficit gets a fresh full timer',balance=>{
  const match = start();
  budget(match,-1,0);
  expect(match.gameplayWorld(players,29_999,()=>false).deposit?.(ids[0],1+balance)).toBe(true);
  expect(view(match,29_999).caloteIn).toBeUndefined();
  match.advance(30_000);
  expect(match.running).toBe(true);
  budget(match,-1,31_000);
  expect(view(match,31_000).caloteIn).toBe(30);
  match.advance(60_999);
  expect(match.running).toBe(true);
  match.advance(61_000);
  expect(view(match,61_000).winner).toBe('Infiltrado');
});

test('a deposit at the debt deadline cannot rescue an already expired calote',()=>{
  const match = start();
  budget(match,-1,0);
  expect(match.gameplayWorld(players,30_000,()=>false).deposit?.(ids[0],2)).toBe(false);
  expect(view(match,30_000)).toMatchObject({phase:'finished',winner:'Infiltrado'});
});

test('salary remains recurring, starts debt at the scheduled payment, and late ticks do not extend the deadline',()=>{
  const match = start();
  budget(match,0,0);
  const before = view(match,0).politics!.wallet;
  match.advance(payrollRules.interval+10_000);
  expect(view(match,payrollRules.interval+10_000)).toMatchObject({budget:-players.length*payrollRules.salary,caloteIn:20});
  expect(view(match,payrollRules.interval+10_000).politics!.wallet).toBe(before+payrollRules.salary);
  match.advance(payrollRules.interval+caloteRules.debtMs);
  expect(view(match,payrollRules.interval+caloteRules.debtMs).winner).toBe('Infiltrado');
  const delayed = start();
  delayed.advance(ELECTION_RULES.matchDuration);
  expect(view(delayed,ELECTION_RULES.matchDuration).winner).toBe('Infiltrado');
});

test('survival ignores stability and debt wins if its deadline coincides with session end',()=>{
  const survives = start();
  Reflect.set(survives,'nextPayrollAt',ELECTION_RULES.matchDuration);
  Reflect.set(survives,'stability',0);
  survives.advance(ELECTION_RULES.matchDuration);
  expect(view(survives,ELECTION_RULES.matchDuration)).toMatchObject({winner:'Parlamentar',phase:'finished'});
  const loses = start();
  Reflect.set(loses,'nextPayrollAt',ELECTION_RULES.matchDuration);
  budget(loses,-1,ELECTION_RULES.matchDuration-caloteRules.debtMs);
  loses.advance(ELECTION_RULES.matchDuration);
  expect(view(loses,ELECTION_RULES.matchDuration).winner).toBe('Infiltrado');
});

test('an unfinished debt countdown at session end does not erase successful survival',()=>{
  const match = start();
  Reflect.set(match,'nextPayrollAt',ELECTION_RULES.matchDuration);
  budget(match,-1,ELECTION_RULES.matchDuration-10_000);
  match.advance(ELECTION_RULES.matchDuration);
  expect(view(match,ELECTION_RULES.matchDuration).winner).toBe('Parlamentar');
});

test('fire and public investments do not change stability in calote, and stability-only missions are absent',()=>{
  const match = start();
  const before = view(match,0).stability;
  Reflect.get(match,'fire').startTraining(0);
  match.advance(50_000);
  expect(view(match,50_000).stability).toBe(before);
  const deputy = {...players[0],...stations.cabinet};
  match.politics(deputy,{kind:'grant',area:'health',amount:2,diversion:0},players,50_001);
  expect(view(match,50_001).stability).toBe(before);
  const agenda = new PersonalAgenda({wallet:100,popularity:40},6,()=>0,()=>{},new Set(),true,true,true,true,true,true,true,'calote');
  expect(Reflect.get(agenda,'missionDeck')).not.toContain('heroiInesperado');
});

test('classic debt keeps its stability penalty instead of causing a calote',()=>{
  const match = start('classic');
  budget(match,-1,0);
  const before = view(match,0).stability;
  match.advance(30_000);
  expect(match.running).toBe(true);
  expect(view(match,30_000).stability).toBeLessThan(before);
  expect(view(match,30_000).caloteIn).toBeUndefined();
});

test('cassation still eliminates infiltrators and wins calote before the session deadline',()=>{
  const match = start();
  const economy = Reflect.get(match,'economy') as PoliticalEconomy;
  economy.earn(ids[0],cassationFee);
  Reflect.set(match,'cassationReadyAt',0); // This scenario tests the ballot, not its opening cooldown.
  expect(match.callCassation({...players[0],...stations.audit},1)).toBeUndefined();
  const opens = 1+CASSATION_NOTICE_MS;
  match.advance(opens);
  const infiltrator = ids.find(id=>match.view(id,ids,opens).role==='Infiltrado')!;
  for (const id of ids) match.castCassation(id,infiltrator,opens+1);
  match.advance(opens+HEARING_MS);
  expect(view(match,opens+HEARING_MS).winner).toBe('Parlamentar');
});

test('rematches reset the debt clock and may return to classic',()=>{
  const match = start();
  budget(match,-1,0);
  match.advance(30_000);
  expect(match.start(ids[0],players,40_000,()=>.9,1,false,false,false,false,false,false,false,false,'classic')).toBe(true);
  expect(view(match,40_000)).toMatchObject({gameMode:'classic',budget:ELECTION_RULES.startingBudget});
  expect(view(match,40_000).caloteIn).toBeUndefined();
});

test('electoral elimination of the last infiltrator still wins calote',()=>{
  const match = new PlenaryMatch(1);
  match.start(ids[0],players,0,()=>.9,1,false,false,false,true,false,false,false,false,'calote');
  const infiltrator = ids.find(id=>match.view(id,ids,0).role==='Infiltrado')!;
  (Reflect.get(match,'economy') as PoliticalEconomy).changePopularity(infiltrator,-40);
  budget(match,1_000,0);
  match.advance(ELECTION_RULES.interval);
  expect(view(match,ELECTION_RULES.interval).winner).toBe('Parlamentar');
});

test('calote countdown follows the same paused match clock as salaries and session duration during ballots',()=>{
  const match = start();
  (Reflect.get(match,'economy') as PoliticalEconomy).earn(ids[0],cassationFee);
  Reflect.set(match,'cassationReadyAt',0); // This scenario tests the ballot, not its opening cooldown.
  expect(match.callCassation({...players[0],...stations.audit},0)).toBeUndefined();
  budget(match,-1,CASSATION_NOTICE_MS-1_000);
  match.advance(CASSATION_NOTICE_MS);
  expect(view(match,CASSATION_NOTICE_MS).caloteIn).toBe(29);
  match.advance(CASSATION_NOTICE_MS+HEARING_MS-1);
  expect(view(match,CASSATION_NOTICE_MS+HEARING_MS-1).caloteIn).toBe(29);
  match.advance(CASSATION_NOTICE_MS+HEARING_MS);
  match.advance(CASSATION_NOTICE_MS+HEARING_MS+29_000);
  expect(view(match,CASSATION_NOTICE_MS+HEARING_MS+29_000).winner).toBe('Infiltrado');
});

test('a partial deposit that leaves the budget negative does not restart the debt timer',()=>{
  const match = start();
  budget(match,-3,0);
  expect(match.gameplayWorld(players,25_000,()=>false).deposit?.(ids[0],1)).toBe(true);
  expect(view(match,25_000)).toMatchObject({budget:-2,caloteIn:5});
  match.advance(30_000);
  expect(view(match,30_000).winner).toBe('Infiltrado');
});
