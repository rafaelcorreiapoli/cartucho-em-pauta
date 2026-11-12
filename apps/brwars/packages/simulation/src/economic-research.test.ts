import { expect, it } from 'vitest';
import {
  createGame,
  creditLimit,
  execute,
  grossIncome,
  researchLevel,
  step,
  unitTrainingMultiplier,
  workerIncome,
  type ResearchKind,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) p.buildings = [];
  g.players.left.cash = 10000;
  return g;
}
it('treinamento geral acelera tropas automáticas e pedidos manuais, sem acelerar popularidade', () => {
  const g = setup(),
    p = g.players.left;
  p.research = ['production', 'production', 'production'];
  p.buildings = [
    {
      kind: 'barracks',
      slot: 0,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
    { kind: 'civic', slot: 1, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
  ];
  execute(g, 'left', { type: 'worker' });
  advance(g, 3.45);
  expect(p.workers).toBe(3);
  advance(g, 0.05);
  expect(p.workers).toBe(4);
  expect(p.buildings[1].progress).toBe(0);
  advance(g, 2.1);
  expect(g.units.filter((u) => u.side === 'left')).toHaveLength(1);
  expect(unitTrainingMultiplier(p, 'hero')).toBeCloseTo(1 / 0.7);
  expect(unitTrainingMultiplier(g.players.right, 'front')).toBe(1);
});
it('formação profissional acumula multiplicativamente só no trabalhador e afeta pedidos em curso', () => {
  const g = setup(),
    p = g.players.left;
  execute(g, 'left', { type: 'worker' });
  advance(g, 1);
  p.research = [
    'production',
    'production',
    'production',
    'worker_training',
    'worker_training',
    'worker_training',
  ];
  expect(unitTrainingMultiplier(p, 'worker')).toBeCloseTo(1 / 0.49);
  expect(unitTrainingMultiplier(p, 'hero')).toBeCloseTo(1 / 0.7);
  advance(g, 1.9);
  expect(p.workers).toBe(3);
  advance(g, 0.1);
  expect(p.workers).toBe(4);
});
it('produtividade aumenta renda e crédito sustentável; impostos continuam proporcionais e não fabricam crédito', () => {
  const g = setup(),
    p = g.players.left,
    credit = creditLimit(p);
  p.research = ['productivity', 'productivity', 'productivity'];
  expect(workerIncome(p)).toBeCloseTo(3.9);
  expect(grossIncome(p)).toBeCloseTo(19.7);
  expect(creditLimit(p)).toBeGreaterThan(credit);
  const upgradedCredit = creditLimit(p);
  execute(g, 'left', { type: 'tax', rate: 15 });
  expect(workerIncome(p)).toBeCloseTo(5.85);
  expect(creditLimit(p)).toBe(upgradedCredit);
  const cash = p.cash;
  step(g, 0.05);
  expect(p.cash - cash).toBeCloseTo(25.55 * 0.05);
  expect(grossIncome(p)).toBeLessThan(25.55);
});
it('migra a mobilidade antiga pelo maior nível sem somar pesquisas de classes', () => {
  const g = setup();
  g.players.left.research = [
    'front_mobility',
    'front_mobility',
    'ranged_mobility',
    'siege_mobility',
  ] as unknown as ResearchKind[];
  expect(researchLevel(g.players.left, 'mobility')).toBe(2);
});
