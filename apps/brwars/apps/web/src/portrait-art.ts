import {
  DEFAULT_HERO,
  HEROES,
  type HeroKind,
  type ProductionTier,
  type Side,
  type UnitKind,
} from '@brwars/simulation';
export const UNIT_PORTRAIT_FILES = [
  'portraits-heroes-left.png',
  'portraits-heroes-right.png',
  'portraits-support.png',
  'portraits-troops.png',
  'portraits-variants-left.webp',
  'portraits-variants-right.webp',
  'portrait-guardiao.webp',
];
const heroFrames: Record<HeroKind, number> = {
  jones: 0,
  che: 1,
  stalin: 2,
  lulinha: 3,
  mamaefalei: 0,
  trump: 1,
  bolsonaro: 2,
  marcal: 3,
};
export function portraitArt(
  side: Side,
  kind: UnitKind | 'worker',
  hero?: HeroKind,
  tier: ProductionTier = 0,
) {
  if (kind === 'hero') {
    const identity = hero ?? DEFAULT_HERO[side];
    return {
      file: `portraits-heroes-${HEROES[identity].side}.png`,
      columns: 2,
      rows: 2,
      frame: heroFrames[identity],
    };
  }
  if (kind === 'worker' || kind === 'medic')
    return {
      file: 'portraits-support.png',
      columns: 2,
      rows: 2,
      frame: (kind === 'medic' ? 2 : 0) + (side === 'right' ? 1 : 0),
    };
  if (side === 'left' && kind === 'ranged' && tier === 2)
    return { file: 'portrait-guardiao.webp', columns: 1, rows: 1, frame: 0 };
  if (tier)
    return {
      file: `portraits-variants-${side}.webp`,
      columns: 3,
      rows: 3,
      frame: { front: 0, ranged: 1, siege: 2 }[kind] * 3 + tier - 1,
    };
  return {
    file: 'portraits-troops.png',
    columns: 3,
    rows: 2,
    frame: { front: 0, ranged: 1, siege: 2 }[kind] + (side === 'right' ? 3 : 0),
  };
}
