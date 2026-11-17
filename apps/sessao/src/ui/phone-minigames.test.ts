import {expect,test} from 'bun:test';
import {winningReels} from '../bets';
import {matchingFruit} from '../candy';

test('fruit matches include crossing rows and columns without wrapping rows',()=>{
  const board = Array.from({length:25},(_,index)=>index);
  for (const index of [7,11,12,13,17,3,4,5]) board[index] = 0;
  expect([...matchingFruit(board)].sort((a,b)=>a-b)).toEqual([7,11,12,13,17]);
});

test('Bets only pays a completed three-symbol match',()=>{
  expect(winningReels([0,0,0])).toBe(true);
  expect(winningReels([2,2,3])).toBe(false);
  expect(winningReels([2,2])).toBe(false);
});
