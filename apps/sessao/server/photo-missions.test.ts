import { expect, test } from 'bun:test';
import type { GameplayEvent } from '../src/gameplay';
import type { Photo } from '../src/photography';
import { applyFacts, photoMissions } from './photo-missions';

test('photo rules count distinct people and distinguish a visible briefcase from a floor item', () => {
  const center = {x:140,y:146};
  const author = {id:'a',name:'A'};
  const guest = {id:'b',name:'B',character:0,direction:0,...center};
  const photo:Photo = {id:1,at:0,author,center,selfie:true,location:'Corredor',
    people:[guest],ground:[{id:1,kind:'briefcase',...center}],decorations:[],transfers:[]};
  const event:GameplayEvent = {type:'photo',actor:author.id,position:center,at:0,witnesses:['b'],photo};
  expect(photoMissions.flagra.facts(event)).toEqual([]);
  photo.people[0] = {...guest,exposed:[{id:1,kind:'briefcase'}]};
  expect(photoMissions.flagra.facts(event)).toHaveLength(1);
  const progress = new Map<string,Set<string>>();
  expect(applyFacts(progress,photoMissions.selfie.facts(event))).toBe(1);
  expect(applyFacts(progress,photoMissions.selfie.facts(event))).toBe(1);
  photo.people.push({...guest,id:'c'});
  expect(applyFacts(progress,photoMissions.selfie.facts(event))).toBe(2);
  expect(photoMissions.selfie.facts({...event,type:'photo-shared'})).toEqual([]);
});
