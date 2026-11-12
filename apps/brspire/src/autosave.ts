import { cards, encounters } from "./catalog";
import { difficulties, type Phase, type Run } from "./game";
import { isHeroId, type Faction, type HeroId } from "./heroes";
import type { LobbyStep } from "./lobby";
import { consumables, relics } from "./items";

export const autosaveKey = "brspire.autosave";
const version = 1;
type SaveStorage = Pick<Storage, "getItem" | "setItem">;
const phases: readonly Phase[] = ["map", "player", "rivals", "event", "shop", "reward", "won", "lost"];

export type Autosave = {
  run: Run;
  lobby?: { step: LobbyStep; faction: Faction; selectedHero?: HeroId; previewHero?: HeroId };
  mapSelection?: number;
  eventView?: { pickingCard: boolean };
  selectedCard?: number;
  pendingEndTurn: boolean;
  message: string;
};

function isAutosave(value: unknown): value is Autosave & { version: number } {
  if (!value || typeof value !== "object") return false;
  const save = value as Partial<Autosave> & { version?: number };
  const { run, lobby, eventView } = save;
  if (save.version !== version || typeof save.message !== "string" ||
    typeof save.pendingEndTurn !== "boolean" || !run ||
    typeof run.hero !== "string" || !isHeroId(run.hero) ||
    !Object.hasOwn(difficulties, run.difficulty) || !phases.includes(run.phase) ||
    !Number.isInteger(run.stage) || !encounters[run.stage] ||
    ![run.seed, run.moral, run.money, run.turn, run.energy].every(Number.isFinite) ||
    ![run.routes, run.order, run.events, run.eventIds, run.shops, run.bosses, run.conquered,
      run.encounterHistory, run.deck, run.hand, run.draw, run.discard, run.rivals, run.rewards,
      run.relicRewards, run.rewardHistory, run.consumables, run.relics, run.shopOffers,
      run.itemOffers, run.strengthByUpcomingTurn, run.rightEffects?.delayed].every(Array.isArray)) return false;
  if ((run.routeNumber === null && !run.routes.length) || run.routes.some((route) => !route ||
    ![route.order, route.events, route.eventIds, route.shops, route.bosses].every(Array.isArray)) ||
    (run.routeNumber !== null && (!Number.isInteger(run.routeNumber) || !run.order.length)) ||
    [...run.deck, ...run.hand, ...run.draw, ...run.discard, ...run.rewards].some((id) =>
      typeof id !== "string" || !Object.hasOwn(cards, id.replace(/\+$/, ""))) ||
    run.consumables.some((id) => !Object.hasOwn(consumables, id)) ||
    [...run.relics, ...run.relicRewards].some((id) => !Object.hasOwn(relics, id))) return false;
  if (lobby !== undefined && (!lobby || (lobby.step !== "faction" && lobby.step !== "hero") ||
    (lobby.faction !== "left" && lobby.faction !== "right") ||
    [lobby.selectedHero, lobby.previewHero].some((id) => id !== undefined && !isHeroId(id)))) return false;
  return (eventView === undefined || typeof eventView?.pickingCard === "boolean") &&
    (save.mapSelection === undefined || Number.isInteger(save.mapSelection)) &&
    (save.selectedCard === undefined || Number.isInteger(save.selectedCard));
}

// Keep storage optional: private browsing, a full quota, or stale data should not stop a run.
export function readAutosave(storage: () => SaveStorage = () => localStorage): Autosave | undefined {
  try {
    const raw = storage().getItem(autosaveKey);
    if (raw === null) return;
    const value: unknown = JSON.parse(raw);
    if (isAutosave(value)) return value;
  } catch {
    // Start normally when storage is unavailable or the saved JSON is invalid.
  }
}

export function writeAutosave(save: Autosave, storage: () => SaveStorage = () => localStorage) {
  try {
    storage().setItem(autosaveKey, JSON.stringify({ ...save, version }));
  } catch {
    // The current run remains playable even without persistent storage.
  }
}
