import {
  DEFAULT_HERO,
  FACTIONS,
  HEROES,
  troopName,
  type ProductionTier,
  type HeroKind,
  type Side,
  type UnitKind,
} from '@brwars/simulation';
import { portraitArt } from './portrait-art';
export function UnitPortrait({
  side,
  kind,
  hero,
  tier = 0,
}: {
  side: Side;
  kind: UnitKind | 'worker';
  hero?: HeroKind;
  tier?: ProductionTier;
}) {
  const art = portraitArt(side, kind, hero, tier),
    size = 512;
  const name =
    kind === 'hero'
      ? HEROES[hero ?? DEFAULT_HERO[side]].name
      : kind === 'worker'
        ? FACTIONS[side].worker
        : troopName(side, kind, tier);
  return (
    <svg
      className="unit-portrait-image"
      viewBox={`${(art.frame % art.columns) * size} ${Math.floor(art.frame / art.columns) * size} ${size} ${size}`}
      preserveAspectRatio="xMidYMid slice"
      role="img"
      aria-label={`Portrait ${name}`}
    >
      <image
        href={`${import.meta.env.BASE_URL}assets/${art.file}`}
        preserveAspectRatio="none"
        width={art.columns * size}
        height={art.rows * size}
      />
    </svg>
  );
}
