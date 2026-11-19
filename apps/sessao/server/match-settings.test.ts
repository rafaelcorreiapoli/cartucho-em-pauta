import {expect,test} from 'bun:test';
import {PlenaryMatch} from './PlenaryMatch';
import {stations} from '../src/plenary';
import {institutionalActions} from '../src/ui/institutional-actions';
import type {Player} from '../src/map';
const player:Player = {id:'a',nick:'Rafa',character:0,...stations.cabinet,direction:0,moving:false};
function start(grants:boolean,budget:number,minutes:number) {
  const match = new PlenaryMatch(1);
  expect(match.start('a',[player],0,()=>.9,1,false,true,false,false,true,true,true,true,'classic',false,grants,budget,minutes)).toBe(true);
  return match;
}
test.each([12,15,20])('session deadline respects %s minutes',minutes=>{
  const match = start(true,50,minutes);
  expect(match.view('a',['a'],0).sessionRemaining).toBe(minutes*60);
  expect(Reflect.get(match,'sessionEndsAt')).toBe(minutes*60_000);
});
test.each([-50,0,50])('starting budget %s is applied',budget=>{
  const match = start(true,budget,12);
  expect(match.view('a',['a'],0).budget).toBe(budget);
});
test.each([true,false])('grant UI and server authorization agree when enabled=%s',enabled=>{
  const match = start(enabled,50,12);
  expect(!!institutionalActions(match.view('a',['a'],1),player).grant).toBe(enabled);
  match.politics(player,{kind:'grant',area:'health',amount:2,diversion:0},[player],1);
  expect(match.view('a',['a'],1).budget).toBe(enabled ? 48 : 50);
});
