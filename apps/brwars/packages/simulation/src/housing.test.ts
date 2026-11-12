import { expect, it } from 'vitest';
import {
  createGame,
  execute,
  housingCapacity,
  civicPopularityRate,
  employment,
  MAX_POPULATION,
  step,
  workerCapacity,
} from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < seconds * 20; i++) step(game, 0.05);
};
it('só aumenta capacidade após concluir moradia, sem recrutar ou gerar popularidade', () => {
  const game = createGame();
  game.players.left.buildings = [];
  game.players.right.buildings = [];
  const player = game.players.left;
  player.workers = 12;
  player.cash = 10000;
  expect(workerCapacity(player)).toBe(12);
  expect(execute(game, 'left', { type: 'worker' })).toBeNull();
  expect(player.trainingQueue[0].populationReserved).not.toBe(true);
  execute(game, 'left', { type: 'build', kind: 'housing', slot: 1 });
  expect(workerCapacity(player)).toBe(12);
  advance(game, 11.95);
  expect(workerCapacity(player)).toBe(12);
  advance(game, 0.05);
  expect(workerCapacity(player)).toBe(18);
  expect(player.workers).toBe(12);
  const house = player.buildings[0];
  expect(housingCapacity(house)).toBe(6);
  expect(player.workers).toBe(12);
  advance(game, 5);
  expect(player.workers).toBe(13);
  advance(game, 30);
  expect(house.completedCycles).toBe(0);
  expect(house.progress).toBe(0);
  expect(civicPopularityRate(house)).toBe(0);
  expect(employment(player).unemployed).toBe(7);
  expect(player.popularity).toBeLessThan(0);
  const cash = player.cash;
  expect(execute(game, 'left', { type: 'upgrade', slot: 1 })).toBeNull();
  expect(player.cash).toBe(cash - 160);
  expect(workerCapacity(player)).toBe(18);
  advance(game, 9.95);
  expect(workerCapacity(player)).toBe(18);
  advance(game, 0.05);
  expect(workerCapacity(player)).toBe(20);
  expect(workerCapacity(game.players.right)).toBe(12);
});
it('soma moradias e mantém o teto global sem aceitar capacidade enviada pelo cliente', () => {
  const game = createGame();
  game.players.left.cash = 100000;
  execute(game, 'left', { type: 'build', kind: 'housing', slot: 1 });
  execute(game, 'left', { type: 'build', kind: 'housing', slot: 2 });
  advance(game, 12);
  expect(workerCapacity(game.players.left)).toBe(24);
  game.players.left.buildings
    .filter((building) => building.kind === 'housing')
    .forEach((building) => (building.level = 15));
  expect(workerCapacity(game.players.left)).toBe(80);
  game.players.left.workers = MAX_POPULATION;
  expect(execute(game, 'left', { type: 'worker', capacity: 1000 })).toBeNull();
  expect(game.players.left.trainingQueue[0].populationReserved).not.toBe(true);
});
