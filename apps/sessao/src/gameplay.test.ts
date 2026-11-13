import {expect,test} from 'bun:test';
import {agendaProject,voteIntentSummary} from './plenary';
import {canVerifyDocumentAt,readGameplayAction} from './gameplay';

test('document verification is offered only at the two document counters',()=>{
  expect(canVerifyDocumentAt('secretary')).toBe(true);
  expect(canVerifyDocumentAt('protocol')).toBe(true);
  expect(canVerifyDocumentAt('archive')).toBe(false);
  expect(canVerifyDocumentAt(undefined)).toBe(false);
  expect(readGameplayAction({kind:'verify-document',item:7,place:'secretary'}))
    .toMatchObject({kind:'verify-document',item:7,place:'secretary'});
});

test('the project panel and history resolve the actual ballot project instead of its sequence number',()=>{
  expect(agendaProject({round:0,project:2}).name).toBe('Teto do Cafezinho');
  expect(agendaProject({round:1,project:0}).name).toBe('Auxílio Churrasco');
  expect(agendaProject({round:4}).name).toBe('Wi-Fi na Praça');
});

test('the project HUD labels announced intentions with the player and side',()=>{
  expect(voteIntentSummary([{id:'a',name:'Rafa',vote:'yes'},{id:'b',name:'Bia',vote:'no'}])).toBe('Rafa a favor · Bia contra');
  expect(voteIntentSummary()).toBe('');
});
