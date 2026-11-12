import {
  MAX_HERO_LEVEL,
  hasHeroArt,
  heroIdentity,
  type HeroKind,
  type ProductionTier,
  type Side,
  type Unit,
} from '@brwars/simulation';

export const healthColor = (fraction: number) =>
  fraction < 0.3 ? 0xed554c : fraction < 0.7 ? 0xf3ca43 : 0x71d46b;
export const unitRow = (kind: Unit['kind']) =>
  ({ medic: 0, front: 0, ranged: 1, siege: 2, hero: 3 })[kind];
export const VARIANT_CLASSES = ['front', 'ranged', 'siege'] as const;
export const VARIANT_WALK_FRAMES = 4;
export const VARIANT_FRAME_SIZE = 256;
export const PACKED_UNIT_FRAME_WIDTH = 480;
export const PACKED_LEGACY_FRAME_WIDTH = 240;
export const VARIANT_GROUND_ORIGIN = 244 / VARIANT_FRAME_SIZE;
export function variantTexture(side: Side, kind: Unit['kind'], tier?: ProductionTier) {
  if (!tier || kind === 'hero' || kind === 'medic') return undefined;
  return `variant-${side}-${kind}`;
}

export function variantWalkTexture(side: Side, kind: Unit['kind']) {
  if (kind === 'front' || kind === 'ranged') return `variant-${side}-${kind}-walk`;
  return undefined;
}

const troopScale = [1, 0.85, 1.08, 1.17] as const;
export const unitVisualHeight = (kind: Unit['kind'], level = 1, tier: ProductionTier = 0) =>
  (kind === 'siege' ? (tier ? 76 : 98) : (kind === 'hero' ? 109 : 77) * 0.5) *
  (kind === 'hero'
    ? 1 + 0.36 * ((Math.max(1, Math.min(MAX_HERO_LEVEL, level)) - 1) / (MAX_HERO_LEVEL - 1))
    : troopScale[tier]);
export function animationKey(
  side: Side,
  kind: Unit['kind'],
  state: string,
  hero?: HeroKind,
  tier?: ProductionTier,
) {
  const texture = variantTexture(side, kind, tier);
  if (texture) return `${texture}-${tier}-${state}`;
  return kind === 'medic'
    ? `${side}-medic-${state}`
    : hero && hasHeroArt(hero)
      ? `hero-${hero}-${state}`
      : `${side}-${kind}-${state}`;
}
export function unitFrameStart(unit: Unit) {
  if (unit.productionTier && variantTexture(unit.side, unit.kind, unit.productionTier))
    return (unit.productionTier - 1) * 3;
  return unit.kind === 'medic' || (unit.side === 'left' && unit.kind === 'ranged')
    ? 0
    : unit.kind === 'hero' && hasHeroArt(heroIdentity(unit))
      ? 0
      : unitRow(unit.kind) * 8;
}
