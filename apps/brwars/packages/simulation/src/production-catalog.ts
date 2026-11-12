import {
  BUILDINGS,
  FACTIONS,
  POPULATION_COST,
  UNITS,
  UNIT_PRODUCTION_COST,
  type Side,
  type UnitKind,
} from './content';
import type { Building, Player } from './model';

type TroopClass = 'front' | 'ranged' | 'siege';
export const PRODUCTION_TIERS = [0, 1, 2, 3] as const;
export type ProductionTier = (typeof PRODUCTION_TIERS)[number];
export const TIER_LEVEL = [1, 5, 10, 15] as const;

type TroopVariant = {
  names: Record<Side, string>;
  cost: number;
  population: number;
  duration: number;
  stats: (typeof UNITS)[UnitKind];
};

const variants: Record<TroopClass, readonly [TroopVariant, TroopVariant, TroopVariant]> = {
  front: [
    {
      names: { left: 'Piquete Express', right: 'Estagiário Sem Direitos' },
      cost: 25,
      population: 1,
      duration: 3.5,
      stats: { hp: 75, damage: 11, range: 23, speed: 34, interval: 0.9 },
    },
    {
      names: { left: 'Tropa do Tratoraço', right: 'Segurança da Faria Lima' },
      cost: 95,
      population: 2,
      duration: 10,
      stats: { hp: 305, damage: 24, range: 25, speed: 17, interval: 1.25 },
    },
    {
      names: { left: 'Marechal do Piquete', right: 'CEO de Combate' },
      cost: 155,
      population: 2,
      duration: 13,
      stats: { hp: 250, damage: 48, range: 28, speed: 26, interval: 0.95 },
    },
  ],
  ranged: [
    {
      names: { left: 'Panfleteira de Semáforo', right: 'Spamzeiro do Zap' },
      cost: 35,
      population: 1,
      duration: 4.5,
      stats: { hp: 46, damage: 13, range: 85, speed: 24, interval: 1.05 },
    },
    {
      names: { left: 'Guardião da Demarcação', right: 'Coach de Mira' },
      cost: 115,
      population: 2,
      duration: 13,
      stats: { hp: 85, damage: 49, range: 165, speed: 15, interval: 2.2 },
    },
    {
      names: { left: 'Locutor do Palanque', right: 'General do Zap' },
      cost: 175,
      population: 2,
      duration: 15,
      stats: { hp: 135, damage: 31, range: 125, speed: 19, interval: 0.75 },
    },
  ],
  siege: [
    {
      names: { left: 'Motossom da Greve', right: 'Carretinha do Pix' },
      cost: 65,
      population: 1,
      duration: 7,
      stats: { hp: 82, damage: 19, range: 65, speed: 25, interval: 2 },
    },
    {
      names: { left: 'Trio da Greve Geral', right: 'Trio do CNPJ' },
      cost: 195,
      population: 3,
      duration: 19,
      stats: { hp: 210, damage: 78, range: 140, speed: 11, interval: 3.1 },
    },
    {
      names: { left: 'Tanque da Reforma Agrária', right: 'Caveirão da Havan' },
      cost: 300,
      population: 4,
      duration: 24,
      stats: { hp: 430, damage: 110, range: 105, speed: 9, interval: 2.7 },
    },
  ],
};

function troopVariant(kind: UnitKind, tier: ProductionTier = 0) {
  if (!tier || kind === 'hero' || kind === 'medic') return undefined;
  return variants[kind][tier - 1];
}

export function troopName(side: Side, kind: UnitKind, tier?: ProductionTier) {
  return troopVariant(kind, tier)?.names[side] ?? FACTIONS[side].units[kind];
}

export function troopStats(kind: UnitKind, tier?: ProductionTier) {
  return troopVariant(kind, tier)?.stats ?? UNITS[kind];
}

export function troopPopulation(kind: UnitKind, tier?: ProductionTier) {
  return troopVariant(kind, tier)?.population ?? POPULATION_COST[kind];
}

export function productionSpec(building: Pick<Building, 'kind'>, tier: ProductionTier = 0) {
  const { unit: kind, interval } = BUILDINGS[building.kind];
  if (!kind) return null;
  const variant = troopVariant(kind, tier);
  return {
    kind,
    tier,
    duration: variant?.duration ?? interval,
    cost: variant?.cost ?? UNIT_PRODUCTION_COST[kind],
    population: troopPopulation(kind, tier),
    stats: troopStats(kind, tier),
  };
}

export function currentProduction(building: Building) {
  return productionSpec(
    building,
    building.populationReserved ? building.activeTier : building.productionTier,
  );
}

export function logisticsMultiplier(player: Player) {
  const depots = player.buildings.filter(
    (b) => b.kind === 'depot' && (b.constructionProgress ?? 1) >= 1,
  ).length;
  return 1 + (depots > 0 ? 0.15 : 0) + (depots > 1 ? 0.08 : 0);
}
