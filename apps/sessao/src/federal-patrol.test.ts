import {expect,test} from 'bun:test';
import {federalAudioStage} from './federal-patrol';
import {applyInput,type ControlState} from './movement';

test('Federal audio follows authoritative capture and arrival edges exactly once',()=>{
  const free={isolated:false},caught={isolated:true,detaining:true},cell={isolated:true};
  expect(federalAudioStage(free,caught)).toBe('caught');
  expect(federalAudioStage(caught,caught)).toBeUndefined();
  expect(federalAudioStage(caught,cell)).toBe('isolated');
  expect(federalAudioStage(cell,cell)).toBeUndefined();
  expect(federalAudioStage(undefined,cell)).toBeUndefined();
  expect(federalAudioStage(caught,free)).toBe('cancelled');
  expect(federalAudioStage(free,cell)).toBeUndefined();
});

test('movement prediction cannot move a detainee before transfer, including door inputs',()=>{
  const state:ControlState={player:{id:'a',nick:'A',character:0,x:140,y:146,direction:0,moving:false},route:[{x:200,y:146}],ack:0,isolated:true,detaining:true};
  applyInput(state,{seq:1,motion:{x:1,y:1}});
  applyInput(state,{seq:2,door:0});
  expect(state.player).toMatchObject({x:140,y:146,moving:false});
  expect(state.route).toEqual([]);
  expect(state.ack).toBe(2);
});
