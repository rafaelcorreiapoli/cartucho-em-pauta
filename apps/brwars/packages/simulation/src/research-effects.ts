import type { Player } from './model';
import type { ResearchKind } from './research';
export const BASE_ARTILLERY_DAMAGE_PER_LEVEL = 8;

export function researchLevel(player: Player, kind: ResearchKind) {
  const completed = player.research ?? [];
  if (kind === 'base_artillery') return Math.min(3, (player.baseAttackLevel ?? 1) - 1);
  if (kind === 'mobility')
    return Math.min(
      3,
      Math.max(
        ...['mobility', 'front_mobility', 'ranged_mobility', 'siege_mobility'].map(
          (key) => completed.filter((item) => String(item) === key).length,
        ),
      ),
    );
  return Math.min(3, completed.filter((item) => item === kind).length);
}
export function hasResearch(player: Player, kind: ResearchKind) {
  return researchLevel(player, kind) > 0;
}
