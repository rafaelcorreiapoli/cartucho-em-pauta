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

test('forwarding only resolves existing public notices and preserves the original verdict',()=>{
  const mail = new InternalMail();
  const player:Player = {id:'a',nick:'Rafa',character:0,direction:0,moving:false,...stations.audit};
  let charges = 0;
  const world:GameplayWorld = {players:[player],now:100,voice:()=>false,earn:()=>{},office:()=>undefined,publish:()=>{},
    spend(){ charges++; return true; }};
  const message = {subject:'Proposta',body:'Segue a proposta'};
  const document = {id:1,title:'Proposta',signatures:[]};
  expect(mail.publish(player,{...message,forwardedFrom:99},world)).toContain('indisponível');
  expect(charges).toBe(0);
  expect(mail.publish(player,{...message,attachment:{kind:'document',id:1}},world,
    ()=>({attachment:{kind:'document',document},authentic:true}))).toBeUndefined();
  world.now += 100_000;
  expect(mail.publish(player,{...message,forwardedFrom:1,attachment:{kind:'document',id:2}},world)).toContain('anexo original');
  expect(charges).toBe(1);
  expect(mail.publish(player,{...message,forwardedFrom:1},world)).toBeUndefined();
  expect(mail.examine('b',2,()=>true)).toBeUndefined();
  expect(mail.reportsFor('b')).toEqual([{notice:2,document,authentic:true}]);
  expect(mail.reportsFor('a')).toEqual([]);
});
