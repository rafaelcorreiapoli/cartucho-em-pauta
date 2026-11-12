import { productionSpec } from './production-catalog';
import { battlefieldLayout } from './battlefields';
import { buildingUpgradeCost } from './buildings';
import { employment } from './employment';
import { isBuildingReady, missingBuildingRequirements, ownsPlot } from './buildings';
import { execute } from './commands';
import {
  BUILDINGS,
  opposite,
  PLOT_COST,
  WORKER_COST,
  type BuildingKind,
  type GlobalPowerKind,
  type Side,
} from './content';
import { debtService, grossIncome, payoffCost } from './finance';
import { MEDIC } from './healing';
import { heroRecord, heroRevivalQuote } from './hero-progression';
import { heroRecruitmentCost, heroRoster, MAX_HEROES } from './heroes';
import type { Command, GameState } from './model';
import { popularityRate, taxPopularityRate } from './popularity';
import { populationCapacity, populationUsed } from './population';
import { heroCount, queuedWorkers } from './recruitment';
import { availableResearches, researchLevel, researchQuote, type ResearchKind } from './research';
import { globalPowerQuote, isGlobalPowerUnlocked } from './spell-rules';

/** Deterministic priorities, with the same commands, prices and information as a human player. */
export function botAct(game: GameState, side: Side) {
  if (game.status !== 'playing') return;
  const p = game.players[side],
    enemy = game.players[opposite(side)],
    allies = game.units.filter((u) => u.side === side),
    foes = game.units.filter((u) => u.side !== side);
  const home = side === 'left' ? 80 : 920,
    pressure = foes.filter((u) => Math.abs(u.x - home) < 220),
    danger =
      pressure.length >= 2 &&
      pressure.reduce((n, u) => n + u.hp, 0) > allies.reduce((n, u) => n + u.hp, 0) * 0.8;
  const act = (command: Command) => execute(game, side, command) === null;
  const has = (kind: BuildingKind) => p.buildings.some((b) => b.kind === kind),
    ready = (kind: BuildingKind) => p.buildings.some((b) => b.kind === kind && isBuildingReady(b));
  const count = (kind: BuildingKind) => p.buildings.filter((b) => b.kind === kind).length;
  const producers = p.buildings.filter((b) => BUILDINGS[b.kind].unit),
    capacity = populationCapacity(p),
    used = populationUsed(game, side);
  const netIncome = grossIncome(p) - debtService(p),
    reserve = Math.max(80, netIncome * 4);

  // Preserve stability while funding growth; no tax oscillation on tiny popularity changes.
  const cultural = popularityRate(p) - taxPopularityRate(p),
    growth = p.popularity < 80 ? 0.35 : p.popularity > 150 ? -0.15 : 0;
  const tax = Math.max(5, Math.min(25, Math.floor((10 + (cultural - growth) / 0.15) * 2) / 2));
  if (Math.abs(p.taxRate - tax) >= 1) act({ type: 'tax', rate: tax });
  const cast = (kind: GlobalPowerKind) =>
    isGlobalPowerUnlocked(p, kind) &&
    p.popularity >= globalPowerQuote(p, kind).cost &&
    (p.powerCooldowns?.[kind] ?? 0) <= 0 &&
    act({ type: 'power', kind });
  // Avoid stacking recall with damage and attack buffs after the targets have disappeared.
  const recalled = danger && pressure.length >= 4 && cast('recall');
  if (!recalled && foes.length >= 4) cast('bills');
  if (!recalled && allies.filter((u) => u.attacking).length >= 3) cast('strength');
  if (!recalled && pressure.length >= 3 && allies.some((u) => u.attacking)) cast('silence');
  if (!danger && game.players[opposite(side)].workers >= 10) cast('sabotage');

  function construct(kind: BuildingKind): boolean {
    if (missingBuildingRequirements(p, kind).length) return false;
    const slots = battlefieldLayout(game.battlefield).plots[side].map(({ slot }) => slot);
    const empty = slots.find(
      (slot) => ownsPlot(p, slot) && !p.buildings.some((b) => b.slot === slot),
    );
    if (empty !== undefined)
      return p.cash >= BUILDINGS[kind].cost && act({ type: 'build', kind, slot: empty });
    const plot = slots.find((slot) => !ownsPlot(p, slot));
    return (
      plot !== undefined &&
      p.cash >= PLOT_COST + BUILDINGS[kind].cost &&
      act({ type: 'buy-plot', slot: plot })
    );
  }
  // A population block is more urgent than spending on another producer or upgrade.
  if (
    capacity < 200 &&
    capacity - used < Math.max(4, producers.length + 2) &&
    !p.buildings.some((b) => b.kind === 'housing' && !isBuildingReady(b))
  ) {
    if (construct('housing')) return;
  }
  if (danger && p.cash < 200 && p.investments.length) {
    act({ type: 'redeem', id: p.investments[0].id });
  }
  if (
    danger &&
    p.cash < 200 &&
    ready('bank') &&
    !p.loans.length &&
    debtService(p) < grossIncome(p) * 0.15
  )
    act({ type: 'loan', product: 'bridge' });

  const dead = p.heroes?.find((record) => record.status === 'dead'),
    hospital = p.buildings.find(
      (b) =>
        b.kind === 'hospital' &&
        isBuildingReady(b) &&
        !b.medicQueue?.length &&
        !p.heroRevivals.some((job) => job.slot === b.slot),
    );
  if (
    dead &&
    hospital &&
    p.cash >= heroRevivalQuote(p, dead.hero).cost + reserve &&
    act({ type: 'hero-revive', hero: dead.hero, slot: hospital.slot })
  )
    return;
  const jobs = employment(p);
  if (
    !danger &&
    jobs.vacancies <= queuedWorkers(p) &&
    !p.buildings.some((b) => b.kind === 'workplace' && !isBuildingReady(b))
  ) {
    if (construct('workplace')) return;
  }
  const workerTarget = Math.min(18, 6 + Math.floor(game.time / 45) * 2);
  if (
    !danger &&
    jobs.vacancies > queuedWorkers(p) &&
    p.workers + queuedWorkers(p) < workerTarget &&
    queuedWorkers(p) < 2 &&
    capacity - used > 3 &&
    p.cash >= WORKER_COST + reserve &&
    act({ type: 'worker' })
  )
    return;

  if (
    allies.filter((u) => u.kind !== 'medic').length >= 5 &&
    allies.filter((u) => u.kind === 'medic').length +
      p.buildings.reduce((total, building) => total + (building.medicQueue?.length ?? 0), 0) <
      Math.min(3, 1 + Math.floor(allies.length / 10)) &&
    capacity - used >= 2 &&
    p.cash >= MEDIC.cost + reserve &&
    hospital &&
    act({ type: 'medic', slot: hospital.slot })
  )
    return;
  // Open all combat classes, then culture and basic research instead of endlessly spamming cheap buildings.
  for (const kind of ['barracks', 'media', 'garage', 'civic'] as BuildingKind[])
    if (!has(kind) && construct(kind)) return;
  if (producers.length >= 2 && !has('school') && construct('school')) return;
  const hero = heroRoster(side).find((hero) => !heroRecord(p, hero));
  if (
    ready('civic') &&
    hero &&
    heroCount(game, side) < Math.min(MAX_HEROES, 1 + Math.floor(game.time / 150)) &&
    capacity - used >= 3 &&
    p.cash >= heroRecruitmentCost(p, hero) + reserve &&
    act({ type: 'hero', hero })
  )
    return;
  if (ready('school') && !has('hospital') && (dead || game.time > 180) && construct('hospital'))
    return;

  // Set money aside for the university. Keep a frontline factory running while saving.
  const savingSchool = ready('civic') && !has('school') && producers.length >= 3 && game.time > 65;
  const savingAcademy = ready('school') && !has('academy') && game.time > 150 && p.workers >= 10;
  const runningCost = producers
    .filter((b) => isBuildingReady(b))
    .reduce((sum, b) => {
      const spec = productionSpec(b, b.productionTier)!;
      return sum + spec.cost / spec.duration;
    }, 0);
  const scarce = runningCost > netIncome * 0.8 && p.cash < reserve * 2;
  const keep = new Set(
    producers
      .slice()
      .sort(
        (a, b) =>
          Number(b.kind === 'barracks') - Number(a.kind === 'barracks') || b.level - a.level,
      )
      .slice(0, savingAcademy || savingSchool ? 1 : Math.max(1, Math.floor(netIncome / 6)))
      .map((b) => b.slot),
  );
  for (const building of producers.filter(isBuildingReady)) {
    const pause = (savingAcademy || savingSchool || scarce) && !keep.has(building.slot);
    if (!!building.autoPaused !== pause)
      act({ type: 'auto-production', slot: building.slot, paused: pause });
  }
  if (savingSchool) {
    if (construct('school')) return;
  } else if (savingAcademy) {
    if (construct('academy')) return;
  } else {
    const priorities: ResearchKind[] = danger
      ? ['base_artillery', 'fortification', 'defense', 'infantry', 'vitality', 'production']
      : [
          'productivity',
          'production',
          'worker_training',
          'infantry',
          'marksmanship',
          'siege',
          'mobility',
          'construction',
          'vitality',
          'spell_cooldown',
          'spell_threshold',
          'fortification',
          'defense',
        ];
    for (const building of p.buildings.filter(
      (b) =>
        (b.kind === 'school' || b.kind === 'academy') &&
        isBuildingReady(b) &&
        !p.researchJobs.some((job) => job.slot === b.slot),
    )) {
      const catalog = availableResearches(building.kind as 'school' | 'academy');
      const kind = priorities
        .filter(
          (kind) =>
            catalog.includes(kind) &&
            researchLevel(p, kind) < 3 &&
            !p.researchJobs.some((job) => job.kind === kind),
        )
        .sort((a, b) => researchLevel(p, a) - researchLevel(p, b))[0];
      if (
        kind &&
        p.cash >= researchQuote(p, kind).cost + reserve &&
        act({ type: 'research', slot: building.slot, kind })
      )
        return;
    }
  }
  if (!has('bank') && p.workers >= 10 && construct('bank')) return;
  // Weighted force mix reacts to the opposing army; siege increases when enemy base is exposed.
  const enemyFront = foes.filter((u) => u.kind === 'front').length,
    enemyRanged = foes.filter((u) => u.kind === 'ranged').length;
  const targets: { kind: BuildingKind; weight: number }[] = [
    { kind: 'barracks', weight: enemyRanged > enemyFront ? 3 : 2 },
    { kind: 'media', weight: enemyFront > enemyRanged ? 3 : 2 },
    { kind: 'garage', weight: !danger && enemy.baseHp < 900 ? 2 : 1 },
  ];
  const desiredFactories = Math.min(12, 3 + Math.floor(game.time / 90));
  if (
    !savingAcademy &&
    !savingSchool &&
    producers.length < desiredFactories &&
    p.cash > reserve + 180
  ) {
    const kind = targets.sort((a, b) => count(a.kind) / a.weight - count(b.kind) / b.weight)[0]
      .kind;
    if (construct(kind)) return;
  }
  if (!savingAcademy && !savingSchool) {
    const upgrade = producers
      .filter(
        (b) =>
          isBuildingReady(b) &&
          !b.upgrading &&
          b.level < Math.min(15, 2 + Math.floor(game.time / 90)),
      )
      .sort((a, b) => a.level - b.level)[0];
    if (
      upgrade &&
      p.cash >= buildingUpgradeCost(upgrade) + reserve &&
      act({ type: 'upgrade', slot: upgrade.slot })
    )
      return;
  }
  const debt = p.loans[0];
  if (debt && p.cash > payoffCost(debt) + 600 && act({ type: 'repay', id: debt.id })) return;
  if (!danger && !savingAcademy && ready('bank') && p.cash > 2500 && p.investments.length < 2)
    act({ type: 'invest', product: 'treasury' });
}
