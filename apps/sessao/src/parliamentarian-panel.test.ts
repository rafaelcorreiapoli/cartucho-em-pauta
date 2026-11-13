import {expect,test} from 'bun:test';
import {refreshVoteOffer} from './parliamentarian-panel';

test('a refreshed NPC vote quote respects the new minimum and clears payment for free votes',()=>{
  expect(refreshVoteOffer(2,4)).toBe(4);
  expect(refreshVoteOffer(5,3)).toBe(5);
  expect(refreshVoteOffer(5,0)).toBe(0);
});
