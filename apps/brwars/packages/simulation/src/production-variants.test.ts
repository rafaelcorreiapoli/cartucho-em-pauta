import { expect, it } from 'vitest';
import {
  BUILDINGS,
  createGame,
  currentProduction,
  execute,
  logisticsMultiplier,
  populationUsed,
  productionBlockers,
  productionSpec,
  step,
  unitStats,
} from './index';

it.each(['left', 'right'] as const)(
  '%s preserves paid production when switching factory variants',
  (side) => {
    const game = createGame();
    const player = game.players[side];
    game.players.left.buildings = [];
    game.players.right.buildings = [];
    player.cash = 10_000;
    player.workers = 8;
    const factory = {
      kind: 'garage' as const,
      slot: 1,
      level: 9,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    };
    player.buildings.push(factory);
    expect(execute(game, side, { type: 'select-production', slot: 1, tier: 2 })).toMatch(/liberar/);
    expect(execute(game, side, { type: 'select-production', slot: 1, tier: '1' })).toMatch(
      /inválida/,
    );
    expect(execute(game, side, { type: 'select-production', slot: 1, tier: 1 })).toBeNull();
    step(game, 0.05);
    expect(currentProduction(factory)?.tier).toBe(1);
    expect(populationUsed(game, side)).toBe(9);
    factory.level = 10;
    expect(execute(game, side, { type: 'select-production', slot: 1, tier: 2 })).toBeNull();
    expect(currentProduction(factory)?.tier).toBe(1);
    expect(populationUsed(game, side)).toBe(9);
    const light = productionSpec(factory, 1)!;
    factory.progress = light.duration - 0.05;
    step(game, 0.05);
    expect(game.units[0]).toMatchObject({ kind: 'siege', productionTier: 1 });
    expect(unitStats(game.units[0])).toEqual(light.stats);
    expect(currentProduction(factory)?.tier).toBe(2);
    expect(factory.progress).toBe(0);
    expect(populationUsed(game, side)).toBe(12);
  },
);

it('checks cash and population against the selected variant', () => {
  const game = createGame();
  const p = game.players.left;
  const factory = {
    kind: 'garage' as const,
    slot: 1,
    level: 15,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  };
  p.buildings = [factory];
  p.workers = 9;
  p.cash = BUILDINGS.garage.cost / 2;
  expect(execute(game, 'left', { type: 'select-production', slot: 1, tier: 3 })).toBeNull();
  expect(productionBlockers(game, 'left', factory)).toEqual(['population', 'cash']);
  expect(execute(game, 'left', { type: 'select-production', slot: 1, tier: 0 })).toBeNull();
  expect(productionBlockers(game, 'left', factory)).toEqual([]);
});

it('logistics applies only to completed depots, with a cap at two', () => {
  const player = createGame().players.left;
  const depot = {
    kind: 'depot' as const,
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 0,
    completedCycles: 0,
  };
  player.buildings.push(depot);
  expect(logisticsMultiplier(player)).toBe(1);
  depot.constructionProgress = 1;
  expect(logisticsMultiplier(player)).toBeCloseTo(1.15);
  player.buildings.push({ ...depot, slot: 2 }, { ...depot, slot: 3 });
  expect(logisticsMultiplier(player)).toBeCloseTo(1.23);
});
