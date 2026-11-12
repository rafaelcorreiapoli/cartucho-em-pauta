import { unemploymentPopularityRate } from './employment';
import { BUILDINGS, POPULARITY_CAP, type BuildingKind } from './content';
import type { Building, Player } from './model';
export const POPULARITY_MIN = -200;
/** Tax rates are percentage points: 10% is neutral, high taxes erode stability faster. */
export function taxPopularityRate(player: Player) {
  const delta = (player.taxRate ?? 10) - 10;
  return delta > 0 ? -delta * 0.15 : -delta * 0.05;
}
export const POPULARITY_DUPLICATE_FACTOR = 0.35;
export function isPopularityBuilding(kind: BuildingKind) {
  return BUILDINGS[kind].popularityYield > 0;
}
export function civicPopularityRate(building: Building) {
  const spec = BUILDINGS[building.kind];
  return spec.popularityYield > 0 ? (spec.popularityRate ?? 0) : 0;
}
/** Stronger buildings get priority; adding a weaker duplicate never reduces total yield. */
export function popularityContributions(player: Player) {
  const counts = new Map<BuildingKind, number>();
  return player.buildings
    .filter((b) => isPopularityBuilding(b.kind) && (b.constructionProgress ?? 1) >= 1)
    .slice()
    .sort((a, b) => civicPopularityRate(b) - civicPopularityRate(a) || a.slot - b.slot)
    .map((building) => {
      const rank = counts.get(building.kind) ?? 0;
      counts.set(building.kind, rank + 1);
      const efficiency = POPULARITY_DUPLICATE_FACTOR ** rank;
      return {
        slot: building.slot,
        kind: building.kind,
        efficiency,
        rate: civicPopularityRate(building) * efficiency,
      };
    });
}
export function effectiveBuildingPopularityRate(player: Player, building: Building) {
  return popularityContributions(player).find((entry) => entry.slot === building.slot)?.rate ?? 0;
}
export function nextPopularityBuildingRate(player: Player, kind: BuildingKind) {
  const count = popularityContributions(player).filter((entry) => entry.kind === kind).length;
  return civicPopularityRate({ kind, level: 1 } as Building) * POPULARITY_DUPLICATE_FACTOR ** count;
}
export function popularityRate(player: Player) {
  return (
    taxPopularityRate(player) +
    unemploymentPopularityRate(player) +
    popularityContributions(player).reduce((sum, entry) => sum + entry.rate, 0)
  );
}
export function popularityCrisis(player: Player) {
  const unrest = Math.max(0, Math.min(1, -(player.popularity ?? 0) / 200));
  return {
    workerProductivity: 1 - 0.6 * unrest,
    production: 1 - 0.25 * Math.max(0, (unrest - 0.5) * 2),
    label:
      unrest >= 0.75
        ? 'Greve geral'
        : unrest > 0.5
          ? 'Crise social'
          : unrest > 0
            ? 'Insatisfação'
            : 'Estável',
  };
}
export function clampPopularity(value: number) {
  return Math.max(POPULARITY_MIN, Math.min(POPULARITY_CAP, value));
}

export function buildingInaugurationPopularity(player: Player, building: Building) {
  const efficiency =
    popularityContributions(player).find((entry) => entry.slot === building.slot)?.efficiency ?? 0;
  return BUILDINGS[building.kind].popularityYield * efficiency;
}
