import {
  BUILDINGS,
  BUILDING_REQUIREMENTS,
  INITIAL_PLOTS,
  MAX_BUILDING_LEVEL,
  type BuildingKind,
} from './content';
import type { Building, Player } from './model';
import { constructionMultiplier } from './research';

export function ownsPlot(player: Player, slot: number) {
  return (player.ownedPlots ?? INITIAL_PLOTS).includes(slot);
}
export function isBuildingReady(building: Building) {
  return (building.constructionProgress ?? 1) >= 1;
}
export function missingBuildingRequirements(player: Player, kind: BuildingKind) {
  return (BUILDING_REQUIREMENTS[kind] ?? []).filter(
    (required) =>
      !player.buildings.some((building) => building.kind === required && isBuildingReady(building)),
  );
}
export function constructionSecondsRemaining(building: Building, player?: Player) {
  return Math.max(
    0,
    ((1 - (building.constructionProgress ?? 1)) * BUILDINGS[building.kind].constructionTime) /
      (player ? constructionMultiplier(player) : 1),
  );
}
export function upgradeDuration(building: Building) {
  return 8 + building.level * 2;
}
export function upgradeSecondsRemaining(building: Building, player: Player) {
  return building.upgrading
    ? Math.max(
        0,
        ((1 - (building.upgradeProgress ?? 0)) * upgradeDuration(building)) /
          constructionMultiplier(player),
      )
    : 0;
}
export function canUpgradeBuilding(kind: BuildingKind) {
  return BUILDINGS[kind].unit !== null || kind === 'housing' || kind === 'workplace';
}
export function buildingUpgradeCost({
  level,
  kind,
}: Pick<Building, 'level'> & Partial<Pick<Building, 'kind'>>) {
  const cost =
    kind && BUILDINGS[kind].unit && level > 5
      ? 160 * 1.65 ** 4 * 1.22 ** (level - 5)
      : 160 * 1.65 ** (level - 1);
  return Math.round(cost / 10) * 10;
}
export function buildingUpgradeBatches(player: Player, onlyLevel?: number) {
  const groups = new Map<BuildingKind, Building[]>();
  for (const building of player.buildings) {
    const { kind, level } = building;
    if (
      !canUpgradeBuilding(kind) ||
      level >= MAX_BUILDING_LEVEL ||
      (onlyLevel !== undefined && level !== onlyLevel) ||
      building.upgrading ||
      !isBuildingReady(building)
    )
      continue;
    const group = groups.get(kind) ?? [];
    group.push(building);
    groups.set(kind, group);
  }
  return Array.from(groups, ([kind, candidates]) => {
    candidates.sort((a, b) => a.level - b.level || a.slot - b.slot);
    const buildings: Building[] = [];
    let totalCost = 0;
    for (const building of candidates) {
      const cost = buildingUpgradeCost(building);
      if (totalCost + cost > player.cash) break;
      buildings.push(building);
      totalCost += cost;
    }
    return { kind, buildings, totalCost };
  }).filter(({ buildings }) => buildings.length >= 2);
}
export function buildingInvestment(building: Building) {
  if (building.investedCash !== undefined) return building.investedCash;
  // Existing matches without a ledger used the original linear upgrade prices.
  return (
    BUILDINGS[building.kind].cost +
    80 * building.level * (building.level - 1) +
    (building.upgrading ? 160 * building.level : 0)
  );
}
export function demolitionRefund(building: Building) {
  return buildingInvestment(building) * 0.5;
}
export function housingCapacity(building: Building) {
  return building.kind === 'housing' && isBuildingReady(building)
    ? 6 + (building.level - 1) * 2
    : 0;
}
