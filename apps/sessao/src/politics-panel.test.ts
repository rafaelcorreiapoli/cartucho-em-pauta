import {expect,test} from 'bun:test';
import {createRoomCommandSender,readRoomCommandToken} from './room-commands';
import {canBuyEvidence,manualTransfer} from './politics-panel';

test('informal loans and repayments are manual payments selected by the player',()=>{
  expect(manualTransfer('borrower',3,true)).toEqual({kind:'transfer',to:'borrower',amount:3,clandestine:true});
  expect(manualTransfer('lender',3,false)).toEqual({kind:'transfer',to:'lender',amount:3,clandestine:false});
  expect(manualTransfer('',3,false)).toBeUndefined();
  expect(manualTransfer('lender',0,false)).toBeUndefined();
  expect(manualTransfer('lender',2,false,1.5)).toBeUndefined();
  expect(manualTransfer('lender',1,false,.5)).toBeUndefined();
  expect(manualTransfer('lender',1,false,1.5)?.kind).toBe('transfer');
});

test('political, election and mail commands share a sequence on the room connection',()=>{
  const commands:unknown[] = [];
  const send = createRoomCommandSender((channel,command)=>commands.push([channel,command]));
  const transfer = manualTransfer('borrower',3,true)!;
  send('politics',transfer);
  send('election',{kind:'invest',amount:2});
  send('mail-examine',{notice:7});
  send('bill-intent',{vote:'yes'});
  send('bill-vote',{vote:'no'});
  send('spy',{kind:'close'});
  send('room-activity',{activity:'coffee'});
  send('gameplay',{action:{kind:'shop-buy',target:'baton',token:50}});
  send('politics',transfer);
  expect(commands).toEqual([
    ['politics',{...transfer,token:1}],
    ['election',{kind:'invest',amount:2,token:2}],
    ['mail-examine',{notice:7,token:3}],
    ['bill-intent',{vote:'yes',token:4}],
    ['bill-vote',{vote:'no',token:5}],
    ['spy',{kind:'close',token:6}],
    ['room-activity',{activity:'coffee',token:7}],
    ['gameplay',{action:{kind:'shop-buy',target:'baton',token:50},token:8}],
    ['politics',{...transfer,token:9}],
  ]);
  expect(readRoomCommandToken({token:1})).toBe(1);
  for (const token of [undefined,0,-1,1.2,Infinity,'1']) expect(readRoomCommandToken({token})).toBeUndefined();
});

test('buying evidence requires proximity, sufficient balance and an available payment',()=>{
  const offer = {from:'seller',price:2};
  const nearby = new Set(['seller']);
  expect(canBuyEvidence(offer,nearby,2,1)).toBe(true);
  expect(canBuyEvidence(offer,nearby,1.9,1)).toBe(false);
  expect(canBuyEvidence(offer,nearby,2,0)).toBe(false);
  expect(canBuyEvidence(offer,new Set(),2,1)).toBe(false);
});
