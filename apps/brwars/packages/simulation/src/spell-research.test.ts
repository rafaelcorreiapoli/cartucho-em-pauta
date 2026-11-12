import { expect, it } from 'vitest';
import {
  createGame,
  execute,
  GLOBAL_POWERS,
  globalPowerQuote,
  researchLevel,
  spawnUnit,
  step,
  type GlobalPowerKind,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  for (const player of Object.values(g.players))
    player.unlockedPowers = Object.keys(GLOBAL_POWERS) as GlobalPowerKind[];
  for (const p of Object.values(g.players)) {
    p.buildings = [];
    p.baseAttackCooldown = 100000;
  }
  g.players.left.cash = 10000;
  return g;
}
it('todas as magias cobram o custo exato com desconto e ignoram custos enviados pelo cliente', () => {
  for (const kind of Object.keys(GLOBAL_POWERS) as GlobalPowerKind[]) {
    const g = setup(),
      p = g.players.left;
    spawnUnit(g, 'left', 'front');
    spawnUnit(g, 'right', 'hero');
    p.research = ['spell_threshold', 'spell_threshold', 'spell_threshold'];
    const quote = globalPowerQuote(p, kind);
    expect(quote.cost).toBe(Math.ceil(GLOBAL_POWERS[kind].cost * 0.7));
    p.popularity = quote.cost - 1;
    expect(execute(g, 'left', { type: 'power', kind, cost: 0, requiredPopularity: 0 })).toMatch(
      /insuficiente/,
    );
    expect(p.powerCooldowns[kind]).toBe(0);
    p.popularity = quote.cost;
    expect(execute(g, 'left', { type: 'power', kind, cooldown: 0 })).toBeNull();
    expect(p.popularity).toBe(0);
    expect(p.powerCooldowns[kind]).toBe(quote.cooldown);
    expect(execute(g, 'left', { type: 'power', kind })).toMatch(/recarregando/);
    expect(p.popularity).toBe(0);
  }
});
it('reutilizar magia após recarga exige repor o custo de popularidade', () => {
  const g = setup(),
    p = g.players.left;
  spawnUnit(g, 'left', 'hero');
  p.popularity = 75;
  expect(execute(g, 'left', { type: 'power', kind: 'strength' })).toBeNull();
  expect(p.popularity).toBe(0);
  advance(g, 45);
  expect(p.powerCooldowns.strength).toBe(0);
  expect(execute(g, 'left', { type: 'power', kind: 'strength' })).toMatch(/insuficiente/);
  p.popularity = 75;
  expect(execute(g, 'left', { type: 'power', kind: 'strength' })).toBeNull();
  expect(p.popularity).toBe(0);
});
it('pesquisas modificam todas as magias em três níveis e não afetam o adversário', () => {
  const g = setup(),
    p = g.players.left;
  for (let level = 1; level <= 3; level++) {
    p.research.push('spell_cooldown', 'spell_threshold');
    for (const kind of Object.keys(GLOBAL_POWERS) as GlobalPowerKind[]) {
      expect(globalPowerQuote(p, kind).cooldown).toBeCloseTo(
        GLOBAL_POWERS[kind].cooldown * (1 - 0.1 * level),
      );
      expect(globalPowerQuote(p, kind).cost).toBe(
        Math.ceil(GLOBAL_POWERS[kind].cost * (1 - 0.1 * level)),
      );
      expect(globalPowerQuote(g.players.right, kind)).toEqual({
        cooldown: GLOBAL_POWERS[kind].cooldown,
        cost: GLOBAL_POWERS[kind].cost,
      });
    }
  }
});
it('só aplica a pesquisa ao concluir e preserva a fração das recargas em andamento', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings = [
    {
      kind: 'academy',
      slot: 1,
      level: 1,
      progress: 0,
      constructionProgress: 1,
      completedCycles: 0,
    },
  ];
  expect(execute(g, 'left', { type: 'research', slot: 1, kind: 'spell_cooldown' })).toBeNull();
  expect(globalPowerQuote(p, 'bills').cooldown).toBe(45);
  p.researchJobs[0].progress = 24.95;
  p.powerCooldowns.bills = 30;
  p.powerCooldowns.recall = 10;
  step(g, 0.05);
  expect(researchLevel(p, 'spell_cooldown')).toBe(1);
  expect(globalPowerQuote(p, 'bills').cooldown).toBe(40.5);
  expect(p.powerCooldowns.bills).toBeCloseTo(29.95 * 0.9);
  expect(p.powerCooldowns.recall).toBeCloseTo(9.95 * 0.9);
  expect(p.powerCooldowns.strength).toBe(0);
});
