import { buildingInvestment, type GameState } from '@brwars/simulation';
import { schema, t, type SchemaType } from '@colyseus/schema';
const PromotionState = schema({
  kind: t.string().default('local'),
  progress: t.number().default(0),
});
const TrainingState = schema({
  cost: t.number().default(0),
  hero: t.string().default(''),
  populationReserved: t.boolean().default(false),
  kind: t.string().default('worker'),
  progress: t.number().default(0),
});
const BuildingState = schema({
  productionTier: t.number().default(0),
  activeTier: t.number().default(0),
  medicQueue: t.array(TrainingState),
  investedCash: t.number().default(0),
  promotionQueue: t.array(PromotionState),
  upgrading: t.boolean().default(false),
  upgradeProgress: t.number().default(0),
  autoPaused: t.boolean().default(false),
  populationReserved: t.boolean().default(false),
  kind: t.string().default(''),
  slot: t.number().default(0),
  level: t.number().default(1),
  progress: t.number().default(0),
  constructionProgress: t.number().default(1),
  completedCycles: t.number().default(0),
  lastYield: t.number().default(0),
});
const LoanState = schema({
  id: t.number().default(0),
  product: t.string().default(''),
  principal: t.number().default(0),
  total: t.number().default(0),
  remaining: t.number().default(0),
  duration: t.number().default(0),
  elapsed: t.number().default(0),
  rate: t.number().default(0),
});
const InvestmentState = schema({
  id: t.number().default(0),
  product: t.string().default(''),
  principal: t.number().default(0),
  total: t.number().default(0),
  duration: t.number().default(0),
  elapsed: t.number().default(0),
});
const ResearchJobState = schema({
  level: t.number().default(1),
  duration: t.number().default(0),
  kind: t.string().default(''),
  slot: t.number().default(0),
  progress: t.number().default(0),
});
const HeroRecordState = schema({
  hero: t.string().default(''),
  level: t.number().default(1),
  xp: t.number().default(0),
  revivals: t.number().default(0),
  status: t.string().default('training'),
});
const HeroRevivalState = schema({
  hero: t.string().default(''),
  slot: t.number().default(0),
  progress: t.number().default(0),
  duration: t.number().default(8),
  cost: t.number().default(0),
  populationReserved: t.boolean().default(false),
});
const PlayerState = schema({
  heroes: t.array(HeroRecordState),
  heroRevivals: t.array(HeroRevivalState),
  heroBirthSerial: t.number().default(0),
  heroCooldowns: t.map('number'),
  baseAttackLevel: t.number().default(1),
  baseAttackCooldown: t.number().default(0),
  baseAttackUpgrading: t.boolean().default(false),
  baseAttackUpgradeProgress: t.number().default(0),
  ownedPlots: t.array('number'),
  research: t.array('string'),
  researchJobs: t.array(ResearchJobState),
  loans: t.array(LoanState),
  investments: t.array(InvestmentState),
  taxRate: t.number().default(10),
  trainingQueue: t.array(TrainingState),
  cash: t.number().default(0),
  popularity: t.number().default(0),
  powerCooldowns: t.map('number'),
  unlockedPowers: t.array('string'),
  workers: t.number().default(0),
  baseHp: t.number().default(0),
  heroCooldown: t.number().default(0),
  kills: t.number().default(0),
  buildings: t.array(BuildingState),
});
const UnitState = schema({
  productionTier: t.number().default(0),
  healingCooldown: t.number().default(1),
  healingTargetId: t.number().default(0),
  healingLockUntil: t.number().default(0),
  hero: t.string().default(''),
  id: t.number().default(0),
  side: t.string().default(''),
  kind: t.string().default(''),
  x: t.number().default(0),
  hp: t.number().default(0),
  maxHp: t.number().default(0),
  level: t.number().default(0),
  cooldown: t.number().default(0),
  attacking: t.boolean().default(false),
  row: t.number().default(0),
  silencedUntil: t.number().default(0),
  strengthUntil: t.number().default(0),
});
const HitState = schema({
  sourceType: t.string().default('unit'),
  sourceSlot: t.number().default(-1),
  id: t.number().default(0),
  time: t.number().default(0),
  kind: t.string().default(''),
  side: t.string().default(''),
  sourceId: t.number().default(0),
  sourceX: t.number().default(0),
  sourceRow: t.number().default(0),
  targetX: t.number().default(0),
  targetRow: t.number().default(0),
  targetId: t.number().default(0),
  damage: t.number().default(0),
});
const PowerTarget = schema({
  id: t.number().default(0),
  x: t.number().default(0),
  row: t.number().default(0),
  kind: t.string().default(''),
});
const PowerState = schema({
  kind: t.string().default('bills'),
  id: t.number().default(0),
  time: t.number().default(0),
  side: t.string().default(''),
  targets: t.array(PowerTarget),
  workerLoss: t.number().default(0),
});
const EventState = schema({ id: t.number().default(0), text: t.string().default('') });
export const MatchState = schema({
  time: t.number().default(0),
  status: t.string().default('waiting'),
  winner: t.string().default(''),
  nextId: t.number().default(0),
  players: t.map(PlayerState),
  units: t.array(UnitState),
  log: t.array(EventState),
  hits: t.array(HitState),
  powers: t.array(PowerState),
  battlefield: t.string().default('campo'),
  leftNick: t.string().default(''),
  rightNick: t.string().default(''),
});
export type MatchState = SchemaType<typeof MatchState>;
export function syncState(state: MatchState, game: GameState) {
  state.battlefield = game.battlefield ?? 'campo';
  state.time = game.time;
  state.status = game.status;
  state.winner = game.winner ?? '';
  state.nextId = game.nextId;
  for (const side of ['left', 'right'] as const) {
    if (!state.players.has(side)) state.players.set(side, new PlayerState());
    const target = state.players.get(side)!;
    const {
      heroes,
      heroRevivals,
      heroCooldowns,
      powerCooldowns,
      unlockedPowers,
      ownedPlots,
      buildings,
      trainingQueue,
      loans,
      investments,
      research,
      researchJobs,
      ...values
    } = game.players[side];
    Object.assign(target, values);
    if (target.unlockedPowers.length !== (unlockedPowers ?? []).length) {
      target.unlockedPowers.clear();
      for (const kind of unlockedPowers ?? []) target.unlockedPowers.push(kind);
    }
    while (target.heroes.length > (heroes ?? []).length) target.heroes.pop();
    for (let i = 0; i < (heroes ?? []).length; i++) {
      if (!target.heroes[i]) target.heroes.push(new HeroRecordState());
      Object.assign(target.heroes[i], heroes[i]);
    }
    while (target.heroRevivals.length > (heroRevivals ?? []).length) target.heroRevivals.pop();
    for (let i = 0; i < (heroRevivals ?? []).length; i++) {
      if (!target.heroRevivals[i]) target.heroRevivals.push(new HeroRevivalState());
      Object.assign(target.heroRevivals[i], heroRevivals[i]);
    }
    for (const [hero, remaining] of Object.entries(heroCooldowns ?? {}))
      target.heroCooldowns.set(hero, remaining);
    for (const [kind, remaining] of Object.entries(powerCooldowns))
      target.powerCooldowns.set(kind, remaining);
    if (target.ownedPlots.length !== ownedPlots.length) {
      target.ownedPlots.clear();
      for (const slot of ownedPlots) target.ownedPlots.push(slot);
    }
    if (target.research.length !== (research ?? []).length) {
      target.research.clear();
      for (const kind of research ?? []) target.research.push(kind);
    }
    while (target.researchJobs.length > (researchJobs ?? []).length) target.researchJobs.pop();
    for (let i = 0; i < (researchJobs ?? []).length; i++) {
      if (!target.researchJobs[i]) target.researchJobs.push(new ResearchJobState());
      Object.assign(target.researchJobs[i], researchJobs[i]);
    }
    while (target.loans.length > (loans ?? []).length) target.loans.pop();
    for (let i = 0; i < (loans ?? []).length; i++) {
      if (!target.loans[i]) target.loans.push(new LoanState());
      Object.assign(target.loans[i], loans[i]);
    }
    while (target.investments.length > (investments ?? []).length) target.investments.pop();
    for (let i = 0; i < (investments ?? []).length; i++) {
      if (!target.investments[i]) target.investments.push(new InvestmentState());
      Object.assign(target.investments[i], investments[i]);
    }
    while (target.trainingQueue.length > (trainingQueue ?? []).length) target.trainingQueue.pop();
    for (let i = 0; i < (trainingQueue ?? []).length; i++) {
      if (!target.trainingQueue[i]) target.trainingQueue.push(new TrainingState());
      Object.assign(target.trainingQueue[i], trainingQueue[i]);
    }
    while (target.buildings.length > buildings.length) target.buildings.pop();
    for (let i = 0; i < buildings.length; i++) {
      if (!target.buildings[i]) target.buildings.push(new BuildingState());
      const { promotionQueue = [], medicQueue = [], ...building } = buildings[i];
      Object.assign(target.buildings[i], {
        upgrading: false,
        upgradeProgress: 0,
        productionTier: 0,
        activeTier: 0,
        autoPaused: false,
        populationReserved: false,
        lastYield: 0,
        ...building,
        investedCash: buildingInvestment(building),
      });
      const doctors = target.buildings[i].medicQueue;
      while (doctors.length > medicQueue.length) doctors.pop();
      for (let j = 0; j < medicQueue.length; j++) {
        if (!doctors[j]) doctors.push(new TrainingState());
        Object.assign(doctors[j], medicQueue[j]);
      }
      const queue = target.buildings[i].promotionQueue;
      while (queue.length > promotionQueue.length) queue.pop();
      for (let j = 0; j < promotionQueue.length; j++) {
        if (!queue[j]) queue.push(new PromotionState());
        Object.assign(queue[j], promotionQueue[j]);
      }
    }
  }
  const active = new Set(game.units.map((u) => u.id));
  for (let i = state.units.length - 1; i >= 0; i--)
    if (!active.has(state.units[i].id)) state.units.splice(i, 1);
  const existing = new Map(state.units.map((u) => [u.id, u]));
  for (const unit of game.units) {
    let target = existing.get(unit.id);
    if (!target) {
      target = new UnitState();
      state.units.push(target);
    }
    Object.assign(target, unit);
  }
  const hitIds = new Set(game.hits.map((hit) => hit.id));
  for (let i = state.hits.length - 1; i >= 0; i--)
    if (!hitIds.has(state.hits[i].id)) state.hits.splice(i, 1);
  const syncedHits = new Set(state.hits.map((hit) => hit.id));
  for (const hit of game.hits) if (!syncedHits.has(hit.id)) state.hits.push(new HitState(hit));
  const powerIds = new Set((game.powers ?? []).map((power) => power.id));
  for (let i = state.powers.length - 1; i >= 0; i--)
    if (!powerIds.has(state.powers[i].id)) state.powers.splice(i, 1);
  const syncedPowers = new Set(state.powers.map((power) => power.id));
  for (const power of game.powers ?? [])
    if (!syncedPowers.has(power.id)) {
      const entry = new PowerState({
        kind: power.kind,
        id: power.id,
        time: power.time,
        side: power.side,
        workerLoss: power.workerLoss ?? 0,
      });
      for (const target of power.targets) entry.targets.push(new PowerTarget(target));
      state.powers.push(entry);
    }
  if (state.log[0]?.id !== game.log[0]?.id) {
    state.log.clear();
    for (const event of game.log) state.log.push(Object.assign(new EventState(), event));
  }
}
