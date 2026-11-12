import { expect, test } from 'bun:test';
import { CashDrops } from './CashDrops';

test('cash spawns after a delay, stays within local vision, and can only be pocketed once', () => {
  const values = [0,0,.14,.248,0, .4,.3,.5,.8];
  const drops = new CashDrops();
  const player = {x:140,y:146};
  drops.reset(1000,() => values.shift() ?? .5);

  drops.advance(4999);
  expect(drops.visibleTo(player,4999)).toEqual([]);
  drops.advance(5000);
  const [drop] = drops.visibleTo(player,5000);
  expect(drop).toMatchObject({kind:'briefcase',x:151,y:146});
  const distant = {x:400,y:146};
  expect(drops.visibleTo(distant,5000)).toEqual([]);
  expect(drops.pocket(drop.id,distant,5000)).toBeUndefined();
  expect(drops.pocket(drop.id,player,5001)).toBe(3);
  expect(drops.pocket(drop.id,player,5001)).toBeUndefined();
});

test('expired drops cannot be pocketed', () => {
  const values = [0,0,.14,.248,.99];
  const drops = new CashDrops();
  const player = {x:140,y:146};
  drops.reset(0,() => values.shift() ?? .5);
  drops.advance(4000);
  const [drop] = drops.visibleTo(player,4000);
  expect(drop.kind).toBe('bundle');
  expect(drops.pocket(drop.id,player,59000)).toBeUndefined();
  expect(drops.visibleTo(player,59000)).toEqual([]);
});
