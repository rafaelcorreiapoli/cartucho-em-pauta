import { COMBAT_LEVEL_BONUS, opposite, type Side, type UnitKind } from './content';
import { HEROES, heroIdentity, type HeroKind } from './heroes';
import type { GameState, Player, Unit } from './model';
export interface HeroRecord {
  hero: HeroKind;
  level: number;
  xp: number;
  revivals: number;
  status: 'training' | 'alive' | 'dead' | 'reviving';
}
export interface HeroRevival {
  hero: HeroKind;
  slot: number;
  progress: number;
  duration: number;
  cost: number;
  populationReserved: boolean;
}
export const MAX_HERO_LEVEL = 100;
export const HERO_XP_RADIUS = 160;
export function heroXpThreshold(level: number) {
  let total = 0;
  for (let n = 1; n < Math.min(MAX_HERO_LEVEL, level); n++) total += 100 + (n - 1) * 50;
  return total;
}
export function heroLevelHealthMultiplier(level: number) {
  return 1 + 0.12 * (level - 1);
}
export function unitLevelDamageMultiplier(kind: UnitKind, level: number) {
  return 1 + (level - 1) * (kind === 'hero' ? 0.1 : COMBAT_LEVEL_BONUS);
}
export function heroRecord(player: Player, hero: HeroKind) {
  return player.heroes?.find((record) => record.hero === hero);
}
export function createHeroRecord(
  hero: HeroKind,
  level = 1,
  status: HeroRecord['status'] = 'alive',
): HeroRecord {
  level = Math.max(1, Math.min(MAX_HERO_LEVEL, level));
  return { hero, level, xp: heroXpThreshold(level), revivals: 0, status };
}
/** Keeps already-running local matches and old direct spawns compatible with the persistent roster. */
export function normalizeHeroes(game: GameState, side: Side) {
  const p = game.players[side];
  p.heroes ??= [];
  p.heroRevivals ??= [];
  for (const unit of game.units)
    if (unit.side === side && unit.kind === 'hero' && !heroRecord(p, heroIdentity(unit)))
      p.heroes.push(createHeroRecord(heroIdentity(unit), unit.level));
  for (const order of p.trainingQueue ?? [])
    if (order.kind === 'hero') {
      const hero = order.hero ?? (side === 'left' ? 'jones' : 'mamaefalei');
      if (!heroRecord(p, hero)) p.heroes.push(createHeroRecord(hero, 1, 'training'));
    }
}
export function heroRevivalQuote(player: Player, hero: HeroKind) {
  const record = heroRecord(player, hero);
  return {
    cost: 240 + 60 * (Math.max(1, Math.min(MAX_HERO_LEVEL, record?.level ?? 1)) - 1),
    duration: 8,
  };
}
export function markHeroDead(game: GameState, unit: Unit) {
  if (unit.kind !== 'hero') return;
  const p = game.players[unit.side];
  normalizeHeroes(game, unit.side);
  const record = heroRecord(p, heroIdentity(unit))!;
  record.status = 'dead';
  record.level = unit.level;
}
export function awardKillExperience(game: GameState, victim: Unit) {
  const side = opposite(victim.side),
    p = game.players[side];
  normalizeHeroes(game, side);
  const recipients = game.units
    .filter(
      (u) =>
        u.side === side &&
        u.kind === 'hero' &&
        u.hp > 0 &&
        u.level < MAX_HERO_LEVEL &&
        Math.abs(u.x - victim.x) <= HERO_XP_RADIUS,
    )
    .sort((a, b) => a.id - b.id);
  if (!recipients.length) return;
  const base = { front: 25, ranged: 30, siege: 60, hero: 120, medic: 35 }[victim.kind],
    pool = Math.round(base * (1 + 0.15 * (victim.level - 1)));
  recipients.forEach((unit, index) => {
    const record = heroRecord(p, heroIdentity(unit))!,
      previous = unit.level;
    record.xp = Math.min(
      heroXpThreshold(MAX_HERO_LEVEL),
      record.xp + Math.floor(pool / recipients.length) + (index < pool % recipients.length ? 1 : 0),
    );
    while (record.level < MAX_HERO_LEVEL && record.xp >= heroXpThreshold(record.level + 1))
      record.level++;
    if (record.level > previous) {
      const ratio = heroLevelHealthMultiplier(record.level) / heroLevelHealthMultiplier(previous);
      unit.level = record.level;
      unit.maxHp *= ratio;
      unit.hp *= ratio;
      game.log.unshift({
        id: game.nextId++,
        text: `${HEROES[record.hero].name} chegou ao nível ${record.level}!`,
      });
      game.log.length = Math.min(game.log.length, 6);
    }
  });
}
