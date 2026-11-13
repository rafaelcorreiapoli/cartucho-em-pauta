import {expect,test} from 'bun:test';
import {manualTransfer} from './politics-panel';

test('informal loans and repayments are manual payments selected by the player',()=>{
  expect(manualTransfer('borrower',3,true)).toEqual({kind:'transfer',to:'borrower',amount:3,clandestine:true});
  expect(manualTransfer('lender',3,false)).toEqual({kind:'transfer',to:'lender',amount:3,clandestine:false});
  expect(manualTransfer('',3,false)).toBeUndefined();
  expect(manualTransfer('lender',0,false)).toBeUndefined();
});
