import { expect, it } from 'vitest';
import {
  BUILDING_SLOTS,
  INITIAL_PLOTS,
  PLOT_COST,
  botAct,
  createGame,
  execute,
  ownsPlot,
} from './index';
it('começa com seis terrenos próprios por jogador, contando o prédio inicial', () => {
  const g = createGame();
  for (const p of Object.values(g.players)) {
    expect(p.ownedPlots).toEqual([...INITIAL_PLOTS]);
    expect(p.ownedPlots).toHaveLength(6);
    expect(ownsPlot(p, p.buildings[0].slot)).toBe(true);
  }
  expect(BUILDING_SLOTS).toBe(48);
});
it('cobra aquisição separada da obra e não aceita construir sem possuir o terreno', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 1000;
  expect(execute(g, 'left', { type: 'build', kind: 'housing', slot: 47 })).toMatch(/Adquira/);
  expect(p.cash).toBe(1000);
  expect(execute(g, 'left', { type: 'buy-plot', slot: 47, cost: 0, side: 'right' })).toBeNull();
  expect(p.cash).toBe(1000 - PLOT_COST);
  expect(ownsPlot(g.players.right, 47)).toBe(false);
  expect(execute(g, 'left', { type: 'build', kind: 'housing', slot: 47 })).toBeNull();
  expect(p.cash).toBe(1000 - PLOT_COST - 200);
  expect(p.buildings.at(-1)?.slot).toBe(47);
});
it('rejeita compra repetida, índices inválidos e recursos insuficientes sem mudar estado', () => {
  const g = createGame(),
    p = g.players.left;
  for (const slot of [-1, 48, 1.5, '6', undefined])
    expect(execute(g, 'left', { type: 'buy-plot', slot })).toMatch(/inválido/);
  expect(execute(g, 'left', { type: 'buy-plot', slot: 0 })).toMatch(/adquirido/);
  p.cash = PLOT_COST - 1;
  expect(execute(g, 'left', { type: 'buy-plot', slot: 6 })).toMatch(/insuficientes/);
  expect(p.ownedPlots).toHaveLength(6);
  p.cash = 500;
  execute(g, 'left', { type: 'buy-plot', slot: 6 });
  const cash = p.cash;
  expect(execute(g, 'left', { type: 'buy-plot', slot: 6 })).toMatch(/adquirido/);
  expect(p.cash).toBe(cash);
  g.status = 'waiting';
  expect(execute(g, 'left', { type: 'buy-plot', slot: 7 })).toMatch(/andamento/);
});
it('IA compra novos terrenos quando já ocupou os iniciais', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.workers = 8;
  p.buildings = INITIAL_PLOTS.map((slot) => ({
    kind: 'barracks' as const,
    slot,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  }));
  botAct(g, 'left');
  expect(p.ownedPlots).toContain(6);
  expect(p.buildings).toHaveLength(6);
  botAct(g, 'left');
  expect(p.buildings.some((b) => b.slot === 6)).toBe(true);
});
