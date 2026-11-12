import { expect, it } from 'vitest';
import {
  BUILDINGS,
  createGame,
  effectiveBuildingPopularityRate,
  execute,
  nextPopularityBuildingRate,
  popularityContributions,
  popularityRate,
  step,
  type Building,
  type BuildingKind,
} from './index';
const building = (kind: BuildingKind, slot: number, level = 1): Building => ({
  kind,
  slot,
  level,
  progress: 0,
  constructionProgress: 1,
  completedCycles: 0,
});
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) p.buildings = [];
  g.players.left.cash = 10000;
  return g;
}
it('cada tipo tem retornos 100%, 35%, 12,25% e diversificar supera repetir', () => {
  for (const kind of ['civic', 'school', 'hospital', 'academy'] as const) {
    const g = setup(),
      p = g.players.left,
      base = BUILDINGS[kind].popularityYield / 10;
    p.buildings = [building(kind, 0)];
    expect(popularityRate(p)).toBeCloseTo(base);
    expect(nextPopularityBuildingRate(p, kind)).toBeCloseTo(base * 0.35);
    p.buildings.push(building(kind, 1), building(kind, 2));
    expect(popularityRate(p)).toBeCloseTo(base * (1 + 0.35 + 0.1225));
    expect(popularityContributions(p).map((b) => b.efficiency)).toEqual([1, 0.35, 0.35 ** 2]);
  }
  const g = setup(),
    p = g.players.left;
  p.buildings = [building('civic', 0), building('school', 1), building('hospital', 2)];
  expect(popularityRate(p)).toBeCloseTo(2.4);
  expect(BUILDINGS.civic.cost).toBeLessThan(BUILDINGS.school.cost);
  expect(BUILDINGS.school.cost).toBeLessThan(BUILDINGS.hospital.cost);
});
it('prédios sem evolução mantêm prioridade estável por terreno, sem reduzir o total ao adicionar uma cópia fraca', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [building('civic', 3, 15)];
  const previous = popularityRate(p);
  p.buildings.push(building('civic', 0));
  expect(popularityRate(p)).toBeGreaterThan(previous);
  expect(effectiveBuildingPopularityRate(p, p.buildings[0])).toBeCloseTo(0.21);
  expect(effectiveBuildingPopularityRate(p, p.buildings[1])).toBeCloseTo(0.6);
  const rate = popularityRate(p);
  p.buildings.reverse();
  expect(popularityRate(p)).toBe(rate);
  expect(execute(g, 'left', { type: 'auto-production', slot: 3, paused: true })).toMatch(
    /automática/,
  );
  expect(popularityRate(p)).toBeCloseTo(rate);
  execute(g, 'left', { type: 'demolish', slot: 3 });
  expect(popularityRate(p)).toBeCloseTo(0.6);
});
it('mesmo todas as vagas no nível máximo de um só tipo não compensam impostos máximos', () => {
  for (const kind of ['civic', 'school', 'hospital', 'academy'] as const) {
    const g = setup(),
      p = g.players.left;
    p.taxRate = 30;
    p.buildings = Array.from({ length: 48 }, (_, slot) => building(kind, slot, 15));
    expect(popularityRate(p)).toBeLessThan(0);
  }
});
it('escola é independente e hospital exige escola concluída; popularidade começa na inauguração', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [building('civic', 0)];
  expect(execute(g, 'left', { type: 'build', kind: 'hospital', slot: 2 })).toMatch(/Conclua/);
  expect(execute(g, 'left', { type: 'build', kind: 'school', slot: 1 })).toBeNull();
  expect(popularityRate(p)).toBeCloseTo(0.6);
  expect(execute(g, 'left', { type: 'build', kind: 'hospital', slot: 2 })).toMatch(/Conclua/);
  for (let i = 0; i < 500; i++) step(g, 0.05);
  expect(popularityRate(p)).toBeCloseTo(1.4);
  expect(execute(g, 'left', { type: 'build', kind: 'hospital', slot: 2 })).toBeNull();
  for (let i = 0; i < 700; i++) step(g, 0.05);
  expect(popularityRate(p)).toBeCloseTo(2.4);
});
