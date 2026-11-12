import { expect, it } from 'vitest';
import {
  BASE_WEAPON,
  researchQuote,
  researchLevel,
  baseWeaponStats,
  createGame,
  execute,
  spawnUnit,
  step,
  stepStructureWeapon,
} from './index';
const advance = (g: ReturnType<typeof createGame>, s: number) => {
  for (let i = 0; i < Math.round(s * 20); i++) step(g, 0.05);
};
function setup() {
  const g = createGame();
  g.players.left.buildings = [];
  g.players.right.buildings = [];
  return g;
}
it('arma de estrutura escolhe inimigo vivo mais próximo no alcance e respeita cadência', () => {
  const g = setup();
  spawnUnit(g, 'left', 'front');
  spawnUnit(g, 'right', 'front');
  spawnUnit(g, 'right', 'ranged');
  const first = g.units[1],
    near = g.units[2];
  first.x = 220;
  near.x = 150;
  const damage = new Map<number, number>();
  const source = { id: -1, type: 'base' as const, slot: -1, x: 80, row: 2 };
  const cooldown = stepStructureWeapon(
    g,
    'left',
    source,
    baseWeaponStats(g.players.left),
    0,
    0.05,
    damage,
  );
  expect(damage.get(near.id)).toBe(65);
  expect(damage.has(first.id)).toBe(false);
  expect(g.hits[0]).toMatchObject({
    sourceType: 'base',
    sourceId: -1,
    targetId: near.id,
    kind: 'ranged',
  });
  expect(cooldown).toBe(1.3);
  stepStructureWeapon(g, 'left', source, baseWeaponStats(g.players.left), cooldown, 0.05, damage);
  expect(g.hits).toHaveLength(1);
  near.hp = 0;
  first.x = 231;
  expect(
    stepStructureWeapon(g, 'left', source, baseWeaponStats(g.players.left), 0, 0.05, damage),
  ).toBe(0);
  expect(g.hits).toHaveLength(1);
});
it('base resiste a pequenos grupos de tropas iniciais ou evoluídas', () => {
  for (const level of [1, 10]) {
    const g = setup();
    for (let i = 0; i < 4; i++) {
      spawnUnit(g, 'right', 'front', level);
      g.units.at(-1)!.x = 200;
    }
    advance(g, 30);
    if (level === 1) {
      expect(g.players.left.baseHp).toBeGreaterThan(1400);
      expect(g.units).toHaveLength(0);
      expect(g.players.left.kills).toBe(4);
    } else {
      expect(g.players.left.baseHp).toBeGreaterThan(4000);
      expect(g.winner).toBeNull();
    }
  }
});
it('ataques da base e tropas resolvem simultaneamente e não há friendly fire', () => {
  const g = setup();
  spawnUnit(g, 'right', 'ranged');
  const unit = g.units[0];
  unit.x = 190;
  unit.cooldown = 0;
  const hp = g.players.left.baseHp;
  step(g, 0.05);
  expect(g.players.left.baseHp).toBe(hp - 18);
  expect(g.units).toHaveLength(0);
  expect(g.players.left.kills).toBe(1);
  expect(g.hits.some((h) => h.sourceType === 'base' && h.targetId === unit.id)).toBe(true);
});
it('três upgrades pagos e temporizados aumentam apenas dano, sem cobrar duplicado ou permitir ultrapassar o máximo', () => {
  const g = setup(),
    p = g.players.left;
  p.cash = 10000;
  p.buildings.push({
    kind: 'school',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  expect(execute(g, 'left', { type: 'research', kind: 'base_artillery', slot: -1 })).toMatch(
    /escola/,
  );
  p.buildings.push({ ...p.buildings[0], slot: 2 });
  for (let level = 1; level < BASE_WEAPON.maxLevel; level++) {
    const quote = researchQuote(p, 'base_artillery'),
      cash = p.cash;
    expect(
      execute(g, 'left', {
        type: 'research',
        kind: 'base_artillery',
        slot: 1,
        level: 99,
        progress: 999,
        damage: 999,
      }),
    ).toBeNull();
    expect(p.cash).toBe(cash - quote.cost);
    expect(execute(g, 'left', { type: 'research', kind: 'base_artillery', slot: 2 })).toMatch(
      /andamento/,
    );
    expect(p.cash).toBe(cash - quote.cost);
    advance(g, quote.duration - 0.05);
    expect(p.baseAttackLevel).toBe(level);
    advance(g, 0.05);
    expect(p.baseAttackLevel).toBe(level + 1);
  }
  expect(baseWeaponStats(p)).toEqual({ damage: 89, range: 150, interval: 1.3 });
  expect(execute(g, 'left', { type: 'research', kind: 'base_artillery', slot: 1 })).toMatch(
    /máximo/,
  );
});
it('melhoria antiga em andamento ainda termina com seu bônus de obras; bônus de tropas e passagem do tempo não aumentam ataque da base', () => {
  const g = setup(),
    p = g.players.left;
  p.cash = 1000;
  p.research = [
    'construction',
    'construction',
    'construction',
    'infantry',
    'infantry',
    'infantry',
    'siege',
  ];
  const original = baseWeaponStats(p);
  p.baseAttackUpgrading = true;
  g.status = 'waiting';
  advance(g, 20);
  expect(p.baseAttackUpgradeProgress).toBe(0);
  g.status = 'playing';
  advance(g, 10.3);
  expect(p.baseAttackLevel).toBe(1);
  advance(g, 0.05);
  expect(p.baseAttackLevel).toBe(2);
  expect(researchLevel(p, 'base_artillery')).toBe(1);
  expect(baseWeaponStats(p).damage).toBe(original.damage + 8);
  g.time = 300;
  expect(baseWeaponStats(p).damage).toBe(73);
});
it('não permite melhorar sem caixa e estrutura destruída não dispara', () => {
  const g = setup(),
    p = g.players.left;
  p.buildings.push({
    kind: 'school',
    slot: 1,
    level: 1,
    progress: 0,
    constructionProgress: 1,
    completedCycles: 0,
  });
  p.cash = 0;
  expect(execute(g, 'left', { type: 'research', kind: 'base_artillery', slot: 1 })).toMatch(
    /insuficientes/,
  );
  expect(p.baseAttackUpgrading).toBe(false);
  spawnUnit(g, 'right', 'front');
  g.units[0].x = 100;
  p.baseHp = 0;
  step(g, 0.05);
  expect(g.hits.some((h) => h.sourceType === 'base' && h.side === 'left')).toBe(false);
});

it('um exército de cerco ainda pode destruir a Base reforçada', () => {
  const g = setup();
  for (let i = 0; i < 12; i++) {
    spawnUnit(g, 'right', 'siege', 15, true);
    g.units.at(-1)!.x = 150;
  }
  advance(g, 30);
  expect(g.players.left.baseHp).toBe(0);
  expect(g.winner).toBe('right');
});
