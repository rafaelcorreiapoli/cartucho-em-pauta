import {expect,test} from 'bun:test';
import {infirmary} from '../medical';
import {money} from '../politics';
import {contextActionKeys} from './context-action-keys';
import {treatmentAction} from './treatment-action';

test('the infirmary displays the authoritative price and leaves the shortcut free when unavailable',()=>{
  expect(treatmentAction(undefined)).toBeUndefined();
  const price = infirmary.price;
  const blocked = treatmentAction({target:'passenger',price,affordable:false},100)!;
  expect(blocked).toEqual({label:'Atender carregado · '+money(price),disabled:true});
  const available = treatmentAction({price,affordable:true},0)!;
  expect(available).toEqual({label:'Consultar '+infirmary.doctor.name+' · '+money(price),disabled:false});
  const shortcuts = contextActionKeys([blocked,available].map(({disabled})=>({
    kind:'action',visible:true,enabled:!disabled,
  })),false,false);
  expect(shortcuts.buttons.map(({key})=>key)).toEqual([undefined,'1']);
  expect(treatmentAction({},price)?.disabled).toBe(false);
  expect(treatmentAction({},price-.1)?.disabled).toBe(true);
});
