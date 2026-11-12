import { leftCampaignBosses, leftEncounterOptions } from "./left-encounters";
import { rightEncounterOptions, mtstReinforcement } from "./right-encounters";
import { consumables, consumableSlots, leftBuildConsumables, leftBuildRelics, relics, type ConsumableId, type ItemOffer, type RelicId } from "./items";
import {
  cardDefinition,
  cardType,
  needsTarget,
  leftRivals,
  rightRewardPool,
  type DeckCardId,
  encounters,
  rewardPool,
  type CardId,
  type Rival,
  type Intent,
} from "./catalog";
import { eventCatalog } from "./event-catalog";
import { heroes, type HeroId, type Faction } from "./heroes";

export const MAX_MORAL = 62;
export const TURN_ENERGY = 3;
export const ELECTION_COINS_PER_ENERGY = 10;
export const DEBT_MORAL_LOSS = 10;
export const HAND_SIZE = 5;
export const difficulties = {
  easy: { label: "Fácil", moral: 0.75, attack: 0.90 },
  normal: { label: "Normal", moral: 1, attack: 1 },
  hard: { label: "Difícil", moral: 1.50, attack: 1.20 },
} as const;
export type Difficulty = keyof typeof difficulties;
export const EVENT_CHANCE = 60;
export const EVENT_PRIZE = 20;
export const EVENT_DAMAGE = 4;
export const EVENT_RECOVERY = 12;
export const SHOP_REMOVAL_PRICE = 35;
type EventResult = "profit" | "injury" | "rest" | "special";
export type Phase = "player" | "rivals" | "reward" | "event" | "shop" | "map" | "won" | "lost";

type RivalState = (typeof encounters)[number]["rivals"][number] & {
  maxMoral: number;
  guard: number;
  bonus: number;
  step: number;
  specialUsed?: boolean;
  secondPhaseStart?: number;
  campaignResponse?: "attack" | "guard";
};

export type ShopOffer = { card: CardId; price: number; sold: boolean };

type Route = { name: string; order: readonly number[]; events: readonly number[]; eventIds: readonly number[]; shops: readonly number[]; bosses: readonly number[] };

export type Run = Route & {
  routes: Route[];
  routeNumber: number | null;
  confirmedDestination?: number;
  hero: HeroId;
  difficulty: Difficulty;
  seed: number;
  stage: number;
  eventResult: EventResult | null;
  eventReward: string;
  eventItemImage?: string;
  eventMoralDelta: number;
  conquered: number[];
  encounterHistory: string[][];
  phase: Phase;
  moral: number;
  money: number;
  shopOffers: ShopOffer[];
  shopRemovedCard: boolean;
  temporaryCoins: number;
  retainGuard: number;
  gainedStrength: boolean;
  sindicatoUsed: boolean;
  auditUsed: boolean;
  itemOffers: ItemOffer[];
  relics: RelicId[];
  cuecaTriggered: boolean;
  consumables: ConsumableId[];
  guard: number;
  energy: number;
  nextEnergy: number;
  electionActive: boolean;
  strength: number;
  turnStrength: number;
  strengthByUpcomingTurn: number[];
  turnEndGuard: number;
  rightEffects: {
    bombonsUsed: boolean;
    gainedCoins: boolean;
    pendingDiscards: number;
    drawAfterDiscard: number;
    repeatTactic: boolean;
    playedTactic: boolean;
    damagedRival: boolean;
    moralWithoutDamage: number;
    nextMoralCost: number;
    weakenAttack: number;
    blockDebuff: boolean;
    delayed: { id: string; damage: number }[];
  };
  firstCardLocked: boolean;
  lockedCardType?: ReturnType<typeof cardType>;
  attackCardsPlayed: number;
  defenseCardsPlayed: number;
  turn: number;
  deck: DeckCardId[];
  hand: DeckCardId[];
  draw: DeckCardId[];
  discard: DeckCardId[];
  rivals: RivalState[];
  rewards: CardId[];
  relicRewards: RelicId[];
  rewardHistory: CardId[];
};

function shuffle<T>(run: { seed: number }, items: readonly T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index--) {
    const other = Math.floor(roll(run) * (index + 1));
    [shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]];
  }
  return shuffled;
}

const boss = encounters.findIndex(({ uf }) => uf === "df");

function roll(random: { seed: number }) {
  random.seed = (Math.imul(random.seed, 1664525) + 1013904223) >>> 0;
  return random.seed / 4294967296;
}

const corridors = [
  { name: "Litoral primeiro", states: "rs sc pr sp rj es ba se al pe pb rn ce pi ma to pa ap rr am ac ro mt ms mg go" },
  { name: "Oeste primeiro", states: "rr am ac ro mt ms pr rs sc sp rj es ba se al pe pb rn ce pi ma ap pa to mg go" },
  { name: "Do Norte ao Sul", states: "ap pa rr am ac ro mt ms rs sc pr sp rj es ba se al pe pb rn ce pi ma to mg go" },
].map(({ name, states }) => ({
  name,
  order: states.split(" ").map((uf) => encounters.findIndex((stage) => stage.uf === uf)),
}));

export const routeForks: readonly number[] = [4, 8, 16];
export const routeLength = 21;

function drawCampaign(seed: number, { name, order: corridor }: typeof corridors[number], faction: Faction): Route {
  const order = corridor.filter((_, index) => ![6, 15, 21].includes(index));
  const shops = [order[11], order.at(-1)!];
  const alternateIndices = routeForks.map((stop, fork) => stop + fork + 1);
  const stopAt = (index: number) => index - alternateIndices.filter((alternate) => alternate <= index).length;
  const bosses = order.filter((_, index) => leftCampaignBosses.has(stopAt(index)));
  const events = order.filter((_, index) => {
    const stop = stopAt(index);
    return [1, 5, 10, 15].includes(stop);
  });
  const eventIds = shuffle(
    { seed: seed ^ 0x9e3779b9 },
    eventCatalog.map((_, index) => index),
  );
  if (faction === "right") {
    const cpi = eventCatalog.findIndex(({ id }) => id === "cpi-da-pandemia");
    eventIds.splice(eventIds.indexOf(cpi), 1);
    eventIds.unshift(cpi);
  }
  return { name, order: [...order, boss], events, eventIds, shops, bosses: [...bosses, boss] };
}

export function currentEvent(run: Run, stage = run.stage) {
  return eventCatalog[run.eventIds[run.events.indexOf(stage)]];
}

export function availableDestinations(run: Run): number[] {
  const index = run.conquered.length;
  if (run.phase !== "map" || run.routeNumber === null) return [];
  if (run.confirmedDestination !== undefined) return [run.confirmedDestination];
  return run.order.slice(index, index + (routeForks.includes(index) ? 2 : 1));
}

export function chooseRoute(run: Run, index: number) {
  const route = run.routes[index];
  if (run.phase !== "map" || !route || run.routeNumber !== null) return false;
  Object.assign(run, route);
  run.routeNumber = index + 1;
  run.routes = [];
  run.stage = route.order[0];
  return true;
}

function drawCards(run: Run, count: number) {
  for (let index = 0; index < count; index++) {
    if (!run.draw.length) {
      run.draw = shuffle(run, run.discard);
      run.discard = [];
    }
    const card = run.draw.pop();
    if (card === undefined) break;
    run.hand.push(card);
  }
}

function newRightEffects(): Run["rightEffects"] {
  return {
    bombonsUsed: false, gainedCoins: false, pendingDiscards: 0, drawAfterDiscard: 0,
    repeatTactic: false, playedTactic: false, damagedRival: false,
    moralWithoutDamage: 0, nextMoralCost: 0, weakenAttack: 0,
    blockDebuff: false, delayed: [],
  };
}

function gainCoins(run: Run, amount: number) {
  if (!amount) return 0;
  const effects = run.rightEffects;
  const bonus = !effects.bombonsUsed && run.relics.includes("bombons") ? 5 : 0;
  effects.gainedCoins = true;
  effects.bombonsUsed ||= bonus > 0;
  run.money += amount + bonus;
  return bonus;
}

export function discardFromHand(run: Run, index: number) {
  const id = run.hand[index];
  if (run.phase !== "player" || !run.rightEffects.pendingDiscards || !id) return null;
  run.discard.push(id);
  run.hand.splice(index, 1);
  const effects = run.rightEffects;
  effects.pendingDiscards--;
  const handSize = run.hand.length;
  if (!effects.pendingDiscards) {
    drawCards(run, effects.drawAfterDiscard);
    effects.drawAfterDiscard = 0;
  }
  return { drawn: run.hand.length - handSize };
}

function updateStrengthRelic(run: Run) {
  const strength = run.strength + run.turnStrength;
  if (strength < 3 || run.sindicatoUsed || !run.relics.includes("carteiraSindicato")) return;
  run.sindicatoUsed = true;
  run.guard += 7;
  drawCards(run, 1);
}

export function cardBaseDamage(run: Run, card: ReturnType<typeof cardDefinition>) {
  return card.guardDamage ? Math.min(18, Math.floor(run.guard / 2)) : card.damage ?? 0;
}

export function cardHitCount(run: Run, card: ReturnType<typeof cardDefinition>) {
  const bonus = (card.extraHitAfterTactic && run.rightEffects.playedTactic) ||
    (card.extraHitAtStrength !== undefined && run.strength + run.turnStrength >= card.extraHitAtStrength);
  return (card.hits ?? 1) + (bonus ? 1 : 0);
}

function startTurn(run: Run) {
  run.phase = "player";
  run.electionActive = false;
  run.turn++;
  run.attackCardsPlayed = 0;
  run.defenseCardsPlayed = 0;
  const strengthGain = run.strengthByUpcomingTurn.shift() ?? 0;
  run.strength += strengthGain;
  run.gainedStrength = strengthGain > 0;
  const retained = run.retainGuard + (run.relics.includes("poteVento") ? 4 : 0);
  run.guard = run.turn === 1 && run.relics.includes("faixa") ? 6 : Math.min(run.guard, retained);
  run.retainGuard = 0;
  updateStrengthRelic(run);
  run.energy = TURN_ENERGY + run.nextEnergy;
  run.nextEnergy = 0;
  const extra = run.turn === 1 && run.relics.includes("carimbo") ? 1 : 0;
  drawCards(run, HAND_SIZE + extra);
}

export function encounterRivals(
  stage: number,
  conquered: number,
  isBoss = false,
  difficulty: Difficulty = "normal",
  faction: Faction = "left",
  history: readonly (readonly string[])[] = [],
): Rival[] {
  const progress = Math.min(conquered, routeLength - 1);
  const level = 1 + Math.floor(progress / 5);
  const finalBoss = stage === boss;
  const options = faction === "left"
    ? leftEncounterOptions(stage, progress, isBoss, finalBoss)
    : rightEncounterOptions(stage, progress, isBoss, finalBoss, leftRivals);
  const rivals = selectLineup(options, stage, progress, history);

  const latePressure = difficulty === "easy" ? 0 : Math.max(0, progress - 8);
  const baseMoral = 28 + progress * 1.8 + progress ** 2 * 0.075 + latePressure * 0.75;
  const encounterMoral = baseMoral + (finalBoss ? 18 : isBoss ? 8 + progress * 0.4 : 0);
  const totalMoral = rivals.reduce((total, rival) => total + rival.moral, 0);
  const attackScale = (1 + progress * 0.020 + latePressure * 0.019) / rivals.length ** 0.38;
  const guardScale = 1 + progress * 0.025;
  const modifiers = difficulties[difficulty];
  function scaleIntent(intent: Intent): Intent {
    const offensive = intent.kind === "attack" || intent.kind === "counter" || intent.kind === "predict" || intent.kind === "rally";
    const scale = offensive ? attackScale * modifiers.attack : guardScale;
    return intent.kind === "stamp" ? intent : {
      ...intent,
      ...(intent.kind === "predict" ? { guardValue: Math.round((intent.guardValue ?? intent.value) * guardScale) } : {}),
      value: Math.max(1, Math.round(intent.value * scale)),
    };
  }

  return rivals.map((rival) => ({
    ...rival,
    name: level > 1 ? `${rival.name} Nv. ${level}` : rival.name,
    moral: Math.round(rival.moral * encounterMoral / totalMoral * modifiers.moral),
    intents: rival.intents.map(scaleIntent),
    secondPhase: rival.secondPhase?.map(scaleIntent),
  }));
}

function selectLineup(
  options: readonly (readonly Rival[])[],
  stage: number,
  progress: number,
  history: readonly (readonly string[])[],
) {
  const recent = history.slice(-2).flat();
  const offset = (stage * 17 + progress * 7) % options.length;
  const rotated = [...options.slice(offset), ...options.slice(0, offset)];
  const scored = rotated.map((lineup) => {
    const ids = lineup.map(({ id }) => id);
    const repeats = history.filter((past) => past.length === ids.length && ids.every((id) => past.includes(id))).length;
    const overlap = recent.filter((id) => ids.includes(id)).length;
    return { lineup, score: repeats * 10 + overlap };
  });
  return scored.reduce((best, candidate) => candidate.score < best.score ? candidate : best).lineup;
}

export function campaignLineup(run: Run, stage = run.stage) {
  return encounterRivals(stage, run.conquered.length, run.bosses.includes(stage), run.difficulty,
    heroes[run.hero].faction, run.encounterHistory);
}

function startEncounter(run: Run) {
  run.temporaryCoins = 0;
  run.retainGuard = 0;
  run.gainedStrength = false;
  run.sindicatoUsed = false;
  run.auditUsed = false;
  run.cuecaTriggered = false;
  run.rightEffects = newRightEffects();
  run.nextEnergy = 0;
  run.turnEndGuard = 0;
  run.firstCardLocked = false;
  run.lockedCardType = undefined;
  run.strength = 0;
  run.turnStrength = 0;
  run.strengthByUpcomingTurn = [];
  run.turn = 0;
  run.guard = 0;
  run.eventResult = null;
  run.eventReward = "";
  run.eventItemImage = undefined;
  run.eventMoralDelta = 0;
  run.hand = [];
  run.draw = [];
  run.discard = [];
  run.rewards = [];
  run.relicRewards = [];
  if (run.shops.includes(run.stage)) {
    stockShop(run);
    return;
  }
  if (run.events.includes(run.stage)) {
    run.rivals = [];
    run.energy = 0;
    run.phase = "event";
    return;
  }
  run.draw = shuffle(run, run.deck);
  run.rivals = campaignLineup(run).map((rival) => ({
    ...rival,
    maxMoral: rival.moral,
    guard: 0,
    bonus: 0,
    step: 0,
  }));
  run.encounterHistory.push(run.rivals.map(({ id }) => id));
  startTurn(run);
}

export function newRun(
  seed = Math.floor(Math.random() * 4294967296),
  hero: HeroId = "lula",
  difficulty: Difficulty = "normal",
): Run {
  const run: Run = {
    hero,
    difficulty,
    seed,
    name: "",
    order: [],
    events: [],
    eventIds: [],
    shops: [],
    bosses: [],
    routes: corridors.map((corridor, index) => drawCampaign(seed ^ Math.imul(index, 0x9e3779b9), corridor, heroes[hero].faction)),
    routeNumber: null,
    stage: 0,
    conquered: [],
    encounterHistory: [],
    eventResult: null,
    eventReward: "",
    eventMoralDelta: 0,
    phase: "map",
    moral: MAX_MORAL,
    money: 0,
    shopOffers: [],
    shopRemovedCard: false,
    temporaryCoins: 0,
    retainGuard: 0,
    gainedStrength: false,
    sindicatoUsed: false,
    auditUsed: false,
    itemOffers: [],
    relics: [...heroes[hero].startingRelics],
    rightEffects: newRightEffects(),
    cuecaTriggered: false,
    consumables: [...heroes[hero].startingItems],
    guard: 0,
    energy: 0,
    nextEnergy: 0,
    electionActive: false,
    strength: 0,
    turnStrength: 0,
    strengthByUpcomingTurn: [],
    turnEndGuard: 0,
    firstCardLocked: false,
    attackCardsPlayed: 0,
    defenseCardsPlayed: 0,
    turn: 0,
    deck: [...heroes[hero].deck],
    hand: [],
    draw: [],
    discard: [],
    rivals: [],
    rewards: [],
    relicRewards: [],
    rewardHistory: [],
  };
  return run;
}

export function intentFor(rival: RivalState, turnEndGuard?: number, livingRivals?: number): Intent {
  if (rival.id === "dilma" && rival.moral <= rival.maxMoral / 2) {
    return rival.specialUsed
      ? { kind: "attack", value: rival.intents[1].value + rival.bonus + 3, label: "Vento Estocado" }
      : { kind: "doubleGuard", value: Math.max(4, rival.guard * 2), label: "Dobra a Meta" };
  }
  if (rival.id === "suplicy" && livingRivals === 1) {
    return { kind: "attack", value: rival.intents[0].value + 2 + rival.bonus, label: "Rap do Suplicy" };
  }
  const secondPhase = rival.secondPhaseStart === undefined ? undefined : rival.secondPhase;
  const pattern = secondPhase ?? rival.intents;
  const intent = pattern[(rival.step - (rival.secondPhaseStart ?? 0)) % pattern.length];
  if (rival.id === "santana" && intent.kind === "predict" && rival.campaignResponse) {
    return { ...intent, kind: rival.campaignResponse, value: rival.campaignResponse === "guard"
      ? intent.guardValue ?? intent.value : intent.value + rival.bonus };
  }
  if (intent.kind === "counter") {
    return { ...intent, kind: "attack", value: (rival.guard ? intent.value : Math.ceil(intent.value / 2)) + rival.bonus };
  }
  if (intent.kind === "predict" && turnEndGuard !== undefined) {
    return turnEndGuard > 0 ? { ...intent, kind: "guard", value: intent.guardValue ?? intent.value } : { ...intent, kind: "attack", value: intent.value + rival.bonus };
  }
  return intent.kind === "attack" ? { ...intent, value: intent.value + rival.bonus } : intent;
}

export function rivalIntent(run: Run, rival: RivalState, resolving = false): Intent {
  const living = run.rivals.filter(({ moral }) => moral > 0);
  const intent = intentFor(rival, resolving ? run.turnEndGuard : undefined, living.length);
  if (intent.kind === "summon" && (rival.specialUsed || !living.some(({ id }) => id === "carro-som"))) {
    return { kind: "attack", value: rival.intents[1].value + rival.bonus, label: "Megafone" };
  }
  if (intent.kind === "jingle" && !rival.guard) {
    return { kind: "wait", value: 0, label: "Jingle Interrompido" };
  }
  return intent;
}

export function pendingAttackPenaltyTargets(run: Run) {
  const targets: { id: string; conditional: boolean }[] = [];
  if (!run.rightEffects.weakenAttack) return targets;

  for (const rival of run.rivals) {
    if (!rival.moral || (run.phase === "rivals" && rival.step >= run.turn)) continue;
    const intent = rivalIntent(run, rival, run.phase === "rivals");
    if (intent.kind === "predict") targets.push({ id: rival.id, conditional: true });
    if (intent.kind === "attack") {
      targets.push({ id: rival.id, conditional: targets.length > 0 });
      break;
    }
  }
  return targets;
}

export function canPlayCard(run: Run, index: number) {
  const id = run.hand[index];
  if (run.phase !== "player" || run.rightEffects.pendingDiscards || !id) return false;
  const card = cardDefinition(id);
  return !card.unplayable && !(index === 0 && run.firstCardLocked) &&
    cardType(card) !== run.lockedCardType && (run.electionActive || card.cost <= run.energy);
}

function hit(target: { guard: number; moral: number }, amount: number) {
  const absorbed = Math.min(target.guard, amount);
  const damage = Math.min(target.moral, amount - absorbed);
  target.guard -= absorbed;
  target.moral -= damage;
  return { absorbed, damage, guardBroken: absorbed > 0 && target.guard === 0 };
}

function hitRival(rival: RivalState, amount: number) {
  const result = hit(rival, amount);
  if (rival.id === "zanin" && !rival.specialUsed && result.damage > 0) {
    const recovered = Math.floor(result.damage / 2);
    rival.specialUsed = true;
    rival.moral += recovered;
    result.damage -= recovered;
  }
  if (rival.secondPhase && rival.moral > 0 && rival.moral <= rival.maxMoral / 2) {
    rival.secondPhaseStart ??= rival.step;
  }
  return result;
}

export function injunctionType(step: number): ReturnType<typeof cardType> {
  return Math.floor(step / 4) % 2 === 0 ? "offensive" : "defensive";
}

export function playCard(run: Run, index: number, targetId?: string) {
  const id = run.hand[index];
  if (!id || !canPlayCard(run, index)) return null;
  const card = cardDefinition(id);
  const living = run.rivals.filter(({ moral }) => moral > 0);
  const hasDamage = Boolean(card.damage || card.guardDamage);
  const targets = !hasDamage
    ? []
    : card.all
      ? living
      : living.filter(({ id }) => id === targetId);
  if ((hasDamage && !targets.length) || (needsTarget(card) && !living.some(({ id }) => id === targetId))) return null;

  const effects = run.rightEffects;
  const type = cardType(card);
  const tactic = type === "tactical";
  if (type === "offensive") run.attackCardsPlayed++;
  if (type === "defensive") run.defenseCardsPlayed++;
  const repeats = tactic && effects.repeatTactic ? 2 : 1;
  if (tactic) effects.repeatTactic = false;
  const strikes = cardHitCount(run, card);
  effects.playedTactic ||= tactic;

  const coinCost = run.electionActive ? card.cost * ELECTION_COINS_PER_ENERGY : 0;
  const temporarySpent = Math.min(run.temporaryCoins, coinCost);
  run.temporaryCoins -= temporarySpent;
  const realCost = coinCost - temporarySpent;
  const shortfall = realCost ? Math.max(0, realCost - run.money) : 0;
  const covered = !run.auditUsed && run.relics.includes("carimboTcu") ? Math.min(10, realCost, shortfall) : 0;
  run.auditUsed ||= covered > 0;
  const coinsSpent = coinCost - covered;
  if (!run.electionActive) run.energy -= card.cost;
  run.money -= realCost - covered;
  if (card.election) run.electionActive = true;
  run.hand.splice(index, 1);
  let relicCoins = 0;
  let bombonCoins = 0;
  const damage = targets.map(({ id }) => ({ id, absorbed: 0, damage: 0, guardBroken: false }));
  const guardBefore = run.guard;
  for (let repeat = 0; repeat < repeats; repeat++) {
    run.strength += card.strength ?? 0;
    run.turnStrength += card.turnStrength ?? 0;
    run.gainedStrength ||= (card.strength ?? 0) + (card.turnStrength ?? 0) > 0;
    for (let turn = 0; turn < (card.strengthGrowthTurns ?? 0); turn++) {
      run.strengthByUpcomingTurn[turn] = (run.strengthByUpcomingTurn[turn] ?? 0) + 1;
    }
    const damagePerHit = cardBaseDamage(run, card) + run.strength + run.turnStrength;
    updateStrengthRelic(run);
    const hadGuard = run.guard > 0;
    run.guard += card.guard ?? 0;
    run.retainGuard = Math.max(run.retainGuard, card.retainGuard ?? 0);
    if (run.gainedStrength) run.guard += card.guardAfterStrength ?? 0;
    if (hadGuard && card.guardBonus) drawCards(run, card.guardBonus);
    if (effects.gainedCoins) run.guard += card.guardAfterCoins ?? 0;
    if (card.doubleGuard) run.guard *= 2;
    targets.forEach((target, targetIndex) => {
      const result = damage[targetIndex];
      for (let strike = 0; strike < strikes && target.moral > 0; strike++) {
        const impact = hitRival(target, damagePerHit);
        result.absorbed += impact.absorbed;
        result.damage += impact.damage;
        result.guardBroken ||= impact.guardBroken;
      }
      effects.damagedRival ||= result.damage > 0;
    });
    run.energy += card.energy ?? 0;
    run.nextEnergy += card.nextEnergy ?? 0;
    run.moral = Math.min(MAX_MORAL, run.moral + (card.heal ?? 0));
    run.moral = Math.max(0, run.moral - (card.moralCost ?? 0));
    bombonCoins += gainCoins(run, card.coins ?? 0);
    if (card.discardBeforeDraw && run.hand.length) {
      effects.pendingDiscards++;
      effects.drawAfterDiscard += card.draw ?? 0;
    } else {
      drawCards(run, card.draw ?? 0);
    }
    if (card.addPayroll) run.discard.push("folhaPagamento");
    if (card.delayedDamage && targetId) effects.delayed.push({ id: targetId, damage: card.delayedDamage });
    effects.repeatTactic ||= Boolean(card.repeatTactic);
    effects.blockDebuff ||= Boolean(card.blockDebuff);
    effects.nextMoralCost += card.nextMoralCost ?? 0;
    effects.moralWithoutDamage += card.moralWithoutDamage ?? 0;
    effects.weakenAttack += card.weakenAttack ?? 0;
  }
  effects.pendingDiscards = Math.min(effects.pendingDiscards, run.hand.length);
  if (card.exhaust && run.relics.includes("cueca") && !run.cuecaTriggered) {
    run.cuecaTriggered = true;
    relicCoins = 5;
    bombonCoins += gainCoins(run, relicCoins);
  }
  if (!card.exhaust) run.discard.push(id);

  return { card, damage, relicCoins, bombonCoins, coinsSpent, guardGained: run.guard - guardBefore, ...settleCombat(run) };
}

const standaloneCards: readonly CardId[] = ["fazOL", "piquete", "creditoSuplementar", "estatizar", "lavaJato"];
const cardBuilds: readonly (readonly CardId[])[] = [
  ["dobraMeta", "estoqueRegulador", "pedaladaFiscal", "estatizar", "estocarVento"],
  ["greveDoAbc", "triplexGuaruja", "piquete", "assembleiaGeral", "mulherSapiens", "subidaJuros"],
  ["anoEleicao", "pixMei", "dinheiroNaCueca", "petrolao", "creditoSuplementar"],
];

function combatRewards(run: Run) {
  const left = heroes[run.hero].faction === "left";
  const pool = left ? rewardPool : rightRewardPool;
  const unused = pool.filter((reward) => !run.rewardHistory.includes(reward));
  if (!left) return shuffle(run, unused.length ? unused : pool).slice(0, 3);
  const available = shuffle(run, unused.length >= 3 ? unused : pool);

  const offers: CardId[] = [];
  if (run.conquered.length <= 6) {
    const standalone = available.find((card) => standaloneCards.includes(card)) ??
      shuffle(run, standaloneCards)[0];
    offers.push(standalone);
  }
  const owned = new Set(run.deck.map((id) => id.replace(/\+$/, "")));
  const builds = cardBuilds.map((cards) => ({
    cards,
    score: cards.reduce((score, card) => score + (owned.has(card) ? (card === "anoEleicao" ? 0.5 : 1) : 0), 0),
  })).sort((a, b) => b.score - a.score);
  const synergy = builds.filter(({ score }) => score > 0).map(({ cards }) =>
    available.find((card) => cards.includes(card) && !offers.includes(card) && !owned.has(card))
  ).find((card) => card !== undefined);
  if (synergy) offers.push(synergy);
  return [...offers, ...available.filter((card) => !offers.includes(card))].slice(0, 3);
}

function availableRelicsFor(run: Run) {
  const left = heroes[run.hero].faction === "left";
  return (Object.keys(relics) as RelicId[]).filter((id) =>
    id !== "bombons" && !run.relics.includes(id) && (left || !leftBuildRelics.includes(id)));
}

function settleCombat(run: Run) {
  let debtDamage = 0;
  let debtPaid = 0;
  if (!run.moral) {
    run.phase = "lost";
  } else if (run.rivals.every(({ moral }) => moral === 0)) {
    run.money += run.relics.includes("fundo") ? 33 : 25;
    if (run.money < 0) {
      debtPaid = -run.money;
      run.money = 0;
      debtDamage = Math.min(run.moral, DEBT_MORAL_LOSS);
      run.moral -= debtDamage;
    }
    if (!run.moral) {
      run.phase = "lost";
      return { debtDamage, debtPaid };
    }
    if (run.relics.includes("carteiraBandejao") && run.moral <= 25) run.moral += 4;
    run.temporaryCoins = 0;
    run.conquered.push(run.stage);
    run.phase = "reward";
    if (run.bosses.includes(run.stage)) {
      const unowned = availableRelicsFor(run);
      run.relicRewards = shuffle(run, unowned).slice(0, 3);
    } else {
      run.rewards = combatRewards(run);
    }
  }
  return { debtDamage, debtPaid };
}

export function endTurn(run: Run) {
  if (run.phase !== "player" || run.rightEffects.pendingDiscards) return false;
  const effects = run.rightEffects;
  if (!effects.damagedRival && effects.moralWithoutDamage) {
    run.moral = Math.max(0, run.moral - effects.moralWithoutDamage);
    if (!run.moral) {
      run.phase = "lost";
      return true;
    }
  }
  run.electionActive = false;
  run.turnStrength = 0;
  run.turnEndGuard = run.guard;
  run.firstCardLocked = false;
  run.lockedCardType = undefined;
  run.discard.push(...run.hand);
  run.hand = [];
  run.phase = "rivals";
  return true;
}

export function rivalAct(run: Run, id: string) {
  const rival = run.rivals.find((item) => item.id === id);
  if (run.phase !== "rivals" || !rival?.moral || rival.step >= run.turn)
    return null;
  const living = run.rivals.filter(({ moral }) => moral > 0);
  const intent = rivalIntent(run, rival, true);
  if (intent.kind === "attack" && run.rightEffects.weakenAttack) {
    intent.value = Math.max(0, intent.value - run.rightEffects.weakenAttack);
    run.rightEffects.weakenAttack = 0;
  }
  rival.guard = 0;
  const result =
    intent.kind === "attack"
      ? hit(run, intent.value)
      : { damage: 0, absorbed: 0, guardBroken: false };
  if (intent.kind === "guard") rival.guard = intent.value;
  if (intent.kind === "rally") rival.bonus += intent.value;
  if (intent.kind === "teamGuard") {
    for (const ally of living) ally.guard += intent.value;
  }
  if (intent.kind === "heal") {
    const ally = living.reduce((mostHurt, candidate) =>
      candidate.maxMoral - candidate.moral > mostHurt.maxMoral - mostHurt.moral ? candidate : mostHurt);
    ally.moral = Math.min(ally.maxMoral, ally.moral + intent.value);
  }
  if (intent.kind === "summon") {
    const moral = Math.max(1, Math.round(intent.value * difficulties[run.difficulty].moral));
    run.rivals.push({ ...mtstReinforcement, moral, maxMoral: moral, guard: 0, bonus: 0, step: run.turn });
    rival.specialUsed = true;
  }
  if (intent.kind === "doubleGuard") {
    rival.guard = intent.value;
    rival.specialUsed = true;
  }
  if (intent.kind === "jingle") {
    for (const ally of living) ally.bonus += intent.value;
  }
  if (intent.kind === "research") {
    rival.campaignResponse = run.attackCardsPlayed > run.defenseCardsPlayed ? "guard" : "attack";
  }
  const blocked = (intent.kind === "stamp" || intent.kind === "injunction") && run.rightEffects.blockDebuff;
  if (blocked) run.rightEffects.blockDebuff = false;
  else if (intent.kind === "stamp") run.firstCardLocked = true;
  else if (intent.kind === "injunction") run.lockedCardType = injunctionType(rival.step);
  rival.step++;
  if (!run.moral) run.phase = "lost";
  return { intent, blocked, ...result };
}

export function finishRivals(run: Run) {
  if (
    run.phase === "rivals" &&
    run.rivals.every(({ moral, step }) => !moral || step >= run.turn)
  ) {
    const { bombonsUsed, weakenAttack, nextMoralCost, delayed } = run.rightEffects;
    run.rightEffects = { ...newRightEffects(), bombonsUsed, weakenAttack };
    run.moral = Math.max(0, run.moral - nextMoralCost);
    const damage = run.moral ? delayed.flatMap(({ id, damage }) => {
      const target = run.rivals.find((rival) => rival.id === id && rival.moral > 0);
      return target ? [{ id, ...hitRival(target, damage) }] : [];
    }) : [];
    const settlement = settleCombat(run);
    if (run.phase === "rivals") {
      startTurn(run);
      run.rightEffects.damagedRival = damage.some((impact) => impact.damage > 0);
    }
    return { damage, moralCost: nextMoralCost, ...settlement };
  }
}

export function claimReward(run: Run, reward?: CardId) {
  if (run.phase !== "reward" || (reward && !run.rewards.includes(reward)))
    return false;
  if (reward) {
    run.deck.push(reward);
    run.rewardHistory.push(reward);
  }
  run.rewards = [];
  run.relicRewards = [];
  run.phase = run.stage === boss ? "won" : "map";
  return true;
}

export function claimRelicReward(run: Run, relic: RelicId) {
  if (run.phase !== "reward" || !run.relicRewards.includes(relic)) return false;
  run.relics.push(relic);
  return claimReward(run);
}

export function confirmDestination(run: Run, stage: number) {
  const destinations = availableDestinations(run);
  if (destinations.length !== 2 || !destinations.includes(stage)) return false;
  const index = run.conquered.length;
  run.order = [...run.order.slice(0, index), stage, ...run.order.slice(index + 2)];
  run.confirmedDestination = stage;
  return true;
}

export function chooseDestination(run: Run, stage: number) {
  if (!availableDestinations(run).includes(stage)) return false;
  confirmDestination(run, stage);
  run.confirmedDestination = undefined;
  run.stage = stage;
  startEncounter(run);
  return true;
}

export function resolveEvent(run: Run, choice: "risk" | "rest") {
  if (run.phase !== "event" || run.eventResult) return false;
  const previousMoral = run.moral;
  run.eventResult = choice === "rest" ? "rest" : roll(run) < EVENT_CHANCE / 100 ? "profit" : "injury";
  if (run.eventResult === "rest") run.moral = Math.min(MAX_MORAL, run.moral + EVENT_RECOVERY);
  if (run.eventResult === "profit") run.money += EVENT_PRIZE;
  if (run.eventResult === "injury") run.moral = Math.max(0, run.moral - EVENT_DAMAGE);
  run.eventMoralDelta = run.moral - previousMoral;
  if (run.moral > 0) run.conquered.push(run.stage);
  else run.phase = "lost";
  return true;
}

export function eventCardOptions(run: Run) {
  const kind = currentEvent(run)?.special?.kind;
  if (kind === "remove" && run.deck.length > 1) return run.deck.map((_, index) => index);
  if (kind === "upgrade") return run.deck.flatMap((id, index) => id.endsWith("+") || cardDefinition(id).election ? [] : [index]);
  return [];
}

export function canResolveSpecialEvent(run: Run) {
  if (run.phase !== "event" || run.eventResult) return false;
  const kind = currentEvent(run)?.special?.kind;
  if (kind === "relic") return availableRelicsFor(run).length > 0;
  return eventCardOptions(run).length > 0;
}

export function resolveSpecialEvent(run: Run, cardIndex?: number) {
  if (!canResolveSpecialEvent(run)) return false;
  const kind = currentEvent(run).special!.kind;
  if (kind === "relic") {
    const available = availableRelicsFor(run);
    const id = available[Math.floor(roll(run) * available.length)];
    run.relics.push(id);
    run.eventReward = relics[id].name;
    run.eventItemImage = relics[id].image;
  } else {
    if (cardIndex === undefined || !eventCardOptions(run).includes(cardIndex)) return false;
    const card = run.deck[cardIndex];
    if (kind === "remove") {
      run.deck.splice(cardIndex, 1);
      run.eventReward = `${cardDefinition(card).name} removida`;
    } else {
      const upgraded = `${card as CardId}+` as const;
      run.deck[cardIndex] = upgraded;
      run.eventReward = `${cardDefinition(upgraded).name} · Nível 2`;
    }
  }
  run.eventResult = "special";
  run.conquered.push(run.stage);
  return true;
}

export function finishEvent(run: Run) {
  if (run.phase !== "event" || !run.eventResult) return false;
  run.phase = "map";
  return true;
}

const shopPrices: Partial<Record<CardId, number>> = {
  megaphone: 65,
  minhaCasa: 75,
  delegate: 80,
};

function stockShop(run: Run) {
  run.shopRemovedCard = false;
  const random = { seed: (run.seed ^ 0x9e3779b9 ^ run.stage) >>> 0 };
  const hero = heroes[run.hero];
  const pool = hero.faction === "right" ? rightRewardPool : rewardPool;
  const candidates = shuffle(random, pool);
  const variety = (["offensive", "defensive", "tactical"] as const).flatMap((type) => {
    const card = candidates.find((id) => cardType(cardDefinition(id)) === type);
    return card ? [card] : [];
  });
  const selection = [...new Set([...variety, ...candidates])].slice(0, 3);
  run.shopOffers = selection.map((card) => ({ card, price: shopPrices[card] ?? 55, sold: false }));
  const availableRelics = availableRelicsFor(run);
  const availableConsumables = (Object.keys(consumables) as ConsumableId[]).filter((id) =>
    hero.faction === "left" || !leftBuildConsumables.includes(id));
  run.itemOffers = [
    ...shuffle(random, availableRelics).slice(0, 3).map((id) => ({ kind: "relic" as const, id, sold: false })),
    ...availableConsumables.map((id) => ({ kind: "consumable" as const, id, sold: false })),
  ];
  run.phase = "shop";
}

export function buyShopCard(run: Run, card: CardId) {
  if (run.phase !== "shop") return false;
  const offer = run.shopOffers.find((item) => item.card === card);
  if (!offer || offer.sold || run.money < offer.price) return false;
  run.money -= offer.price;
  run.deck.push(offer.card);
  offer.sold = true;
  return true;
}

export function canRemoveShopCard(run: Run) {
  return run.phase === "shop" && !run.shopRemovedCard && run.money >= SHOP_REMOVAL_PRICE && run.deck.length > 1;
}

export function removeShopCard(run: Run, index: number) {
  if (!canRemoveShopCard(run) || !Number.isInteger(index) || !run.deck[index]) return false;
  run.deck.splice(index, 1);
  run.money -= SHOP_REMOVAL_PRICE;
  run.shopRemovedCard = true;
  return true;
}

export function leaveShop(run: Run) {
  if (run.phase !== "shop") return false;
  run.conquered.push(run.stage);
  run.phase = "map";
  return true;
}

export function buyShopItem(run: Run, index: number) {
  const offer = run.itemOffers[index];
  if (run.phase !== "shop" || !offer || offer.sold) return false;
  const item = offer.kind === "relic" ? relics[offer.id] : consumables[offer.id];
  if (run.money < item.price) return false;
  if (offer.kind === "relic") {
    if (run.relics.includes(offer.id)) return false;
    run.relics.push(offer.id);
  } else {
    if (run.consumables.length >= consumableSlots) return false;
    run.consumables.push(offer.id);
  }
  run.money -= item.price;
  offer.sold = true;
  return true;
}

export function canUseConsumable(run: Run, index: number) {
  const item = run.consumables[index];
  return run.phase === "player" && !!item && (item !== "picanha" || run.moral < MAX_MORAL);
}

export function useConsumable(run: Run, index: number) {
  const item = run.consumables[index];
  if (!canUseConsumable(run, index)) return false;
  run.consumables.splice(index, 1);
  switch (item) {
    case "cafe": run.energy++; break;
    case "regimento": run.guard += 8; break;
    case "marmita":
      run.moral = Math.min(MAX_MORAL, run.moral + 5);
      run.guard += 6;
      break;
    case "megafone":
      run.turnStrength += 2;
      run.gainedStrength = true;
      updateStrengthRelic(run);
      break;
    case "verba": run.temporaryCoins += 15; break;
    case "picanha": run.moral = Math.min(MAX_MORAL, run.moral + 8); break;
  }
  return true;
}
