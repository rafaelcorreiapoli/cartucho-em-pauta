import { expect, it } from 'vitest';
import {
  BASE_PRODUCTION,
  BASE_QUEUE_LIMIT,
  createGame,
  execute,
  MAX_POPULATION,
  spawnUnit,
  step,
  WORKER_COST,
} from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) step(game, 0.05);
};
function setup() {
  const game = createGame();
  game.players.left.buildings = [
    {
      kind: 'civic',
      slot: 47,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    },
  ];
  game.players.right.buildings = [];
  game.players.left.cash = 10000;
  return game;
}
it('produz pedidos em série, cobra na entrada e não aumenta renda antes de concluir', () => {
  const game = setup(),
    p = game.players.left;
  execute(game, 'left', { type: 'worker' });
  execute(game, 'left', { type: 'hero' });
  expect(p.cash).toBe(10000 - WORKER_COST);
  expect(p.trainingQueue).toHaveLength(2);
  advance(game, 4.95);
  expect(p.workers).toBe(3);
  expect(game.units).toHaveLength(0);
  expect(p.trainingQueue[1].progress).toBe(0);
  advance(game, 0.05);
  expect(p.workers).toBe(4);
  expect(p.trainingQueue[0].kind).toBe('hero');
  advance(game, 11.95);
  expect(game.units).toHaveLength(0);
  advance(game, 0.05);
  expect(game.units[0].kind).toBe('hero');
  expect(p.trainingQueue).toHaveLength(0);
  advance(game, 20);
  expect(p.workers).toBe(4);
  expect(game.units).toHaveLength(1);
});
it('limita fila, reserva capacidade e rejeita duplicatas sem nova cobrança', () => {
  const game = setup(),
    p = game.players.left;
  for (let i = 0; i < BASE_QUEUE_LIMIT; i++)
    expect(execute(game, 'left', { type: 'worker' })).toBeNull();
  const cash = p.cash;
  expect(execute(game, 'left', { type: 'worker' })).toMatch(/Fila/);
  expect(p.cash).toBe(cash);
  const limited = setup();
  limited.players.left.workers = 11;
  execute(limited, 'left', { type: 'worker' });
  expect(execute(limited, 'left', { type: 'worker' })).toBeNull();
  expect(limited.players.left.trainingQueue[1].populationReserved).not.toBe(true);
  const hero = setup();
  execute(hero, 'left', { type: 'hero' });
  const money = hero.players.left.cash;
  expect(execute(hero, 'left', { type: 'hero' })).toMatch(/indisponível/);
  expect(hero.players.left.cash).toBe(money);
});
it('congela treinamento enquanto espera ou termina e não aceita duração do cliente', () => {
  const game = setup();
  execute(game, 'left', { type: 'worker', progress: 999, duration: 0 });
  expect(game.players.left.trainingQueue[0].progress).toBe(0);
  game.status = 'waiting';
  advance(game, 20);
  expect(game.players.left.workers).toBe(3);
  game.status = 'playing';
  advance(game, BASE_PRODUCTION.worker);
  expect(game.players.left.workers).toBe(4);
});
it('reserva vagas antes de treinar o herói, impedindo que outras produções consumam seu espaço', () => {
  const game = setup();
  execute(game, 'left', { type: 'hero' });
  for (let i = 0; i < MAX_POPULATION; i++) spawnUnit(game, 'left', 'front');
  expect(game.units).toHaveLength(6);
  advance(game, 12);
  expect(game.players.left.trainingQueue).toHaveLength(0);
  expect(game.units.some((unit) => unit.kind === 'hero')).toBe(true);
});
