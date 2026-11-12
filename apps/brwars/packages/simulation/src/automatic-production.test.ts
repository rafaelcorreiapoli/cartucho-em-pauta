import { expect, it } from 'vitest';
import { createGame, execute, populationUsed, step, type Building } from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  g.players.right.buildings = [];
  g.players.left.buildings[0].progress = 0;
  return g;
}
it('pausa após concluir o pedido atual, sem reservar outro, e retoma ao reativar', () => {
  const g = setup(),
    p = g.players.left,
    b = p.buildings[0];
  step(g, 0.05);
  expect(b.populationReserved).toBe(true);
  expect(execute(g, 'left', { type: 'auto-production', slot: 0, paused: true })).toBeNull();
  advance(g, 8);
  expect(g.units).toHaveLength(1);
  expect(b.populationReserved).toBe(false);
  expect(populationUsed(g, 'left')).toBe(4);
  const cycles = b.completedCycles;
  advance(g, 10);
  expect(b.completedCycles).toBe(cycles);
  expect(b.progress).toBeCloseTo(0);
  execute(g, 'left', { type: 'auto-production', slot: 0, paused: false });
  step(g, 0.05);
  expect(b.populationReserved).toBe(true);
  advance(g, 8);
  expect(b.completedCycles).toBe(cycles + 1);
});
it('pausar antes de iniciar não reserva vagas; retomar continua sujeito à população', () => {
  const g = setup(),
    p = g.players.left,
    b = p.buildings[0];
  execute(g, 'left', { type: 'auto-production', slot: 0, paused: true });
  advance(g, 10);
  expect(populationUsed(g, 'left')).toBe(3);
  expect(b.progress).toBe(0);
  p.workers = 12;
  execute(g, 'left', { type: 'auto-production', slot: 0, paused: false });
  advance(g, 2);
  expect(b.populationReserved).not.toBe(true);
  p.workers = 11;
  step(g, 0.05);
  expect(b.populationReserved).toBe(true);
});
it('popularidade não pode ser pausada e não simula ciclos', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [
    { kind: 'civic', slot: 1, level: 1, progress: 3, constructionProgress: 1, completedCycles: 0 },
  ];
  expect(execute(g, 'left', { type: 'auto-production', slot: 1, paused: true })).toMatch(
    /automática/,
  );
  advance(g, 10);
  expect(p.buildings[0].progress).toBe(0);
  expect(p.popularity).toBeCloseTo(6);
  advance(g, 7);
  expect(p.popularity).toBeCloseTo(10.2);
});
it('valida dono, estrutura pronta, produção automática e booleano sem cobrar recursos', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings.push({
    kind: 'housing',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  } as Building);
  const cash = p.cash;
  expect(execute(g, 'left', { type: 'auto-production', slot: 1, paused: true })).toMatch(
    /automática/,
  );
  expect(execute(g, 'right', { type: 'auto-production', slot: 0, paused: true })).toMatch(
    /automática/,
  );
  expect(execute(g, 'left', { type: 'auto-production', slot: 0, paused: 'false' })).toMatch(
    /inválido/,
  );
  p.buildings[0].constructionProgress = 0;
  expect(execute(g, 'left', { type: 'auto-production', slot: 0, paused: true })).toMatch(
    /concluída/,
  );
  expect(p.cash).toBe(cash);
});
