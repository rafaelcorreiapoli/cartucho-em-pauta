import { expect, it } from 'vitest';
import {
  BASE_HP,
  baseDamageMultiplier,
  createGame,
  execute,
  maxBaseHp,
  researchBuilding,
  RESEARCHES,
  researchLevel,
  researchQuote,
  spawnUnit,
  step,
  unitAttackMultiplier,
  UNITS,
  type ResearchKind,
} from './index';
const advance = (game: ReturnType<typeof createGame>, seconds: number) => {
  for (let i = 0; i < Math.round(seconds * 20); i++) step(game, 0.05);
};
function setup(kind: ResearchKind = 'infantry') {
  const game = createGame();
  for (const player of Object.values(game.players)) player.buildings = [];
  game.players.left.cash = 10000;
  game.players.left.buildings = [
    {
      kind: researchBuilding(kind),
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  return game;
}
it('enfileira pesquisas e níveis no mesmo prédio, cobrando cada pedido e avançando em ordem', () => {
  const game = setup(),
    p = game.players.left;
  expect(
    execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry', progress: 999 }),
  ).toBeNull();
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: 'mobility' })).toBeNull();
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry' })).toBeNull();
  expect(p.cash).toBe(10000 - RESEARCHES.infantry.cost * 4 - RESEARCHES.mobility.cost);
  expect(p.researchJobs.map(({ kind, level }) => [kind, level])).toEqual([
    ['infantry', 1],
    ['mobility', 1],
    ['infantry', 2],
  ]);
  advance(game, 19.95);
  expect(p.research).toHaveLength(0);
  expect(p.researchJobs.slice(1).map(({ progress }) => progress)).toEqual([0, 0]);
  step(game, 0.1);
  expect(p.research).toEqual(['infantry']);
  expect(p.researchJobs[0].progress).toBeCloseTo(0.05);
  advance(game, 24.95);
  expect(p.research).toEqual(['infantry', 'mobility']);
  expect(p.researchJobs[0]).toMatchObject({ kind: 'infantry', level: 2, duration: 30 });
  advance(game, 30);
  expect(researchLevel(p, 'infantry')).toBe(2);
  expect(p.researchJobs).toHaveLength(0);
});
it('ataque global afeta infantaria atual e futura, preservando cerco e adversários', () => {
  const game = setup();
  execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry' });
  advance(game, 20);
  for (const kind of ['front', 'ranged', 'siege', 'hero'] as const) {
    spawnUnit(game, 'left', kind);
    const unit = game.units.at(-1)!;
    unit.x = 920;
    unit.cooldown = 0;
    step(game, 0.05);
    const hit = game.hits.filter((hit) => hit.sourceId === unit.id).at(-1)!;
    const heroAura = kind === 'hero' ? 1 : 1;
    expect(hit.damage).toBeCloseTo(UNITS[kind].damage * (kind === 'front' ? 1.05 : 1) * heroAura);
  }
  spawnUnit(game, 'right', 'front');
  const enemy = game.units.at(-1)!;
  enemy.x = 80;
  enemy.cooldown = 0;
  step(game, 0.05);
  expect(game.hits.find((hit) => hit.sourceId === enemy.id)?.damage).toBe(UNITS.front.damage);
});
it('vida beneficia todas as unidades, preserva percentual de ferimento e se aplica a recrutas', () => {
  const game = setup('vitality');
  spawnUnit(game, 'left', 'hero', 2);
  const unit = game.units[0];
  unit.hp = unit.maxHp * 0.5;
  const previous = unit.maxHp;
  execute(game, 'left', { type: 'research', slot: 1, kind: 'vitality' });
  advance(game, 25);
  expect(unit.maxHp).toBeCloseTo(previous * 1.02);
  expect(unit.hp / unit.maxHp).toBeCloseTo(0.5);
  spawnUnit(game, 'left', 'siege');
  expect(game.units.at(-1)?.maxHp).toBeCloseTo(UNITS.siege.hp * 1.02);
});
it('fortificação e defesa aumentam resistência da base sem ultrapassar a nova vida máxima', () => {
  const game = setup('fortification');
  execute(game, 'left', { type: 'research', slot: 1, kind: 'fortification' });
  advance(game, 30);
  expect(maxBaseHp(game.players.left)).toBe(BASE_HP + 200);
  expect(game.players.left.baseHp).toBe(BASE_HP + 200);
  execute(game, 'left', { type: 'research', slot: 1, kind: 'defense' });
  advance(game, 30);
  spawnUnit(game, 'right', 'front');
  const enemy = game.units[0];
  enemy.x = 80;
  enemy.cooldown = 0;
  const hp = game.players.left.baseHp;
  step(game, 0.05);
  expect(hp - game.players.left.baseHp).toBeCloseTo(UNITS.front.damage * 0.85);
});
it('valida pesquisa, propriedade, recursos, obra e espera; faculdades diferentes podem pesquisar em paralelo', () => {
  const game = setup(),
    p = game.players.left;
  expect(execute(game, 'right', { type: 'research', slot: 1, kind: 'infantry' })).toMatch(/escola/);
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: '__proto__' })).toMatch(
    /inválida/,
  );
  p.buildings[0].constructionProgress = 0;
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry' })).toMatch(
    /concluída/,
  );
  p.buildings[0].constructionProgress = 1;
  p.cash = 0;
  expect(execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry' })).toMatch(
    /insuficientes/,
  );
  p.cash = 10000;
  p.buildings.push({ ...p.buildings[0], kind: 'academy', slot: 2 });
  execute(game, 'left', { type: 'research', slot: 1, kind: 'infantry' });
  execute(game, 'left', { type: 'research', slot: 2, kind: 'vitality' });
  expect(p.researchJobs).toHaveLength(2);
  game.status = 'waiting';
  advance(game, 30);
  expect(p.researchJobs[0].progress).toBe(0);
});

it('todas as pesquisas têm três níveis sequenciais com custos, tempos e teto autoritativos', () => {
  for (const kind of Object.keys(RESEARCHES) as ResearchKind[]) {
    const game = setup(kind),
      p = game.players.left;
    for (let level = 1; level <= 3; level++) {
      const quote = researchQuote(p, kind),
        cash = p.cash;
      expect(quote).toEqual({
        level,
        cost: kind === 'base_artillery' ? 250 * level : RESEARCHES[kind].cost * 3 ** (level - 1),
        duration:
          kind === 'base_artillery'
            ? 10 + 5 * level
            : Math.round(RESEARCHES[kind].duration * (1 + (level - 1) * 0.5)),
      });
      expect(
        execute(game, 'left', { type: 'research', slot: 1, kind, level: 99, duration: 0, cost: 0 }),
      ).toBeNull();
      expect(p.cash).toBe(cash - quote.cost);
      expect(p.researchJobs[0]).toMatchObject({ level, duration: quote.duration });
      advance(game, quote.duration - 0.05);
      expect(researchLevel(p, kind)).toBe(level - 1);
      advance(game, 0.05);
      expect(researchLevel(p, kind)).toBe(level);
    }
    expect(execute(game, 'left', { type: 'research', slot: 1, kind })).toMatch(/máximo/);
    expect(p.researchJobs).toHaveLength(0);
  }
});
it('as três classes têm bônus independentes e os níveis acumulam vida e resistência', () => {
  const game = setup('vitality'),
    p = game.players.left;
  p.research = ['infantry', 'infantry', 'infantry', 'marksmanship', 'marksmanship', 'siege'];
  expect(unitAttackMultiplier(p, 'front')).toBeCloseTo(1.15);
  expect(unitAttackMultiplier(p, 'ranged')).toBeCloseTo(1.1);
  expect(unitAttackMultiplier(p, 'siege')).toBeCloseTo(1.05);
  expect(unitAttackMultiplier(p, 'hero')).toBe(1);
  p.research = [];
  for (const kind of ['vitality', 'fortification', 'defense'] as const)
    for (let level = 1; level <= 3; level++) {
      execute(game, 'left', { type: 'research', slot: 1, kind });
      advance(game, researchQuote(p, kind).duration);
    }
  expect(maxBaseHp(p)).toBe(BASE_HP + 600);
  expect(p.baseHp).toBe(BASE_HP + 600);
  expect(baseDamageMultiplier(p)).toBeCloseTo(0.55);
  spawnUnit(game, 'left', 'front');
  expect(game.units.at(-1)?.maxHp).toBeCloseTo(UNITS.front.hp * 1.06);
});
