import { expect, it } from 'vitest';
import {
  createGame,
  populationUsed,
  productionBlockers,
  step,
  UNIT_PRODUCTION_COST,
  type Building,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
const factory = (slot = 0): Building => ({
  kind: 'barracks',
  slot,
  level: 1,
  progress: 0,
  constructionProgress: 1,
  completedCycles: 0,
});
function setup() {
  const g = createGame();
  g.players.right.buildings = [];
  const p = g.players.left;
  p.workers = 0;
  p.cash = 0;
  p.buildings = [factory()];
  return g;
}
it('sem R$ aguarda antes de reservar população e retoma automaticamente quando a renda cobre o pedido', () => {
  const g = setup(),
    p = g.players.left,
    b = p.buildings[0];
  expect(productionBlockers(g, 'left', b)).toEqual(['cash']);
  advance(g, 4.95);
  expect(b.progress).toBe(0);
  expect(b.populationReserved).not.toBe(true);
  expect(populationUsed(g, 'left')).toBe(0);
  advance(g, 0.05);
  expect(b.populationReserved).toBe(true);
  expect(p.cash).toBeCloseTo(0);
  expect(populationUsed(g, 'left')).toBe(1);
});
it('população e caixa são checados atomicamente e os dois motivos podem ser exibidos', () => {
  const g = setup(),
    p = g.players.left,
    b = p.buildings[0];
  p.workers = 12;
  expect(productionBlockers(g, 'left', b)).toEqual(['population', 'cash']);
  p.cash = 100;
  step(g, 0.05);
  expect(p.cash).toBeCloseTo(101.3);
  expect(b.populationReserved).not.toBe(true);
  p.workers = 11;
  const cash = p.cash;
  step(g, 0.05);
  expect(p.cash).toBeCloseTo(cash + 1.3 - UNIT_PRODUCTION_COST.front);
  expect(b.populationReserved).toBe(true);
});
it('cobra apenas ao iniciar, não cobra durante o treinamento e mantém pedido pago se caixa zerar', () => {
  const g = setup(),
    p = g.players.left,
    b = p.buildings[0];
  p.cash = 40;
  step(g, 0.05);
  expect(p.cash).toBeCloseTo(0.4);
  p.cash = 0;
  b.autoPaused = true;
  advance(g, 8);
  expect(g.units).toHaveLength(1);
  expect(p.cash).toBeCloseTo(64);
  expect(b.populationReserved).toBe(false);
});
it('duas fábricas não gastam o mesmo caixa', () => {
  const g = setup(),
    p = g.players.left;
  p.cash = 40;
  p.buildings.push(factory(1));
  step(g, 0.05);
  expect(p.buildings.map((b) => !!b.populationReserved)).toEqual([true, false]);
  expect(productionBlockers(g, 'left', p.buildings[1])).toEqual(['cash']);
  expect(p.cash).toBeCloseTo(0.4);
});
it('custos diferentes são cobrados no servidor para as três classes', () => {
  for (const [kind, cost] of [
    ['barracks', 40],
    ['media', 55],
    ['garage', 100],
  ] as const) {
    const g = setup(),
      p = g.players.left;
    p.cash = 200;
    p.buildings[0].kind = kind;
    step(g, 0.05);
    expect(p.cash).toBeCloseTo(200 + 0.4 - cost);
    expect(p.buildings[0].populationReserved).toBe(true);
  }
});
