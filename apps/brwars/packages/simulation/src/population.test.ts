import { expect, it } from 'vitest';
import {
  createGame,
  execute,
  populationCapacity,
  populationUsed,
  spawnUnit,
  step,
  type Building,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  g.players.left.buildings = [
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
  g.players.right.buildings = [];
  g.players.left.cash = 10000;
  return g;
}
const building = (kind: Building['kind'], slot: number): Building => ({
  kind,
  slot,
  level: 1,
  progress: 0,
  constructionProgress: 1,
  completedCycles: 0,
});
it('soma trabalhadores, classes e reservas no mesmo orçamento de população', () => {
  const g = setup();
  spawnUnit(g, 'left', 'siege');
  spawnUnit(g, 'left', 'ranged');
  spawnUnit(g, 'left', 'front');
  expect(populationUsed(g, 'left')).toBe(7);
  execute(g, 'left', { type: 'hero' });
  expect(populationUsed(g, 'left')).toBe(10);
  execute(g, 'left', { type: 'worker' });
  expect(populationUsed(g, 'left')).toBe(10);
  expect(populationUsed(g, 'right')).toBe(3);
});
it('produção automática espera antes de começar e retoma com reserva quando uma morte libera vagas', () => {
  const g = setup(),
    p = g.players.left;
  p.workers = 10;
  spawnUnit(g, 'left', 'front');
  p.buildings = [building('garage', 0)];
  advance(g, 2);
  expect(p.buildings[0].progress).toBe(0);
  expect(p.buildings[0].populationReserved).not.toBe(true);
  g.units[0].hp = 0;
  step(g, 0.05);
  step(g, 0.05);
  expect(p.buildings[0].populationReserved).toBe(true);
  expect(populationUsed(g, 'left')).toBe(12);
  expect(spawnUnit(g, 'left', 'front')).toBe(false);
  advance(g, 15);
  expect(g.units.filter((u) => u.kind === 'siege')).toHaveLength(1);
  expect(p.buildings[0].populationReserved).toBe(false);
  expect(p.buildings[0].progress).toBe(0);
});
it('duas fábricas não reservam a mesma vaga e começam imediatamente o próximo pedido ao concluir', () => {
  const g = setup(),
    p = g.players.left;
  p.workers = 11;
  p.buildings = [building('barracks', 0), building('media', 1)];
  step(g, 0.05);
  expect(p.buildings.map((b) => !!b.populationReserved)).toEqual([true, false]);
  advance(g, 8);
  expect(g.units).toHaveLength(1);
  expect(populationUsed(g, 'left')).toBe(12);
  expect(p.buildings.every((b) => !b.populationReserved)).toBe(true);
  p.buildings.push(building('housing', 2));
  step(g, 0.05);
  expect(p.buildings[0].populationReserved).toBe(true);
  expect(p.buildings[1].populationReserved).toBe(true);
  const before = populationUsed(g, 'left');
  advance(g, 8);
  expect(populationUsed(g, 'left')).toBe(before + 1);
  expect(p.buildings[0].populationReserved).toBe(true);
});
it('fila manual só reserva o pedido ativo e aguarda casas prontas sem avançar treinamento', () => {
  const g = setup(),
    p = g.players.left;
  p.workers = 12;
  execute(g, 'left', { type: 'worker' });
  execute(g, 'left', { type: 'hero' });
  advance(g, 5);
  expect(p.trainingQueue[0].progress).toBe(0);
  expect(populationUsed(g, 'left')).toBe(12);
  execute(g, 'left', { type: 'build', kind: 'housing', slot: 0 });
  advance(g, 12);
  expect(populationCapacity(p)).toBe(18);
  advance(g, 0.05);
  expect(populationUsed(g, 'left')).toBe(13);
  advance(g, 5);
  expect(p.workers).toBe(13);
  expect(p.trainingQueue[0].kind).toBe('hero');
  expect(p.trainingQueue[0].populationReserved).toBe(true);
  expect(populationUsed(g, 'left')).toBe(16);
});
it('rejeita o comando removido de produção instantânea', () => {
  const g = setup();
  expect(execute(g, 'left', { type: 'instant', slot: 0 })).toMatch(/desconhecido/);
});
