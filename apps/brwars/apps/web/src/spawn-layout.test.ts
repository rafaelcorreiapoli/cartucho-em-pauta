import { spawnPosition } from '@brwars/simulation';
import { expect, it } from 'vitest';
import { basePosition, laneX, MAP_WIDTH } from './map-layout';
import { workerRegion } from './workers';
it('nascimento separado da Base, que permanece à frente dos trabalhadores, simétrico entre facções', () => {
  const left = basePosition('left'),
    right = basePosition('right');
  expect(left.x + right.x).toBe(MAP_WIDTH);
  expect(laneX(spawnPosition('left')) - left.x).toBeGreaterThan(120);
  expect(right.x - laneX(spawnPosition('right'))).toBeGreaterThan(120);
  expect(left.x).toBeGreaterThan(workerRegion('left').x + workerRegion('left').width);
  expect(right.x).toBeLessThan(workerRegion('right').x);
});
