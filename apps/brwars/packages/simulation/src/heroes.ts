import { UNITS, type Side } from './content';
import type { Player, TrainingOrder, Unit } from './model';
const common = { ...UNITS.hero, cost: 480, duration: 12, population: 3, cooldown: 60 };
export const HERO_HEALTH_MULTIPLIER = 3;
/** Base combat budget: 50% health, 35% DPS, 10% movement, 5% reach. */
function balanced(hp: number, speed: number, range: number, interval: number) {
  const budget = 1 - (0.5 * hp) / 520 - (0.1 * speed) / 21 - (0.05 * range) / 46;
  return {
    hp: hp * HERO_HEALTH_MULTIPLIER,
    speed,
    range,
    interval,
    damage: Math.round((budget / 0.35) * (35 / 1.1) * interval * 100) / 100,
  };
}
export const HEROES = {
  jones: {
    ...common,
    ...balanced(520, 21, 46, 1.1),
    side: 'left',
    name: 'Jones Manoel',
    description: 'Equilibrado. Organiza a infantaria e atrapalha atiradores.',
  },
  mamaefalei: {
    ...common,
    ...balanced(520, 21, 46, 1.1),
    side: 'right',
    name: 'Mamãe Falei',
    description: 'Equilibrado. Fortalece atiradores e atrasa a linha de frente.',
  },
  che: {
    ...common,
    ...balanced(400, 28, 46, 0.9),
    side: 'left',
    name: 'Che Guevara',
    description: 'Ágil e ofensivo, com menos vida. Apoia a infantaria.',
  },
  stalin: {
    ...common,
    ...balanced(740, 15, 46, 1.5),
    side: 'left',
    name: 'Stalin',
    description: 'Tanque lento, resistente e de dano menor. Apoia o cerco.',
  },
  lulinha: {
    ...common,
    ...balanced(650, 18, 46, 1.4),
    side: 'left',
    name: 'Lula',
    description: 'Brigador resistente e lento. Protege a infantaria.',
  },
  trump: {
    ...common,
    ...balanced(600, 20, 62, 1.2),
    side: 'right',
    name: 'Trump',
    description:
      'Resistente, com maior alcance e dano menor. Fortalece o cerco e protege a infantaria.',
  },
  bolsonaro: {
    ...common,
    ...balanced(700, 17, 46, 1.3),
    side: 'right',
    name: 'Bolsonaro',
    description: 'Resistente e lento. Protege e fortalece a infantaria próxima.',
  },
  marcal: {
    ...common,
    ...balanced(470, 24, 50, 1.1),
    side: 'right',
    name: 'Pablo Marçal',
    description: 'Ofensivo e móvel. Usa uma cadeira em combate corpo a corpo e apoia o cerco.',
  },
} as const;
export type HeroKind = keyof typeof HEROES;
export const DEFAULT_HERO: Record<Side, HeroKind> = { left: 'jones', right: 'mamaefalei' };
export const MAX_HEROES = 3;
export function heroRoster(side: Side) {
  return (Object.keys(HEROES) as HeroKind[]).filter((kind) => HEROES[kind].side === side);
}
export function hasHeroArt(hero: HeroKind) {
  return hero !== 'jones';
}
export function heroIdentity(unit: Pick<Unit, 'hero' | 'side'>) {
  return unit.hero && Object.hasOwn(HEROES, unit.hero) ? unit.hero : DEFAULT_HERO[unit.side];
}
import { troopStats } from './production-catalog';

export function unitStats(unit: Pick<Unit, 'kind' | 'hero' | 'side' | 'productionTier'>) {
  return unit.kind === 'hero'
    ? HEROES[heroIdentity(unit)]
    : troopStats(unit.kind, unit.productionTier);
}
export function heroRecruitmentCooldown(player: Player, side: Side, hero: HeroKind) {
  return (
    player.heroCooldowns?.[hero] ?? (hero === DEFAULT_HERO[side] ? (player.heroCooldown ?? 0) : 0)
  );
}
export function trainingDuration(order: TrainingOrder) {
  return order.kind === 'worker'
    ? 5
    : order.kind === 'medic'
      ? 10
      : HEROES[order.hero ?? 'jones'].duration;
}
export function heroRecruitmentCost(player: Player, hero: HeroKind) {
  return (player.heroes?.length ?? 0) === 0 ? 0 : HEROES[hero].cost;
}
export function trainingCost(order: TrainingOrder) {
  return (
    order.cost ??
    (order.kind === 'worker'
      ? 120
      : order.kind === 'medic'
        ? 220
        : HEROES[order.hero ?? 'jones'].cost)
  );
}
