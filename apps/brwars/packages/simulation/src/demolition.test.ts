import { expect, it } from 'vitest';
import {
  buildingInvestment,
  createGame,
  demolitionRefund,
  execute,
  ownsPlot,
  populationCapacity,
  populationUsed,
  step,
} from './index';
it('recupera metade da construção e de todos os upgrades, preserva terreno e permite reconstruir', () => {
  const g = createGame(),
    p = g.players.left,
    b = p.buildings[0];
  p.cash = 10000;
  b.level = 3;
  expect(buildingInvestment(b)).toBe(180 + 160 + 320);
  expect(demolitionRefund(b)).toBe(330);
  expect(
    execute(g, 'left', { type: 'demolish', slot: 0, refund: 999999, side: 'right' }),
  ).toBeNull();
  expect(p.cash).toBe(10330);
  expect(p.buildings).toHaveLength(0);
  expect(ownsPlot(p, 0)).toBe(true);
  expect(g.players.right.buildings).toHaveLength(1);
  expect(execute(g, 'left', { type: 'build', kind: 'housing', slot: 0 })).toBeNull();
  expect(p.cash).toBe(10130);
});
it('inclui upgrade em andamento já pago e não reembolsa produção de tropas ou custo do terreno', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  execute(g, 'left', { type: 'buy-plot', slot: 47 });
  execute(g, 'left', { type: 'build', kind: 'barracks', slot: 47 });
  const b = p.buildings.at(-1)!;
  b.constructionProgress = 1;
  execute(g, 'left', { type: 'upgrade', slot: 47 });
  step(g, 0.05);
  expect(b.populationReserved).toBe(true);
  const cash = p.cash,
    used = populationUsed(g, 'left');
  expect(demolitionRefund(b)).toBe(170);
  execute(g, 'left', { type: 'demolish', slot: 47 });
  expect(p.cash).toBe(cash + 170);
  expect(populationUsed(g, 'left')).toBe(used - 1);
  expect(ownsPlot(p, 47)).toBe(true);
});
it('permite demolir obra e cancela pesquisa local sem apagar tecnologias já concluídas', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  execute(g, 'left', { type: 'build', kind: 'housing', slot: 1 });
  const cash = p.cash;
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(p.cash).toBe(cash + 100);
  p.buildings.push({
    kind: 'school',
    slot: 2,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  execute(g, 'left', { type: 'build', kind: 'academy', slot: 1 });
  p.buildings.at(-1)!.constructionProgress = 1;
  p.research = ['infantry'];
  execute(g, 'left', { type: 'research', slot: 1, kind: 'vitality' });
  expect(p.researchJobs).toHaveLength(1);
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(p.researchJobs).toHaveLength(0);
  expect(p.research).toEqual(['infantry']);
});
it('demolir moradia reduz capacidade sem matar unidades e rejeita terreno vazio/inválido ou partida parada', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 1000;
  execute(g, 'left', { type: 'build', kind: 'housing', slot: 1 });
  p.buildings[1].constructionProgress = 1;
  p.workers = 16;
  expect(populationCapacity(p)).toBe(18);
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(populationCapacity(p)).toBe(12);
  expect(p.workers).toBe(16);
  const cash = p.cash;
  expect(execute(g, 'left', { type: 'demolish', slot: 1 })).toMatch(/Nenhuma/);
  expect(execute(g, 'left', { type: 'demolish', slot: 48 })).toMatch(/inválido/);
  expect(p.cash).toBe(cash);
  g.status = 'waiting';
  expect(execute(g, 'left', { type: 'demolish', slot: 0 })).toMatch(/andamento/);
});
