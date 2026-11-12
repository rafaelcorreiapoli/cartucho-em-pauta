import { isBuildingReady } from '../buildings';
import { FACTIONS, type Side } from '../content';
import { productionFactor } from '../finance';
import { addLog } from '../game-state';
import { MEDIC } from '../healing';
import type { Building, GameState } from '../model';
import { canStartProduction } from '../population';
import { unitTrainingMultiplier } from '../research';
import { spawnUnit } from '../units';

export function startHospitalOrder(game: GameState, side: Side, building: Building) {
  const order = building.medicQueue?.[0];
  if (
    !isBuildingReady(building) ||
    !order ||
    game.players[side].heroRevivals.some((job) => job.slot === building.slot)
  )
    return;
  if (!order.populationReserved && canStartProduction(game, side, 'medic'))
    order.populationReserved = true;
}
export function stepHospitals(game: GameState, side: Side, dt: number) {
  const player = game.players[side];
  for (const building of player.buildings) {
    if (building.kind !== 'hospital' || !isBuildingReady(building)) continue;
    startHospitalOrder(game, side, building);
    const order = building.medicQueue?.[0];
    if (!order?.populationReserved) continue;
    order.progress = Math.min(
      MEDIC.duration,
      order.progress + dt * productionFactor(player) * unitTrainingMultiplier(player, 'medic'),
    );
    if (order.progress + 1e-8 < MEDIC.duration) continue;
    if (!spawnUnit(game, side, 'medic', 1, true)) continue;
    building.medicQueue!.shift();
    building.completedCycles++;
    building.lastYield = 0;
    addLog(game, `${FACTIONS[side].units.medic} pronto para atender.`);
    startHospitalOrder(game, side, building);
  }
}
