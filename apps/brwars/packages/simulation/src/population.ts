import { housingCapacity } from './buildings';
import {
  BASE_POPULATION_CAP,
  MAX_POPULATION,
  POPULATION_COST,
  type Side,
  type UnitKind,
} from './content';
import type { GameState, Player } from './model';

import { currentProduction, troopPopulation, type ProductionTier } from './production-catalog';

export function populationCapacity(player: Player) {
  return Math.min(
    MAX_POPULATION,
    BASE_POPULATION_CAP + player.buildings.reduce((sum, b) => sum + housingCapacity(b), 0),
  );
}
export function populationUsed(game: GameState, side: Side) {
  const p = game.players[side];
  return (
    p.workers +
    (p.heroRevivals ?? []).reduce((sum, job) => sum + (job.populationReserved ? 3 : 0), 0) +
    game.units
      .filter((u) => u.side === side)
      .reduce((sum, u) => sum + troopPopulation(u.kind, u.productionTier), 0) +
    (p.trainingQueue ?? []).reduce(
      (sum, o) => sum + (o.populationReserved ? POPULATION_COST[o.kind] : 0),
      0,
    ) +
    p.buildings.reduce(
      (sum, b) =>
        sum +
        (b.medicQueue ?? []).reduce(
          (n, order) => n + (order.populationReserved ? POPULATION_COST.medic : 0),
          0,
        ) +
        (b.populationReserved ? (currentProduction(b)?.population ?? 0) : 0),
      0,
    )
  );
}
export function canStartProduction(
  game: GameState,
  side: Side,
  kind: UnitKind | 'worker',
  tier?: ProductionTier,
) {
  return (
    populationUsed(game, side) +
      (kind === 'worker' ? POPULATION_COST.worker : troopPopulation(kind, tier)) <=
    populationCapacity(game.players[side])
  );
}
export const workerCapacity = populationCapacity;
