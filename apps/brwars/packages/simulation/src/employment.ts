import type { BuildingKind } from './content';
import type { Building, Player } from './model';

export const BASE_JOBS = 6;
const JOBS: Record<BuildingKind, number> = {
  barracks: 0,
  media: 0,
  garage: 0,
  civic: 1,
  housing: 0,
  bank: 1,
  academy: 1,
  school: 1,
  hospital: 1,
  workplace: 12,
  park: 0,
  depot: 0,
};
/** Completed levels provide jobs; pending construction and upgrades provide none yet. */
export function buildingJobCapacity(building: Building) {
  if ((building.constructionProgress ?? 1) < 1) return 0;
  const base = JOBS[building.kind];
  return base + (building.kind === 'workplace' ? (building.level - 1) * 4 : 0);
}
/** Jobs exist only while the building actually runs its service or production. */
export function isBuildingWorking(building: Building, player: Player) {
  if ((building.constructionProgress ?? 1) < 1) return false;
  if (building.kind === 'workplace') return true;
  if (building.kind === 'school' || building.kind === 'academy')
    return (player.researchJobs ?? []).some((job) => job.slot === building.slot);
  if (building.kind === 'civic') return Boolean(building.promotionQueue?.length);
  if (building.kind === 'hospital')
    return (
      Boolean(building.medicQueue?.[0]?.populationReserved) ||
      (player.heroRevivals ?? []).some(
        (job) => job.slot === building.slot && job.populationReserved,
      )
    );
  if (building.kind === 'bank') {
    if (!(player.loans?.some((loan) => loan.remaining > 0) || player.investments?.length))
      return false;
    const serviceBank = player.buildings
      .filter((item) => item.kind === 'bank' && (item.constructionProgress ?? 1) >= 1)
      .sort((a, b) => b.level - a.level || a.slot - b.slot)[0];
    return serviceBank?.slot === building.slot;
  }
  // Pausing automatic production lets the already-paid current order finish.
  return Boolean(building.populationReserved);
}
export function buildingJobs(building: Building, player: Player) {
  return isBuildingWorking(building, player) ? buildingJobCapacity(building) : 0;
}
export function employment(player: Player) {
  const jobs =
    BASE_JOBS +
    player.buildings.reduce((total, building) => total + buildingJobs(building, player), 0);
  const employed = Math.min(player.workers, jobs);
  return {
    jobs,
    employed,
    unemployed: player.workers - employed,
    vacancies: Math.max(0, jobs - employed),
  };
}

/** Fraction of workers without a job, independent of population or vacant posts. */
export function unemploymentRate(player: Player) {
  return player.workers > 0 ? employment(player).unemployed / player.workers : 0;
}
export const MAX_UNEMPLOYMENT_POPULARITY_LOSS = 3;
export function unemploymentPopularityRate(player: Player) {
  return -MAX_UNEMPLOYMENT_POPULARITY_LOSS * unemploymentRate(player);
}
