import {expect,test} from 'bun:test';
import {createPoliticalSender,readPoliticalToken} from './political-commands';
import {manualTransfer} from './politics-panel';

test('informal loans and repayments are manual payments selected by the player',()=>{
  expect(manualTransfer('borrower',3,true)).toEqual({kind:'transfer',to:'borrower',amount:3,clandestine:true});
  expect(manualTransfer('lender',3,false)).toEqual({kind:'transfer',to:'lender',amount:3,clandestine:false});
  expect(manualTransfer('',3,false)).toBeUndefined();
  expect(manualTransfer('lender',0,false)).toBeUndefined();
});

test('political and election commands share a sequence on the room connection',()=>{
  const commands:unknown[] = [];
  const send = createPoliticalSender((channel,command)=>commands.push([channel,command]));
  const transfer = manualTransfer('borrower',3,true)!;
  send('politics',transfer);
  send('election',{kind:'invest',amount:2});
  send('politics',transfer);
  expect(commands).toEqual([
    ['politics',{...transfer,token:1}],
    ['election',{kind:'invest',amount:2,token:2}],
    ['politics',{...transfer,token:3}],
  ]);
  expect(readPoliticalToken({token:1})).toBe(1);
  for (const token of [undefined,0,-1,1.2,Infinity,'1']) expect(readPoliticalToken({token})).toBeUndefined();
});
