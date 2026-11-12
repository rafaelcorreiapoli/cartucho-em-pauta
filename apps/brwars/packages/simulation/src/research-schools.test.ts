import { expect, it } from 'vitest';
import { availableResearches, BUILDINGS, createGame, execute, popularityRate } from './index';
it('escola e universidade têm catálogos distintos, autoritativos e podem pesquisar em paralelo', () => {
  const g = createGame(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings = [
    { kind: 'school', slot: 1, level: 1, progress: 0, constructionProgress: 1, completedCycles: 0 },
    {
      kind: 'academy',
      slot: 2,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  expect(BUILDINGS.academy.cost).toBeGreaterThan(BUILDINGS.school.cost * 2);
  expect(popularityRate(p)).toBeCloseTo(1.9);
  for (const kind of availableResearches('school'))
    expect(execute(g, 'left', { type: 'research', slot: 2, kind })).toMatch(/escola/);
  for (const kind of availableResearches('academy'))
    expect(execute(g, 'left', { type: 'research', slot: 1, kind })).toMatch(/universidade/);
  expect(execute(g, 'left', { type: 'research', slot: 1, kind: 'mobility' })).toBeNull();
  expect(execute(g, 'left', { type: 'research', slot: 2, kind: 'siege' })).toBeNull();
  expect(p.researchJobs).toHaveLength(2);
});

it('distribui obras na escola e artilharia e cerco na universidade', () => {
  expect(availableResearches('school')).toContain('construction');
  expect(availableResearches('academy')).not.toContain('construction');
  for (const kind of ['marksmanship', 'siege', 'production']) {
    expect(availableResearches('academy')).toContain(kind);
    expect(availableResearches('school')).not.toContain(kind);
  }
});
