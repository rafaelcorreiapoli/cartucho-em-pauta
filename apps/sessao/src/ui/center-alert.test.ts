import {expect,test} from 'bun:test';
import {caloteAlertLevel,lastInElection} from './center-alert';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {ElectionView} from '../elections';

const base = new PlenaryMatch(1).view('a',['a'],0);
test('calote alerts distinguish the initial deficit, final ten seconds and recovery',()=>{
  expect(caloteAlertLevel({...base,gameMode:'calote',budget:-1,caloteIn:30})).toBe(1);
  expect(caloteAlertLevel({...base,gameMode:'calote',budget:-1,caloteIn:10})).toBe(2);
  expect(caloteAlertLevel({...base,gameMode:'calote',budget:0,caloteIn:10})).toBe(0);
  expect(caloteAlertLevel({...base,gameMode:'classic',budget:-1,caloteIn:10})).toBe(0);
  expect(caloteAlertLevel({...base,gameMode:'calote',budget:-1})).toBe(0);
});
test('election warning follows actual last-place risk and ignores spectators and protected final seats',()=>{
  const polls = ['a','b','c','d'].map((id,index)=>({id,name:id,character:index,race:'deputy' as const,estimate:index+1,trend:0}));
  const election:ElectionView = {cycle:1,remaining:60,polls,offices:[],canObject:false,canCampaign:true,canInterview:false};
  const view = {...base,phase:'negotiation' as const,election};
  expect(lastInElection(view,'a')).toBe(true);
  expect(lastInElection(view,'b')).toBe(false);
  expect(lastInElection(view,'spectator')).toBe(false);
  expect(lastInElection({...view,phase:'finished'},'a')).toBe(false);
  expect(lastInElection({...view,election:{...election,polls:polls.slice(0,3)}},'a')).toBe(false);
});
