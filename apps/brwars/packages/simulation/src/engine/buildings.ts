import { constructionSecondsRemaining, isBuildingReady, upgradeDuration } from '../buildings';
import { BUILDINGS, POPULARITY_CAP, PROMOTION_OFFERS, type Side } from '../content';
import { currentProduction } from '../production-catalog';
import { productionFactor } from '../finance';
import { addLog } from '../game-state';
import type { GameState } from '../model';
import { buildingInaugurationPopularity, isPopularityBuilding } from '../popularity';
import { constructionMultiplier } from '../research';
import { spawnUnit } from '../units';
import { automaticProductionSpeed, startAutomaticProduction } from './production';

export function stepBuildings(game: GameState, side: Side, dt: number, instant = false) {
  const p = game.players[side];
  for (const b of p.buildings) {
    if (b.upgrading) {
      b.upgradeProgress = Math.min(
        1,
        (b.upgradeProgress ?? 0) + (dt * constructionMultiplier(p)) / upgradeDuration(b),
      );
      if (instant || b.upgradeProgress >= 1 - 1e-8) {
        b.upgrading = false;
        b.upgradeProgress = 0;
        b.level++;
        addLog(game, `Melhoria concluída: nível ${b.level}.`);
      }
    }
    let productionTime = dt;
    if (!isBuildingReady(b)) {
      const remaining = instant ? 0 : constructionSecondsRemaining(b, p);
      if (remaining > dt + 1e-8) {
        b.constructionProgress +=
          (dt * constructionMultiplier(p)) / BUILDINGS[b.kind].constructionTime;
        continue;
      }
      b.constructionProgress = 1;
      if (isPopularityBuilding(b.kind)) {
        const gain = Math.min(POPULARITY_CAP - p.popularity, buildingInaugurationPopularity(p, b));
        p.popularity += gain;
        b.lastYield = gain;
        b.completedCycles++;
      }
      productionTime = Math.max(0, dt - remaining);
      addLog(
        game,
        `${side === 'left' ? 'Esquerda' : 'Direita'} concluiu uma construção. Produção iniciada.`,
      );
    }
    if (!BUILDINGS[b.kind].unit) {
      b.progress = 0;
      let remaining = productionTime * productionFactor(p);
      while (b.promotionQueue?.length && remaining > 0) {
        const order = b.promotionQueue[0],
          offer = PROMOTION_OFFERS[order.kind],
          spent = Math.min(remaining, offer.duration - order.progress);
        order.progress += spent;
        remaining -= spent;
        if (order.progress + 1e-8 < offer.duration) break;
        const gain = Math.min(offer.popularity, POPULARITY_CAP - p.popularity);
        p.popularity += gain;
        b.lastYield = gain;
        b.completedCycles++;
        b.promotionQueue.shift();
        addLog(game, `${offer.name}: +${gain.toFixed(0)} de popularidade.`);
      }
      continue;
    }
    if (!startAutomaticProduction(game, side, b)) {
      b.progress = 0;
      continue;
    }
    const spec = currentProduction(b)!;
    b.progress += productionTime * automaticProductionSpeed(p, spec.kind);
    if (
      b.progress + 1e-8 >= spec.duration &&
      spawnUnit(game, side, spec.kind, b.level, true, undefined, spec.tier)
    ) {
      b.populationReserved = false;
      b.progress = Math.max(0, b.progress - spec.duration);
      b.completedCycles = (b.completedCycles ?? 0) + 1;
      if (!startAutomaticProduction(game, side, b) || b.activeTier !== spec.tier) b.progress = 0;
    }
    b.progress = Math.min(b.progress, currentProduction(b)!.duration);
  }
}
