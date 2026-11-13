import {expect,test} from 'bun:test';
import {InternalMail} from './InternalMail';
import {stations} from '../src/plenary';
import type {Player} from '../src/map';
import type {GameplayWorld} from './gameplay-world';

test('mail requires presence and payment and rejects a duplicate without charging twice',()=>{
  const mail = new InternalMail();
  const player:Player = {id:'a',nick:'Rafa',x:140,y:146,character:0,direction:0,moving:false};
  let wallet = 3;
  const world:GameplayWorld = {players:[player],now:100,voice:()=>false,earn:()=>{},office:()=>undefined,publish:()=>{},
    spend(_,amount) {
      if (wallet<amount) return false;
      wallet -= amount;
      return true;
    }};
  const message = {subject:'Aviso',body:'Reunião na biblioteca'};
  expect(mail.publish(player,message,world)).toContain('Aproxime-se');
  Object.assign(player,stations.audit);
  expect(mail.publish(player,{...message,subject:' '},world)).toBeDefined();
  expect(wallet).toBe(3);
  expect(mail.publish(player,message,world)).toBeUndefined();
  expect(mail.publish(player,message,world)).toContain('Aguarde');
  expect(wallet).toBe(1.5);
  expect(mail.view()).toEqual([{id:1,author:'Rafa',...message}]);
  mail.reset();
  expect(mail.view()).toEqual([]);
});
