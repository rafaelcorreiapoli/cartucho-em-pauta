import { GLOBAL_POWERS, type BuildingKind, type GlobalPowerKind } from './content';
import type { Player } from './model';
import { researchLevel } from './research-effects';

export const GLOBAL_POWER_REQUIREMENTS: Record<GlobalPowerKind, readonly BuildingKind[]> = {
  bills: ['bank'],
  recall: ['school'],
  silence: ['civic'],
  strength: ['academy', 'hospital'],
  sabotage: ['bank', 'academy'],
};
export function globalPowerUnlockRequirements(player: Player, kind: GlobalPowerKind) {
  return GLOBAL_POWER_REQUIREMENTS[kind].map((building) => ({
    building,
    met: player.buildings.some(
      (candidate) => candidate.kind === building && candidate.constructionProgress >= 1,
    ),
  }));
}
export function isGlobalPowerUnlocked(player: Player, kind: GlobalPowerKind) {
  return player.unlockedPowers?.includes(kind) ?? false;
}
/** Unlocks survive spending popularity and demolition for the rest of the match. */
export function unlockGlobalPowers(player: Player) {
  player.unlockedPowers ??= [];
  for (const kind of Object.keys(GLOBAL_POWERS) as GlobalPowerKind[])
    if (
      !isGlobalPowerUnlocked(player, kind) &&
      globalPowerUnlockRequirements(player, kind).every((requirement) => requirement.met)
    )
      player.unlockedPowers.push(kind);
}
export function globalPowerQuote(player: Player, kind: GlobalPowerKind) {
  const spec = GLOBAL_POWERS[kind];
  return {
    cost: Math.ceil(spec.cost * (1 - 0.1 * researchLevel(player, 'spell_threshold'))),
    cooldown: spec.cooldown * (1 - 0.1 * researchLevel(player, 'spell_cooldown')),
  };
}
