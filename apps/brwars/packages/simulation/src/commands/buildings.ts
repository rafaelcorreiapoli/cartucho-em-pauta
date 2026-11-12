import {
  demolitionRefund,
  buildingInvestment,
  buildingUpgradeBatches,
  buildingUpgradeCost,
  canUpgradeBuilding,
  isBuildingReady,
  missingBuildingRequirements,
  ownsPlot,
} from '../buildings';
import {
  BASE_QUEUE_LIMIT,
  BUILDINGS,
  FACTIONS,
  MAX_BUILDING_LEVEL,
  PLOT_COST,
  POPULARITY_CAP,
  PROMOTION_OFFERS,
  type BuildingKind,
  type PromotionKind,
  type Side,
} from '../content';
import { battlefieldLayout } from '../battlefields';
import { addLog } from '../game-state';
import { heroRecord } from '../hero-progression';
import type { Building, GameState, Player } from '../model';

import { PRODUCTION_TIERS, TIER_LEVEL } from '../production-catalog';

function startBuildingUpgrade(player: Player, building: Building) {
  const cost = buildingUpgradeCost(building);
  player.cash -= cost;
  building.investedCash = buildingInvestment(building) + cost;
  building.upgrading = true;
  building.upgradeProgress = 0;
}

export function executeBuildingCommand(
  game: GameState,
  side: Side,
  command: Record<string, unknown>,
): string | null {
  const p = game.players[side];
  const plots = battlefieldLayout(game.battlefield).plots[side];
  switch (command.type) {
    case 'demolish': {
      if (!plots.some(({ slot }) => slot === command.slot)) return 'Terreno inválido.';
      const index = p.buildings.findIndex((b) => b.slot === command.slot);
      if (index < 0) return 'Nenhuma construção sua neste terreno.';
      const building = p.buildings[index],
        refund = demolitionRefund(building);
      p.cash += refund;
      p.buildings.splice(index, 1);
      for (const job of p.heroRevivals.filter((job) => job.slot === building.slot))
        heroRecord(p, job.hero)!.status = 'dead';
      p.heroRevivals = p.heroRevivals.filter((job) => job.slot !== building.slot);
      p.researchJobs = (p.researchJobs ?? []).filter((job) => job.slot !== building.slot);
      addLog(game, `Estrutura demolida. Recuperados R$ ${refund}.`);
      return null;
    }
    case 'buy-plot': {
      if (!plots.some(({ slot }) => slot === command.slot)) return 'Terreno inválido.';
      const slot = command.slot as number;
      if (ownsPlot(p, slot) || p.buildings.some((b) => b.slot === slot))
        return 'Esse terreno já foi adquirido.';
      if (p.cash < PLOT_COST) return 'R$ insuficientes para adquirir o terreno.';
      p.cash -= PLOT_COST;
      p.ownedPlots ??= plots.filter((plot) => plot.owned).map((plot) => plot.slot);
      p.ownedPlots.push(slot);
      addLog(game, `${side === 'left' ? 'Esquerda' : 'Direita'} adquiriu um terreno.`);
      return null;
    }
    case 'build': {
      if (typeof command.kind !== 'string' || !Object.hasOwn(BUILDINGS, command.kind))
        return 'Construção inválida.';
      if (!plots.some(({ slot }) => slot === command.slot)) return 'Terreno inválido.';
      if (p.buildings.some((b) => b.slot === command.slot)) return 'Esse terreno já está ocupado.';
      if (!ownsPlot(p, command.slot as number)) return 'Adquira este terreno antes de construir.';
      const kind = command.kind as BuildingKind;
      if (p.cash < BUILDINGS[kind].cost) return 'R$ insuficientes.';
      const missing = missingBuildingRequirements(p, kind);
      if (missing.length)
        return `Conclua primeiro: ${missing.map((required) => FACTIONS[side].buildings[required]).join(', ')}.`;
      p.cash -= BUILDINGS[kind].cost;
      p.buildings.push({
        kind,
        investedCash: BUILDINGS[kind].cost,
        slot: command.slot as number,
        level: 1,
        progress: 0,
        constructionProgress: 0,
        completedCycles: 0,
      });
      addLog(game, `${side === 'left' ? 'Esquerda' : 'Direita'} iniciou uma construção.`);
      return null;
    }
    case 'upgrade': {
      const building = p.buildings.find((b) => b.slot === command.slot);
      if (!building || !canUpgradeBuilding(building.kind) || building.level >= MAX_BUILDING_LEVEL)
        return 'Melhoria indisponível.';
      if (!isBuildingReady(building)) return 'A estrutura ainda está em construção.';
      if (building.upgrading) return 'Melhoria já em andamento.';
      if (p.cash < buildingUpgradeCost(building)) return 'R$ insuficientes.';
      startBuildingUpgrade(p, building);
      return null;
    }
    case 'upgrade-batch': {
      // An older client may still display and send a specific level.
      const level = command.level;
      if (level !== undefined && (typeof level !== 'number' || !Number.isInteger(level)))
        return 'Nível inválido.';
      const batch = buildingUpgradeBatches(p, level).find(({ kind }) => kind === command.kind);
      if (!batch) return 'É preciso poder melhorar ao menos duas construções desse tipo.';
      for (const building of batch.buildings) startBuildingUpgrade(p, building);
      return null;
    }
    case 'promote': {
      if (!Number.isInteger(command.slot)) return 'Terreno inválido.';
      const building = p.buildings.find((item) => item.slot === command.slot);
      if (!building || building.kind !== 'civic' || !isBuildingReady(building))
        return 'Selecione uma Feira ou Estádio concluído.';
      if (typeof command.kind !== 'string' || !Object.hasOwn(PROMOTION_OFFERS, command.kind))
        return 'Evento inválido.';
      const offer = PROMOTION_OFFERS[command.kind as PromotionKind];
      building.promotionQueue ??= [];
      if (building.promotionQueue.length >= BASE_QUEUE_LIMIT) return 'Fila de eventos cheia.';
      if (p.cash < offer.cash) return 'R$ insuficientes.';
      if (p.popularity + offer.popularity > POPULARITY_CAP + 1e-8)
        return 'O ganho ultrapassa o limite de popularidade.';
      p.cash -= offer.cash;
      building.promotionQueue.push({ kind: command.kind as PromotionKind, progress: 0 });
      addLog(game, `${offer.name} entrou na fila de eventos.`);
      return null;
    }
    case 'select-production': {
      const building = p.buildings.find((b) => b.slot === command.slot);
      const tier = PRODUCTION_TIERS.find((value) => value === command.tier);
      if (
        !building ||
        !isBuildingReady(building) ||
        !BUILDINGS[building.kind].unit ||
        tier === undefined
      )
        return 'Produção inválida.';
      if (building.level < TIER_LEVEL[tier]) return 'Melhore o prédio para liberar esta tropa.';
      building.productionTier = tier;
      return null;
    }
    case 'auto-production': {
      if (!Number.isInteger(command.slot) || typeof command.paused !== 'boolean')
        return 'Comando de produção inválido.';
      const building = p.buildings.find((b) => b.slot === command.slot);
      if (!building || !isBuildingReady(building) || !BUILDINGS[building.kind].unit)
        return 'Selecione uma estrutura com produção automática concluída.';
      building.autoPaused = command.paused;
      return null;
    }
    default:
      return 'Comando desconhecido.';
  }
}
