import { expect, it } from 'vitest';
import { BASE_QUEUE_LIMIT, createGame, execute, PROMOTION_OFFERS, step } from './index';
function setup() {
  const game = createGame();
  for (const player of Object.values(game.players)) player.buildings = [];
  game.players.left.buildings = [
    {
      kind: 'civic',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    },
  ];
  game.players.left.cash = 10000;
  game.players.left.taxRate = 14;
  return game;
}
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) step(game, 0.05);
};
it('cobra ao enfileirar e concede popularidade somente ao concluir cada evento em série', () => {
  const game = setup(),
    p = game.players.left,
    b = p.buildings[0];
  expect(
    execute(game, 'left', {
      type: 'promote',
      slot: 1,
      kind: 'local',
      duration: 0,
      popularity: 999,
    }),
  ).toBeNull();
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'event' })).toBeNull();
  expect(p.cash).toBe(9220);
  expect(p.popularity).toBe(0);
  expect(b.promotionQueue).toHaveLength(2);
  advance(game, 5.95);
  expect(p.popularity).toBe(0);
  advance(game, 0.05);
  expect(p.popularity).toBe(15);
  expect(b.promotionQueue?.[0]).toMatchObject({ kind: 'event', progress: 0 });
  advance(game, 15);
  expect(p.popularity).toBe(75);
  expect(b.promotionQueue).toHaveLength(0);
  expect(b.completedCycles).toBe(2);
  advance(game, 30);
  expect(b.completedCycles).toBe(2);
});
it('limita fila, congela partida aguardando e cancela eventos ao demolir sem reembolso de pedidos', () => {
  const game = setup(),
    p = game.players.left;
  for (let i = 0; i < BASE_QUEUE_LIMIT; i++)
    expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' })).toBeNull();
  const cash = p.cash;
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' })).toMatch(/cheia/);
  expect(p.cash).toBe(cash);
  game.status = 'waiting';
  advance(game, 10);
  expect(p.buildings[0].promotionQueue?.[0].progress).toBe(0);
  game.status = 'playing';
  execute(game, 'left', { type: 'demolish', slot: 1 });
  p.taxRate = 10;
  advance(game, 30);
  expect(p.popularity).toBe(0);
});
it('rejeita obras, prédio errado, evento malformado, falta de caixa e desperdício no limite', () => {
  const game = setup(),
    p = game.players.left;
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: '__proto__' })).toMatch(
    /inválido/,
  );
  p.buildings[0].constructionProgress = 0;
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' })).toMatch(/concluído/);
  p.buildings[0].constructionProgress = 1;
  p.popularity = 190;
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' })).toMatch(/limite/);
  p.popularity = 0;
  p.cash = 0;
  expect(execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' })).toMatch(
    /insuficientes/,
  );
  expect(execute(game, 'right', { type: 'promote', slot: 1, kind: 'local' })).toMatch(/concluído/);
});
it('cap de popularidade ao concluir não permite ultrapassar 200 e tempos vêm do catálogo', () => {
  const game = setup(),
    p = game.players.left;
  execute(game, 'left', { type: 'promote', slot: 1, kind: 'local' });
  p.popularity = 199;
  advance(game, PROMOTION_OFFERS.local.duration);
  expect(p.popularity).toBe(200);
});
