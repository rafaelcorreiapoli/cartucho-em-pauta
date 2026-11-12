import { expect, it } from 'vitest';
import {
  buildingJobCapacity,
  buildingUpgradeCost,
  buildingInvestment,
  createGame,
  demolitionRefund,
  execute,
  researchQuote,
} from './index';
it('upgrades têm progressão exponencial e recusam caixa abaixo do preço exibido', () => {
  expect([1, 2, 3, 5, 10, 14].map((level) => buildingUpgradeCost({ level }))).toEqual([
    160, 260, 440, 1190, 14500, 107500,
  ]);
  const g = createGame(),
    p = g.players.left,
    b = p.buildings[0];
  b.level = 5;
  p.cash = 1189;
  expect(execute(g, 'left', { type: 'upgrade', slot: 0 })).toMatch(/insuficientes/);
  expect(p.cash).toBe(1189);
  const investment = buildingInvestment(b);
  p.cash = 1190;
  expect(execute(g, 'left', { type: 'upgrade', slot: 0 })).toBeNull();
  expect(p.cash).toBe(0);
  expect(demolitionRefund(b)).toBe((investment + 1190) / 2);
});
it('pesquisas custam 1, 3 e 9 vezes o valor inicial', () => {
  const p = createGame().players.left;
  expect(researchQuote(p, 'mobility').cost).toBe(200);
  p.research = ['mobility'];
  expect(researchQuote(p, 'mobility').cost).toBe(600);
  p.research.push('mobility');
  expect(researchQuote(p, 'mobility').cost).toBe(1800);
});
it('níveis de prédios comuns não criam empregos extras', () => {
  const b = createGame().players.left.buildings[0];
  for (const kind of [
    'barracks',
    'media',
    'garage',
    'housing',
    'school',
    'hospital',
    'academy',
    'bank',
    'civic',
  ] as const) {
    expect(buildingJobCapacity({ ...b, kind, level: 15 })).toBe(
      buildingJobCapacity({ ...b, kind, level: 1 }),
    );
    expect(buildingJobCapacity({ ...b, kind, level: 15 })).toBeLessThanOrEqual(1);
  }
  expect(buildingJobCapacity({ ...b, kind: 'workplace', level: 15 })).toBe(68);
});
