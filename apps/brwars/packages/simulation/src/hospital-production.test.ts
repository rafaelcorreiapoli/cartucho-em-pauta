import { expect, it } from 'vitest';
import {
  BUILDINGS,
  canUpgradeBuilding,
  createGame,
  createHeroRecord,
  execute,
  populationUsed,
  spawnUnit,
  step,
  type Building,
} from './index';
const hospital = (slot: number): Building => ({
  kind: 'hospital',
  slot,
  level: 1,
  progress: 0,
  constructionProgress: 1,
  completedCycles: 0,
});
it('fábricas de combate, moradias e empregos evoluem; demais edifícios recusam sem cobrar', () => {
  for (const kind of Object.keys(BUILDINGS) as Building['kind'][]) {
    const g = createGame(),
      p = g.players.left;
    p.cash = 10000;
    p.buildings = [{ ...hospital(1), kind }];
    const result = execute(g, 'left', { type: 'upgrade', slot: 1 });
    if (['barracks', 'media', 'garage', 'housing', 'workplace'].includes(kind)) {
      expect(canUpgradeBuilding(kind)).toBe(true);
      expect(result).toBeNull();
    } else {
      expect(canUpgradeBuilding(kind)).toBe(false);
      expect(result).toMatch(/indisponível/);
      expect(p.cash).toBe(10000);
    }
  }
});
it.each(['left', 'right'] as const)(
  '%s produz médico apenas no hospital pronto, em nível 1, com fila independente',
  (side) => {
    const g = createGame(),
      p = g.players[side];
    p.cash = 10000;
    expect(execute(g, side, { type: 'medic' })).toMatch(/Hospital/);
    p.buildings = [hospital(1), hospital(2)];
    p.buildings[0].constructionProgress = 0.5;
    expect(execute(g, side, { type: 'medic', slot: 1 })).toMatch(/Hospital/);
    p.buildings[0].constructionProgress = 1;
    p.buildings[0].level = 15;
    expect(execute(g, side, { type: 'medic', slot: 1, level: 99 })).toBeNull();
    expect(execute(g, side, { type: 'medic', slot: 2 })).toBeNull();
    expect(p.trainingQueue).toHaveLength(0);
    expect(populationUsed(g, side)).toBe(7);
    for (let i = 0; i < 200; i++) step(g, 0.05);
    expect(g.units.filter((u) => u.side === side && u.kind === 'medic')).toHaveLength(2);
    expect(
      g.units.filter((u) => u.side === side && u.kind === 'medic').every((u) => u.level === 1),
    ).toBe(true);
    spawnUnit(g, side, 'medic', 15, true);
    expect(g.units.at(-1)?.level).toBe(1);
  },
);
it('hospital não revive enquanto há médicos na fila e libera reserva ao demolir', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings = [hospital(1)];
  p.heroes = [createHeroRecord('jones', 1, 'dead')];
  execute(g, 'left', { type: 'medic', slot: 1 });
  expect(execute(g, 'left', { type: 'hero-revive', hero: 'jones', slot: 1 })).toMatch(
    /recuperando/,
  );
  expect(populationUsed(g, 'left')).toBe(5);
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(populationUsed(g, 'left')).toBe(3);
});
it('médico aguarda a recuperação em curso, sem reservar população antes de iniciar', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings = [hospital(1)];
  p.heroes = [createHeroRecord('jones', 1, 'dead')];
  execute(g, 'left', { type: 'hero-revive', hero: 'jones', slot: 1 });
  execute(g, 'left', { type: 'medic', slot: 1 });
  expect(p.buildings[0].medicQueue?.[0].populationReserved).not.toBe(true);
  for (let i = 0; i < 160; i++) step(g, 0.05);
  expect(p.heroes[0].status).toBe('alive');
  expect(p.buildings[0].medicQueue?.[0].populationReserved).toBe(true);
});
