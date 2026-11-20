import {expect,test} from 'bun:test';
import {KnockoutAnnouncements} from './KnockoutAnnouncements';
import type {Player} from '../src/map';

test('first blood is anonymous and once per match; knockouts reach only nearby listeners once',()=>{
  const tracker = new KnockoutAnnouncements();
  const target = {id:'victim',x:100,y:100} as Player;
  const listeners = [target,{id:'near',x:120,y:100},{id:'far',x:300,y:100}] as Player[];
  let first = 0;
  const heard:{id:string;level:number;pan:number}[] = [];
  const update = ()=>tracker.update([target],listeners,()=>first++,(id,level,pan)=>heard.push({id,level,pan}));
  update();
  expect(first).toBe(0);
  target.knockedOut = true;
  update();
  expect(first).toBe(1);
  expect(heard.map(cue=>cue.id)).toEqual(['victim','near']);
  expect(heard[0]).toEqual({id:'victim',level:1,pan:0});
  expect(heard[1].level).toBeGreaterThan(0);
  expect(heard[1].level).toBeLessThan(1);
  expect(heard[1].pan).toBeLessThan(0);
  update();
  expect(heard).toHaveLength(2);
  target.knockedOut = undefined;
  update();
  target.knockedOut = true;
  update();
  expect(first).toBe(1);
  expect(heard).toHaveLength(4);
  tracker.reset();
  update();
  expect(first).toBe(2);
});

test('simultaneous knockouts trigger one global announcement, including ghost advisers',()=>{
  const tracker = new KnockoutAnnouncements();
  let first = 0;
  tracker.update([{id:'a',x:0,y:0,knockedOut:true},{id:'npc-ghost-adviser-1',x:0,y:0,knockedOut:true}] as Player[],[],()=>first++,()=>{});
  expect(first).toBe(1);
});
