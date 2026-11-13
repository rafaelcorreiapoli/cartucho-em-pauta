import {expect,test} from 'bun:test';
import {createPoliticsSender,readTransferToken,type PoliticsCommand} from './politics';
import {manualTransfer} from './politics-panel';

test('informal loans and repayments are manual payments selected by the player',()=>{
  expect(manualTransfer('borrower',3,true)).toEqual({kind:'transfer',to:'borrower',amount:3,clandestine:true});
  expect(manualTransfer('lender',3,false)).toEqual({kind:'transfer',to:'lender',amount:3,clandestine:false});
  expect(manualTransfer('',3,false)).toBeUndefined();
  expect(manualTransfer('lender',0,false)).toBeUndefined();
});

test('each deliberate transfer gets a new token on the same room connection',()=>{
  const commands:PoliticsCommand[] = [];
  const send = createPoliticsSender(command=>commands.push(command));
  const transfer = manualTransfer('borrower',3,true)!;
  send(transfer);
  send({kind:'campaign'});
  send(transfer);
  expect(commands).toEqual([{...transfer,token:1},{kind:'campaign'},{...transfer,token:2}]);
  expect(readTransferToken(commands[0])).toBe(1);
  for (const token of [undefined,0,-1,1.2,Infinity,'1']) expect(readTransferToken({token})).toBeUndefined();
});
