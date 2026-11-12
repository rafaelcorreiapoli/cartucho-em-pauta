import { isBuildingReady, type Player } from '@brwars/simulation';
/** Prefer a free completed hospital; keep the reason visible when recovery is unavailable. */
export function recoveryHospital(player: Player, slot?: number) {
  const hospitals = player.buildings.filter(
    (building) =>
      building.kind === 'hospital' &&
      isBuildingReady(building) &&
      (slot === undefined || building.slot === slot),
  );
  const hospital = hospitals.find(
    (building) =>
      !building.medicQueue?.length &&
      !player.heroRevivals?.some((job) => job.slot === building.slot),
  );
  return {
    hospital,
    reason: hospital ? '' : hospitals.length ? 'Hospitais ocupados' : 'Requer Hospital concluído',
  };
}
