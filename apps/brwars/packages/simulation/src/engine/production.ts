import { FACTIONS } from '../content';
import { isBuildingReady } from '../buildings';
import { type Side } from '../content';
import { productionFactor } from '../finance';
import { addLog } from '../game-state';
import { heroRecord } from '../hero-progression';
import { DEFAULT_HERO, HEROES, trainingDuration } from '../heroes';
import type { Building, GameState } from '../model';
import { canStartProduction } from '../population';
import { logisticsMultiplier, productionSpec } from '../production-catalog';
import { unitTrainingMultiplier } from '../research';
import { spawnUnit } from '../units';

export function startOrder(game: GameState, side: Side) {
  const order = game.players[side].trainingQueue[0];
  if (order && !order.populationReserved && canStartProduction(game, side, order.kind))
    order.populationReserved = true;
}
export function startAutomaticProduction(game: GameState, side: Side, building: Building) {
  const spec = productionSpec(building, building.productionTier);
  if (building.populationReserved) return true;
  if (!spec || building.autoPaused || !isBuildingReady(building)) return false;
  if (productionBlockers(game, side, building).length) return false;
  game.players[side].cash = Math.max(0, game.players[side].cash - spec.cost);
  building.activeTier = spec.tier;
  building.populationReserved = true;
  return true;
}
export function productionBlockers(
  game: GameState,
  side: Side,
  building: Building,
): ('population' | 'cash')[] {
  const spec = productionSpec(building, building.productionTier);
  if (!spec || building.populationReserved || building.autoPaused || !isBuildingReady(building))
    return [];
  const reasons: ('population' | 'cash')[] = [];
  if (!canStartProduction(game, side, spec.kind, spec.tier)) reasons.push('population');
  if (game.players[side].cash + 1e-8 < spec.cost) reasons.push('cash');
  return reasons;
}

export function automaticProductionSpeed(
  player: GameState['players'][Side],
  kind: NonNullable<ReturnType<typeof productionSpec>>['kind'],
) {
  return (
    productionFactor(player) * unitTrainingMultiplier(player, kind) * logisticsMultiplier(player)
  );
}

export function stepRecruitment(game: GameState, side: Side, dt: number) {
  const p = game.players[side];
  p.trainingQueue ??= [];
  startOrder(game, side);
  const order = p.trainingQueue[0];
  if (order?.populationReserved) {
    order.progress = Math.min(
      trainingDuration(order),
      order.progress + dt * productionFactor(p) * unitTrainingMultiplier(p, order.kind),
    );
    if (order.progress + 1e-8 >= trainingDuration(order)) {
      const completed =
        order.kind === 'worker'
          ? true
          : spawnUnit(game, side, order.kind, 1, true, order.hero ?? DEFAULT_HERO[side]);
      if (completed) {
        if (order.kind === 'worker') p.workers++;
        else if (order.kind === 'hero') {
          const hero = order.hero ?? DEFAULT_HERO[side];
          p.heroCooldowns ??= {};
          p.heroCooldowns[hero] = HEROES[hero].cooldown;
          if (hero === DEFAULT_HERO[side]) p.heroCooldown = HEROES[hero].cooldown;
          p.heroBirthSerial = (p.heroBirthSerial ?? 0) + 1;
        }
        p.trainingQueue.shift();
        startOrder(game, side);
        addLog(
          game,
          order.kind === 'worker'
            ? 'Um trabalhador concluiu o treinamento.'
            : order.kind === 'medic'
              ? `${FACTIONS[side].units.medic} pronto para atender.`
              : 'Um herói entrou em combate!',
        );
      }
    }
  }
  for (const job of p.heroRevivals) {
    if (!job.populationReserved && canStartProduction(game, side, 'hero'))
      job.populationReserved = true;
    if (!job.populationReserved) continue;
    job.progress = Math.min(
      job.duration,
      job.progress + dt * productionFactor(p) * unitTrainingMultiplier(p, 'hero'),
    );
    if (job.progress + 1e-8 >= job.duration) {
      job.populationReserved = false;
      const record = heroRecord(p, job.hero)!;
      if (spawnUnit(game, side, 'hero', record.level, true, job.hero)) {
        record.revivals++;
        p.heroBirthSerial++;
        const hospital = p.buildings.find((b) => b.slot === job.slot);
        if (hospital) {
          hospital.completedCycles++;
          hospital.lastYield = 0;
        }
        addLog(game, `${HEROES[job.hero].name} voltou do Hospital no nível ${record.level}.`);
      }
    }
  }
  p.heroRevivals = p.heroRevivals.filter((job) => job.progress + 1e-8 < job.duration);
}
