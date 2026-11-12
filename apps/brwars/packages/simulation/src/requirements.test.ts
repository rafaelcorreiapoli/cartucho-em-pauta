import { expect, it } from 'vitest';
import {
  botAct,
  BUILDING_REQUIREMENTS,
  createGame,
  execute,
  missingBuildingRequirements,
  step,
  type BuildingKind,
  type Side,
} from './index';
it('exige requisito concluído da própria facção e aplica os mesmos vínculos nos dois lados', () => {
  for (const side of ['left', 'right'] as Side[])
    for (const [kind, required] of [
      ['academy', 'school'],
      ['garage', 'media'],
      ['hospital', 'school'],
    ] as [BuildingKind, BuildingKind][]) {
      const g = createGame(),
        p = g.players[side],
        enemy = g.players[side === 'left' ? 'right' : 'left'];
      p.cash = 10000;
      enemy.buildings.push({
        kind: required,
        slot: 1,
        level: 1,
        progress: 0,
        constructionProgress: 1,
        completedCycles: 0,
      });
      for (const prerequisite of BUILDING_REQUIREMENTS[required] ?? [])
        p.buildings.push({
          kind: prerequisite,
          slot: 4,
          level: 1,
          progress: 0,
          constructionProgress: 1,
          completedCycles: 0,
          autoPaused: true,
        });
      const initialBuildings = p.buildings.length;
      expect(
        execute(g, side, { type: 'build', kind, slot: 2, requirements: [], unlocked: true }),
      ).toMatch(/primeiro/);
      expect(p.cash).toBe(10000);
      expect(p.buildings).toHaveLength(initialBuildings);
      execute(g, side, { type: 'build', kind: required, slot: 1 });
      expect(missingBuildingRequirements(p, kind)).toEqual([required]);
      expect(execute(g, side, { type: 'build', kind, slot: 2 })).toMatch(/primeiro/);
      p.buildings.find((b) => b.slot === 1)!.constructionProgress = 1;
      p.buildings.find((b) => b.slot === 1)!.upgrading = true;
      expect(missingBuildingRequirements(p, kind)).toEqual([]);
      expect(execute(g, side, { type: 'build', kind, slot: 2 })).toBeNull();
    }
});
it('demolir o requisito bloqueia novas construções, preservando as obras e prédios já iniciados', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings.push({
    kind: 'media',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
    autoPaused: true,
  });
  execute(g, 'left', { type: 'build', kind: 'garage', slot: 2 });
  execute(g, 'left', { type: 'demolish', slot: 1 });
  expect(execute(g, 'left', { type: 'build', kind: 'garage', slot: 3 })).toMatch(/primeiro/);
  for (let i = 0; i < 400; i++) step(g, 0.05);
  expect(p.buildings.find((b) => b.slot === 2)?.constructionProgress).toBe(1);
});
it('IA aguarda pré-requisito em obra e constrói quando ele termina', () => {
  const g = createGame(),
    p = g.players.left;
  p.workers = 8;
  p.cash = 10000;
  p.buildings.push({
    kind: 'media',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 0,
    completedCycles: 0,
  });
  botAct(g, 'left');
  expect(p.buildings.some((b) => b.kind === 'garage')).toBe(false);
  p.buildings[1].constructionProgress = 1;
  botAct(g, 'left');
  expect(p.buildings.some((b) => b.kind === 'garage')).toBe(true);
});
