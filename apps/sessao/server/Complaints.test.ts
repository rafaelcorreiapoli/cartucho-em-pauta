import {expect,test} from 'bun:test';
import {Complaints} from './Complaints';
import type {Photo} from '../src/photography';

test('photos only supplement registered theft and must show the accused near the incident time',()=>{
  const reports = new Complaints();
  const name = (id:string)=>id;
  const photo:Photo = {id:1,author:{id:'victim',name:'Vítima'},at:100,location:'Gabinete',selfie:false,
    center:{x:0,y:0},people:[{id:'thief',name:'Suspeito',x:1,y:1,character:0,direction:0}],ground:[],decorations:[],transfers:[]};
  expect(reports.submit('victim',1,name,photo)).toBeUndefined();
  reports.record({type:'safe-robbed',actor:'thief',target:'victim',at:1100,position:{x:0,y:0},witnesses:['witness']},1000);
  expect(reports.submit('stranger',1,name,photo)).toBeUndefined();
  expect(reports.submit('victim',1,name,{...photo,people:[]})).toBeUndefined();
  expect(reports.submit('victim',1,name,{...photo,at:20_000})).toBeUndefined();
  expect(reports.submit('witness',1,name,photo)?.decision).toMatchObject({kind:'safe-robbed',hasPhoto:true,accused:'thief'});
  expect(reports.submit('victim',1,name)).toBeUndefined();
  reports.reset();
  expect(reports.history()).toEqual([]);
});
