import { opposite, type Side } from './content';
import type { GameState, Player } from './model';
import { constructionMultiplier, researchQuote } from './research';
import { BASE_ARTILLERY_DAMAGE_PER_LEVEL } from './research-effects';
export interface StructureWeapon {
  damage: number;
  range: number;
  interval: number;
}
export interface StructureAttackSource {
  id: number;
  type: 'base' | 'building';
  slot: number;
  x: number;
  row: number;
}
export const BASE_WEAPON = {
  damage: 65,
  damagePerLevel: BASE_ARTILLERY_DAMAGE_PER_LEVEL,
  range: 150,
  interval: 1.3,
  maxLevel: 4,
} as const;
export function baseWeaponStats(player: Player): StructureWeapon {
  return {
    damage: BASE_WEAPON.damage + ((player.baseAttackLevel ?? 1) - 1) * BASE_WEAPON.damagePerLevel,
    range: BASE_WEAPON.range,
    interval: BASE_WEAPON.interval,
  };
}
export function stepBaseAttackUpgrade(player: Player, dt: number, instant = false) {
  if (!player.baseAttackUpgrading) return;
  player.baseAttackUpgradeProgress = Math.min(
    1,
    (player.baseAttackUpgradeProgress ?? 0) +
      (dt * constructionMultiplier(player)) / researchQuote(player, 'base_artillery').duration,
  );
  if (instant || player.baseAttackUpgradeProgress >= 1 - 1e-8) {
    player.baseAttackLevel = (player.baseAttackLevel ?? 1) + 1;
    player.baseAttackUpgrading = false;
    player.baseAttackUpgradeProgress = 0;
  }
}
/** Structure weapons share targeting and hit events with units; damage resolves simultaneously. */
export function stepStructureWeapon(
  game: GameState,
  side: Side,
  source: StructureAttackSource,
  weapon: StructureWeapon,
  cooldown: number,
  dt: number,
  damage: Map<number, number>,
) {
  const remaining = Math.max(0, cooldown - dt);
  if (remaining > 1e-8) return remaining;
  const target = game.units
    .filter(
      (unit) =>
        unit.side === opposite(side) && unit.hp > 0 && Math.abs(unit.x - source.x) <= weapon.range,
    )
    .sort((a, b) => Math.abs(a.x - source.x) - Math.abs(b.x - source.x) || a.id - b.id)[0];
  if (!target) return 0;
  damage.set(target.id, (damage.get(target.id) ?? 0) + weapon.damage);
  game.hits.push({
    id: game.nextId++,
    time: game.time,
    kind: 'ranged',
    side,
    sourceId: source.id,
    sourceType: source.type,
    sourceSlot: source.slot,
    sourceX: source.x,
    sourceRow: source.row,
    targetX: target.x,
    targetRow: target.row,
    targetId: target.id,
    damage: weapon.damage,
  });
  return weapon.interval;
}
