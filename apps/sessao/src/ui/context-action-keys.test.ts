import {expect,test} from 'bun:test';
import {contextActionKeys} from './context-action-keys';

const action = {kind:'action',visible:true,enabled:true} as const;
const more = {...action,kind:'more',visible:false} as const;
const nearby = {...action,kind:'nearby'} as const;
const item = {...action,kind:'item'} as const;

test('expansion keeps the first three keys and exposes the remaining actions above',()=>{
  const buttons = [action,{...action},{...action},{...action},{...action},more];
  const collapsed = contextActionKeys(buttons,false,false);
  expect(collapsed.buttons.map(button=>button.key)).toEqual(['1','2','3',undefined,undefined,'4']);
  expect(collapsed.showOverflow).toBe(false);
  const expanded = contextActionKeys(buttons,true,false);
  expect(expanded.buttons.map(button=>button.key)).toEqual(['1','2','3','5','6','4']);
  expect(expanded.buttons[3].placement).toBe('overflow');
});

test('objects menu keeps its toggle visible even when it was in the overflow row',()=>{
  const buttons = [action,{...action},{...action},nearby,item,{...item},more];
  const open = contextActionKeys(buttons,false,true);
  expect(open.buttons[3]).toEqual({placement:'primary',key:'1'});
  expect(open.buttons.map(button=>button.key)).toEqual([undefined,undefined,undefined,'1','2','3',undefined]);
  expect(open.showOverflow).toBe(false);
});

test('disabled and hidden controls never claim a key and assignments are capped at nine',()=>{
  const buttons = [nearby,{...item,enabled:false},{...item,visible:false},
    ...Array.from({length:12},()=>({...item})),more];
  const open = contextActionKeys(buttons,false,true);
  expect(open.buttons.slice(0,3).map(button=>button.key)).toEqual(['1',undefined,undefined]);
  const keys = open.buttons.flatMap(button=>button.key ?? []);
  expect(keys).toEqual(['1','2','3','4','5','6','7','8','9']);
});
