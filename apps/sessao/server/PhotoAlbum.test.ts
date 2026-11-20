import {expect,test} from 'bun:test';
import {PhotoAlbum} from './PhotoAlbum';
import type {Photo} from '../src/photography';

test('saved photos own all nested visual state even if their source frame keeps changing',()=>{
  const album = new PhotoAlbum();
  const source:Photo = {id:1,author:{id:'a',name:'A'},at:100,time:5000,location:'Gabinete',selfie:false,
    features:{surveillance:true,projectVoting:true,decorations:true,portraitsAndVip:true},
    center:{x:140,y:146,barriers:[[100,100,10,20]]},camera:{x:140,y:127},
    offices:[{id:'1',door:'breached',cabinetBreached:true}],
    people:[{id:'a',name:'A',x:140,y:146,character:0,direction:1,moving:true,cashInHand:true,
      robberyTarget:{x:150,y:146,direction:3},swing:{weapon:'baton',startedAt:4900,angle:1},exposed:[{id:2,kind:'briefcase'}]}],
    ground:[{id:3,kind:'briefcase',x:150,y:150}],
    decorations:[{id:4,kind:'portrait',x:150,y:120,owner:{id:'a',name:'A'},character:0}],transfers:[]};
  album.capture('a',100,()=>source);
  const expected = structuredClone(source);
  source.time=9000;
  source.features!.surveillance=false;
  source.center.barriers=[];
  source.offices![0].door='open';
  source.people[0].x=900;
  source.people[0].robberyTarget!.x=900;
  source.people[0].swing!.angle=3;
  source.people[0].exposed!.length=0;
  source.ground[0].kind='document';
  source.decorations[0].owner.name='Outra pessoa';
  expect(album.view('a',9000).album[0].photo).toEqual(expected);
});
