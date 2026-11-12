import { expect, it } from 'vitest';
import {
  auraModifiers,
  createGame,
  HERO_AURAS,
  HEROES,
  HERO_HEALTH_MULTIPLIER,
  spawnUnit,
  step,
  unitAuras,
  type HeroKind,
  type Unit,
} from './index';
function setup() {
  const g = createGame();
  for (const p of Object.values(g.players)) {
    p.buildings = [];
    p.baseAttackCooldown = 10000;
  }
  return g;
}
function spawn(
  g: ReturnType<typeof createGame>,
  side: 'left' | 'right',
  kind: Unit['kind'],
  x: number,
  level = 1,
  hero?: HeroKind,
) {
  spawnUnit(g, side, kind, level, true, hero);
  const unit = g.units.at(-1)!;
  unit.x = x;
  unit.row = 0;
  unit.cooldown = 100;
  return unit;
}
it('todos têm o mesmo preço, tempo e orçamento base, com cinco passivas graduais', () => {
  for (const [hero, spec] of Object.entries(HEROES)) {
    expect(spec.cost).toBe(480);
    expect(spec.duration).toBe(12);
    const budget =
      (0.5 * spec.hp) / (520 * HERO_HEALTH_MULTIPLIER) +
      (0.35 * (spec.damage / spec.interval)) / (35 / 1.1) +
      (0.1 * spec.speed) / 21 +
      (0.05 * spec.range) / 46;
    expect(budget).toBeCloseTo(1, 3);
    const skills = HERO_AURAS[hero as HeroKind];
    expect(skills).toHaveLength(5);
    expect(skills.map((s) => s.level)).toEqual([1, 3, 8, 35, 75]);
    expect(new Set(skills.map((s) => s.id)).size).toBe(5);
  }
  expect(HEROES.stalin.hp).toBeGreaterThan(HEROES.che.hp);
  expect(HEROES.stalin.damage / HEROES.stalin.interval).toBeLessThan(
    HEROES.che.damage / HEROES.che.interval,
  );
});
it('aplica classe, lado, nível e distância radial; sair da área ou perder o herói remove a passiva', () => {
  const g = setup(),
    hero = spawn(g, 'left', 'hero', 500, 1, 'jones'),
    front = spawn(g, 'left', 'front', 510),
    ranged = spawn(g, 'right', 'ranged', 520),
    allyRanged = spawn(g, 'left', 'ranged', 515);
  expect(unitAuras(g, front).map((a) => a.stat)).toEqual(['damage']);
  expect(unitAuras(g, ranged)).toHaveLength(0);
  expect(unitAuras(g, allyRanged)).toHaveLength(0);
  hero.level = 3;
  expect(auraModifiers(unitAuras(g, ranged)).range).toBeCloseTo(0.9);
  front.x = 641;
  expect(unitAuras(g, front)).toHaveLength(0);
  front.x = 640;
  expect(unitAuras(g, front)).toHaveLength(1);
  front.row = 1;
  expect(unitAuras(g, front)).toHaveLength(0);
  front.x = 510;
  hero.hp = 0;
  expect(unitAuras(g, front)).toHaveLength(0);
  expect(unitAuras(g, ranged)).toHaveLength(0);
});
it('dano e armadura modificam o combate real, sem acumular cópias da mesma passiva', () => {
  const g = setup();
  spawn(g, 'left', 'hero', 500, 75, 'jones');
  const front = spawn(g, 'left', 'front', 510),
    enemy = spawn(g, 'right', 'front', 520);
  front.cooldown = 0;
  enemy.cooldown = 0;
  const hp = front.hp;
  const effects = unitAuras(g, front);
  expect(auraModifiers([...effects, ...effects]).damage).toBeCloseTo(1.05);
  step(g, 0.05);
  expect(g.hits.find((hit) => hit.sourceId === front.id)?.damage).toBeCloseTo(15 * 1.05);
  expect(hp - front.hp).toBeCloseTo(15 * 0.93);
});
it('debuff de alcance impede ataque à distância e desaparece ao sair da área', () => {
  const g = setup();
  spawn(g, 'left', 'hero', 500, 25, 'jones');
  spawn(g, 'left', 'front', 500);
  const ranged = spawn(g, 'right', 'ranged', 605);
  ranged.cooldown = 0;
  step(g, 0.05);
  expect(ranged.attacking).toBe(false);
  expect(g.hits.some((hit) => hit.sourceId === ranged.id)).toBe(false);
  g.units = g.units.filter((unit) => unit.kind !== 'hero');
  ranged.cooldown = 0;
  step(g, 0.05);
  expect(ranged.attacking).toBe(true);
  expect(g.hits.some((hit) => hit.sourceId === ranged.id)).toBe(true);
});
it('movimento e cadência usam as auras do nível atual e têm limites de acúmulo', () => {
  const g = setup(),
    hero = spawn(g, 'left', 'hero', 500, 100, 'jones'),
    front = spawn(g, 'left', 'front', 510);
  const x = front.x;
  step(g, 0.05);
  expect(front.x - x).toBeCloseTo(23 * 1.05 * 0.05);
  spawn(g, 'right', 'front', front.x + 10);
  front.cooldown = 0;
  step(g, 0.05);
  expect(front.cooldown).toBeCloseTo(1.1 / 1.05);
  expect(unitAuras(g, front).some((a) => a.level === 75)).toBe(true);
  hero.level = 1;
  expect(auraModifiers(unitAuras(g, front)).attackSpeed).toBe(1);
});

it('passivas só entram em vigor no novo nível de desbloqueio', () => {
  const g = setup(),
    hero = spawn(g, 'left', 'hero', 500, 1, 'jones');
  const front = spawn(g, 'left', 'front', 510),
    ranged = spawn(g, 'right', 'ranged', 520);
  for (const skill of HERO_AURAS.jones.slice(1)) {
    hero.level = skill.level - 1;
    expect(
      [...unitAuras(g, front), ...unitAuras(g, ranged)].some((effect) => effect.id === skill.id),
    ).toBe(false);
    hero.level = skill.level;
    expect(
      [...unitAuras(g, front), ...unitAuras(g, ranged)].some((effect) => effect.id === skill.id),
    ).toBe(true);
  }
});

it.each(['left', 'right'] as const)(
  '%s recebe bônus leves de tropas próximas sem acumular cópias',
  (side) => {
    const g = setup();
    const soundCar = spawn(g, side, 'siege', 500);
    const secondCar = spawn(g, side, 'siege', 500);
    const marshal = spawn(g, side, 'front', 500, 15);
    marshal.productionTier = 3;
    const scout = spawn(g, side, 'ranged', 500, 10);
    scout.productionTier = 2;
    const infantry = spawn(g, side, 'front', 510);
    const shooter = spawn(g, side, 'ranged', 510);
    const enemy = spawn(g, side === 'left' ? 'right' : 'left', 'front', 515);
    expect(auraModifiers(unitAuras(g, infantry))).toMatchObject({
      speed: 1.03,
      damage: 1.03,
      range: 1,
    });
    expect(auraModifiers(unitAuras(g, shooter))).toMatchObject({
      speed: 1.03,
      damage: 1,
      range: 1.04,
    });
    expect(unitAuras(g, enemy)).toHaveLength(0);
    soundCar.hp = 0;
    secondCar.x = 606;
    expect(auraModifiers(unitAuras(g, infantry)).speed).toBe(1);
  },
);
