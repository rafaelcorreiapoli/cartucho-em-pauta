import {expect,test} from 'bun:test';
import {treatmentAction} from './treatment-action';

test('the infirmary offers free treatment to the player or their passenger',()=>{
  expect(treatmentAction(undefined)).toBeUndefined();
  expect(treatmentAction({})).toEqual({label:'Consultar Drauzio Varella · Grátis'});
  expect(treatmentAction({target:'passenger'})).toEqual({label:'Atender jogador carregado · Grátis'});
});
