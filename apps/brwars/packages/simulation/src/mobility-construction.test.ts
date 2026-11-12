import { expect, it } from 'vitest';
import {
  constructionMultiplier,
  createGame,
  execute,
  movementMultiplier,
  populationCapacity,
  spawnUnit,
  step,
  upgradeSecondsRemaining,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  g.players.left.buildings = [];
  g.players.right.buildings = [];
  g.players.left.cash = 10000;
  return g;
}
it('mobilidade unificada afeta todas as tropas existentes e não o inimigo', () => {
  const g = setup(),
    p = g.players.left;
  p.research = ['mobility', 'mobility', 'mobility'];
  for (const kind of ['front', 'ranged', 'siege', 'hero'] as const)
    expect(movementMultiplier(p, kind)).toBeCloseTo(1.3);
  spawnUnit(g, 'left', 'front');
  const u = g.units[0],
    x = u.x;
  step(g, 0.05);
  expect(u.x - x).toBeCloseTo(23 * 1.3 * 0.05);
  expect(movementMultiplier(g.players.right, 'front')).toBe(1);
});
it('pesquisa acelera obras em andamento e novas, sem acelerar produção de unidades', () => {
  const g = setup(),
    p = g.players.left;
  execute(g, 'left', { type: 'build', kind: 'housing', slot: 1 });
  advance(g, 3);
  expect(p.buildings[0].constructionProgress).toBeCloseTo(0.25);
  p.research = ['construction', 'construction', 'construction'];
  expect(constructionMultiplier(p)).toBeCloseTo(1.45);
  advance(g, 6.2);
  expect(p.buildings[0].constructionProgress).toBeLessThan(1);
  advance(g, 0.05);
  expect(p.buildings[0].constructionProgress).toBe(1);
  execute(g, 'left', { type: 'build', kind: 'barracks', slot: 2 });
  advance(g, 6.9);
  expect(p.buildings[1].constructionProgress).toBe(1);
  advance(g, 4);
  expect(g.units).toHaveLength(0);
  advance(g, 4);
  expect(g.units).toHaveLength(1);
});
it('upgrade cobra uma vez, mantém nível/capacidade até concluir e aplica pesquisa durante a obra', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [
    {
      kind: 'barracks',
      slot: 1,
      autoPaused: true,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  const b = p.buildings[0];
  expect(execute(g, 'left', { type: 'upgrade', slot: 1, duration: 0, level: 15 })).toBeNull();
  const cash = p.cash;
  expect(b.level).toBe(1);
  expect(populationCapacity(p)).toBe(12);
  expect(execute(g, 'left', { type: 'upgrade', slot: 1 })).toMatch(/andamento/);
  expect(p.cash).toBe(cash);
  advance(g, 5);
  expect(b.upgradeProgress).toBeCloseTo(0.5);
  p.research = ['construction', 'construction'];
  expect(upgradeSecondsRemaining(b, p)).toBeCloseTo(5 / 1.3);
  advance(g, 3.8);
  expect(b.level).toBe(1);
  advance(g, 0.05);
  expect(b.level).toBe(2);
  expect(b.upgrading).toBe(false);
  expect(populationCapacity(p)).toBe(12);
});
it('produção continua no nível antigo e upgrade não avança enquanto partida aguarda', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [
    {
      kind: 'barracks',
      slot: 0,
      level: 1,
      progress: 7,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  execute(g, 'left', { type: 'upgrade', slot: 0 });
  g.status = 'waiting';
  advance(g, 5);
  expect(p.buildings[0].upgradeProgress).toBe(0);
  g.status = 'playing';
  advance(g, 1);
  expect(g.units[0].level).toBe(1);
  advance(g, 17);
  expect(g.units.some((u) => u.level === 2)).toBe(true);
});
