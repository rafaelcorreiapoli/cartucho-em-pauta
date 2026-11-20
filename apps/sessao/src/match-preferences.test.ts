import {afterEach,expect,test} from 'bun:test';
import {readMatchPreferences,saveMatchPreference} from './match-preferences';

const original = Object.getOwnPropertyDescriptor(globalThis,'localStorage');
afterEach(()=>{
  if (original) Object.defineProperty(globalThis,'localStorage',original);
  else Reflect.deleteProperty(globalThis,'localStorage');
});
function storage(initial:string|null=null) {
  let value = initial;
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem:()=>value,setItem:(_key:string,next:string)=>{value=next;}}});
}
test('keeps independent choices, including false and zero, across reads',()=>{
  storage();
  saveMatchPreference('lobby-grants',{enabled:false});
  saveMatchPreference('lobby-npc-count',{count:0});
  saveMatchPreference('infiltrators',{count:1});
  expect(readMatchPreferences()).toEqual({'lobby-grants':{enabled:false},'lobby-npc-count':{count:0},infiltrators:{count:1}});
});
test('ignores malformed storage, invalid values and unrelated commands',()=>{
  storage('{');
  expect(readMatchPreferences()).toEqual({});
  storage('{"lobby-game-mode":{"mode":"unknown"},"lobby-grants":{"enabled":false,"extra":1},"start-match":{"infiltrators":2}}');
  saveMatchPreference('lobby-match-minutes',{value:999});
  saveMatchPreference('start-match',{infiltrators:2});
  expect(readMatchPreferences()).toEqual({'lobby-grants':{enabled:false}});
});
test('storage access failures do not interrupt play',()=>{
  Object.defineProperty(globalThis,'localStorage',{configurable:true,get:()=>{throw new Error('blocked');}});
  expect(readMatchPreferences()).toEqual({});
  expect(()=>saveMatchPreference('lobby-grants',{enabled:false})).not.toThrow();
});
