import {
  type BuildingKind,
  type GlobalPowerKind,
  type PromotionKind,
  type Side,
  type UnitKind,
} from './content';
import {
  type InvestmentContract,
  type InvestmentProduct,
  type LoanContract,
  type LoanProduct,
} from './finance';
import { type HeroRecord, type HeroRevival } from './hero-progression';
import { type HeroKind } from './heroes';
import { type ResearchJob, type ResearchKind } from './research';

import type { ProductionTier } from './production-catalog';

export interface PromotionOrder {
  kind: PromotionKind;
  progress: number;
}
export interface Building {
  productionTier?: ProductionTier;
  activeTier?: ProductionTier;
  investedCash?: number;
  medicQueue?: TrainingOrder[];
  promotionQueue?: PromotionOrder[];
  kind: BuildingKind;
  slot: number;
  level: number;
  progress: number;
  constructionProgress: number;
  completedCycles: number;
  lastYield?: number;
  populationReserved?: boolean;
  autoPaused?: boolean;
  upgrading?: boolean;
  upgradeProgress?: number;
}
export interface TrainingOrder {
  cost?: number;
  hero?: HeroKind;
  kind: 'worker' | 'hero' | 'medic';
  progress: number;
  populationReserved?: boolean;
}
export interface Player {
  heroes: HeroRecord[];
  heroRevivals: HeroRevival[];
  heroBirthSerial: number;
  heroCooldowns: Partial<Record<HeroKind, number>>;
  baseAttackLevel: number;
  baseAttackCooldown: number;
  baseAttackUpgrading: boolean;
  baseAttackUpgradeProgress: number;
  ownedPlots: number[];
  research: ResearchKind[];
  researchJobs: ResearchJob[];
  trainingQueue: TrainingOrder[];
  cash: number;
  popularity: number;
  unlockedPowers?: GlobalPowerKind[];
  powerCooldowns: Record<GlobalPowerKind, number>;
  workers: number;
  baseHp: number;
  loans: LoanContract[];
  investments: InvestmentContract[];
  taxRate: number;
  heroCooldown: number;
  buildings: Building[];
  kills: number;
}
export interface Unit {
  productionTier?: ProductionTier;
  healingCooldown?: number;
  healingTargetId?: number;
  healingLockUntil?: number;
  hero?: HeroKind;
  id: number;
  side: Side;
  kind: UnitKind;
  x: number;
  hp: number;
  maxHp: number;
  level: number;
  cooldown: number;
  attacking: boolean;
  row: number;
  silencedUntil: number;
  strengthUntil: number;
}
export interface CombatEvent {
  id: number;
  time: number;
  kind: 'melee' | 'ranged' | 'siege';
  side: Side;
  sourceId: number;
  sourceType?: 'unit' | 'base' | 'building';
  sourceSlot?: number;
  sourceX: number;
  sourceRow: number;
  targetX: number;
  targetRow: number;
  targetId: number;
  damage: number;
}
export interface PowerEvent {
  workerLoss?: number;
  kind: GlobalPowerKind;
  id: number;
  time: number;
  side: Side;
  targets: { id: number; x: number; row: number; kind: UnitKind }[];
}
export interface GameState {
  battlefield?: import('./battlefields').BattlefieldKind;
  time: number;
  status: 'waiting' | 'playing' | 'finished';
  winner: Side | 'draw' | null;
  players: Record<Side, Player>;
  units: Unit[];
  hits: CombatEvent[];
  powers: PowerEvent[];
  nextId: number;
  log: { id: number; text: string }[];
}
export type Command =
  | { type: 'medic'; slot: number }
  | { type: 'hero-revive'; hero: HeroKind; slot: number }
  | { type: 'demolish'; slot: number }
  | { type: 'buy-plot'; slot: number }
  | { type: 'build'; kind: BuildingKind; slot: number }
  | { type: 'upgrade'; slot: number }
  | { type: 'upgrade-batch'; kind: BuildingKind }
  | { type: 'worker' }
  | { type: 'hero'; hero?: HeroKind }
  | { type: 'loan'; product?: LoanProduct }
  | { type: 'invest'; product?: InvestmentProduct }
  | { type: 'repay'; id: number }
  | { type: 'redeem'; id: number }
  | { type: 'tax'; rate: number }
  | { type: 'tax'; delta: number }
  | { type: 'research'; slot: number; kind: ResearchKind }
  | { type: 'promote'; slot: number; kind: PromotionKind }
  | { type: 'select-production'; slot: number; tier: ProductionTier }
  | { type: 'auto-production'; slot: number; paused: boolean }
  | { type: 'power'; kind?: GlobalPowerKind };
