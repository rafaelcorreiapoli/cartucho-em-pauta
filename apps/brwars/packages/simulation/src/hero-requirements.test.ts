import { expect, it } from 'vitest';
import {
  createGame,
  execute,
  heroRecruitmentRequirements,
  heroRoster,
  populationCapacity,
  type Building,
} from './index';
const building = (kind: Building['kind'], slot: number, level = 1): Building => ({
  kind,
  slot,
  level,
  progress: 0,
  constructionProgress: 1,
  completedCycles: 0,
});
it('segundo requer Universidade própria pronta e terceiro requer capacidade 100, contando mortos e fila', () => {
  for (const side of ['left', 'right'] as const) {
    const g = createGame(),
      p = g.players[side],
      enemy = g.players[side === 'left' ? 'right' : 'left'],
      [first, second, third] = heroRoster(side);
    p.buildings = [building('civic', 0)];
    p.cash = 10000;
    expect(execute(g, side, { type: 'hero', hero: first })).toBeNull();
    const cash = p.cash;
    enemy.buildings.push(building('academy', 1));
    expect(execute(g, side, { type: 'hero', hero: second })).toMatch(/concluída/);
    expect(p.cash).toBe(cash);
    const academy = building('academy', 1);
    academy.constructionProgress = 0.9;
    p.buildings.push(academy);
    expect(execute(g, side, { type: 'hero', hero: second })).toMatch(/concluída/);
    academy.constructionProgress = 1;
    expect(execute(g, side, { type: 'hero', hero: second })).toBeNull();
    p.heroes[0].status = 'dead';
    p.trainingQueue.shift();
    expect(execute(g, side, { type: 'hero', hero: third })).toMatch(/100/);
    p.workers = 100;
    expect(execute(g, side, { type: 'hero', hero: third })).toMatch(/100/);
    p.workers = 3;
    for (let slot = 10; slot < 25; slot++) p.buildings.push(building('housing', slot));
    expect(populationCapacity(p)).toBe(102);
    expect(heroRecruitmentRequirements(p, side)).toEqual([]);
    expect(execute(g, side, { type: 'hero', hero: third })).toBeNull();
  }
});
