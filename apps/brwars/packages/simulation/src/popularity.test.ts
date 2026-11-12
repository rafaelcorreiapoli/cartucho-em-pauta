import { expect, it } from 'vitest';
import {
  civicPopularityRate,
  constructionMultiplier,
  createGame,
  execute,
  grossIncome,
  POPULARITY_CAP,
  POPULARITY_MIN,
  popularityCrisis,
  popularityRate,
  productionFactor,
  step,
  workerIncome,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) p.buildings = [];
  return g;
}
it('impostos são neutros em 10%, corroem estabilidade acima e recuperam abaixo', () => {
  const g = setup(),
    p = g.players.left;
  expect(popularityRate(p)).toBe(0);
  execute(g, 'left', { type: 'tax', rate: 20 });
  expect(popularityRate(p)).toBe(-1.5);
  expect(productionFactor(p)).toBe(1);
  advance(g, 67);
  expect(p.popularity).toBeCloseTo(-100.5);
  expect(g.players.right.popularity).toBe(0);
  execute(g, 'left', { type: 'tax', rate: 0 });
  expect(popularityRate(p)).toBe(0.5);
  p.cash = 0;
  const previous = p.popularity;
  advance(g, 10);
  expect(p.popularity).toBeCloseTo(previous + 5);
  expect(p.cash).toBeCloseTo(80);
});
it('penalidades são graduais e atingem produtividade, unidades e obras, sem remover população ou prédios', () => {
  const g = setup(),
    p = g.players.left;
  for (const [pop, productivity, production] of [
    [200, 1, 1],
    [0, 1, 1],
    [-50, 0.85, 1],
    [-100, 0.7, 1],
    [-150, 0.55, 0.875],
    [-200, 0.4, 0.75],
  ]) {
    p.popularity = pop;
    expect(popularityCrisis(p).workerProductivity).toBeCloseTo(productivity);
    expect(productionFactor(p)).toBeCloseTo(production);
    expect(constructionMultiplier(p)).toBeCloseTo(production);
    expect(workerIncome(p)).toBeCloseTo(3 * productivity);
  }
  p.cash = 1000;
  p.popularity = -200;
  execute(g, 'left', { type: 'worker' });
  execute(g, 'left', { type: 'build', slot: 1, kind: 'housing' });
  advance(g, 5);
  expect(p.workers).toBe(3);
  expect(p.trainingQueue[0].progress).toBeCloseTo(3.75);
  expect(p.buildings[0].constructionProgress).toBeCloseTo(3.75 / 12);
  advance(g, 1.7);
  expect(p.workers).toBe(4);
  p.taxRate = 20;
  expect(grossIncome(p)).toBeCloseTo(8 + 4 * 6 * 0.4);
  p.taxRate = 10;
  p.popularity = 0;
  expect(grossIncome(p)).toBeCloseTo(20);
});
it('geração cultural é contínua, acumula prédios e níveis exclui obras e ignora antigas flags de pausa', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [
    { kind: 'civic', slot: 0, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
    { kind: 'civic', slot: 1, level: 2, progress: 0, constructionProgress: 1, completedCycles: 0 },
    {
      kind: 'civic',
      slot: 2,
      level: 15,
      progress: 0,
      constructionProgress: 0.5,
      completedCycles: 0,
    },
    {
      kind: 'civic',
      slot: 3,
      level: 15,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
      autoPaused: true,
    },
  ];
  p.popularity = -150;
  expect(civicPopularityRate(p.buildings[1])).toBeCloseTo(0.6);
  expect(popularityRate(p)).toBeCloseTo(0.8835);
  advance(g, 1);
  expect(p.popularity).toBeCloseTo(-149.1165);
  expect(p.buildings[0].completedCycles).toBe(0);
  expect(execute(g, 'left', { type: 'auto-production', slot: 0, paused: true })).toMatch(
    /automática/,
  );
  expect(popularityRate(p)).toBeCloseTo(0.8835);
  execute(g, 'left', { type: 'demolish', slot: 3 });
  expect(popularityRate(p)).toBeCloseTo(0.81);
});
it('limites são aplicados sobre a variação líquida e magia não pode consumir saldo negativo', () => {
  const g = setup(),
    p = g.players.left;
  p.popularity = POPULARITY_MIN;
  p.taxRate = 30;
  advance(g, 1);
  expect(p.popularity).toBe(-200);
  p.buildings = [
    { kind: 'civic', slot: 1, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
  ];
  advance(g, 1);
  expect(p.popularity).toBe(-200);
  p.popularity = POPULARITY_CAP;
  p.taxRate = 0;
  advance(g, 1);
  expect(p.popularity).toBe(200);
  p.unlockedPowers = ['bills'];
  p.popularity = -10;
  expect(execute(g, 'left', { type: 'power', kind: 'bills' })).toMatch(/insuficiente/);
  expect(p.popularity).toBe(-10);
  g.status = 'waiting';
  advance(g, 10);
  expect(p.popularity).toBe(-10);
});

it('inauguração concede bônus uma única vez, cópias têm retorno decrescente e depois só há POP/s', () => {
  const g = setup(),
    p = g.players.left;
  p.cash = 10000;
  execute(g, 'left', { type: 'build', kind: 'civic', slot: 1 });
  advance(g, 17.95);
  expect(p.popularity).toBe(0);
  advance(g, 0.05);
  expect(p.popularity).toBeCloseTo(6);
  expect(p.buildings[0].completedCycles).toBe(1);
  advance(g, 30);
  expect(p.popularity).toBeCloseTo(24);
  expect(p.buildings[0].completedCycles).toBe(1);
  expect(p.buildings[0].progress).toBe(0);
  execute(g, 'left', { type: 'build', kind: 'civic', slot: 2 });
  const before = p.popularity;
  advance(g, 18);
  expect(p.popularity - before).toBeCloseTo(18 * 0.6 + 6 * 0.35);
  expect(p.buildings[1].completedCycles).toBe(1);
  execute(g, 'left', { type: 'upgrade', slot: 2 });
  advance(g, 10);
  expect(p.buildings[1].completedCycles).toBe(1);
});
