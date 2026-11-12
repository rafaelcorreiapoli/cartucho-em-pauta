import { COMBAT_LEVEL_BONUS, spawnPosition, type Side, type UnitKind } from './content';
import { createHeroRecord, heroLevelHealthMultiplier, heroRecord } from './hero-progression';
import { DEFAULT_HERO, HEROES, type HeroKind } from './heroes';
import type { GameState } from './model';
import { canStartProduction } from './population';
import { unitHealthMultiplier } from './research';

import { troopStats, type ProductionTier } from './production-catalog';

export function spawnUnit(
  game: GameState,
  side: Side,
  kind: UnitKind,
  level = 1,
  reserved = false,
  hero: HeroKind = DEFAULT_HERO[side],
  productionTier: ProductionTier = 0,
) {
  if (!reserved && !canStartProduction(game, side, kind, productionTier)) return false;
  if (kind === 'medic') level = 1;
  if (kind === 'hero') {
    const p = game.players[side];
    p.heroes ??= [];
    let record = heroRecord(p, hero);
    if (!record) {
      record = createHeroRecord(hero, level);
      p.heroes.push(record);
    }
    record.status = 'alive';
    level = record.level;
  }
  const stats = kind === 'hero' ? HEROES[hero] : troopStats(kind, productionTier);
  const maxHp =
    stats.hp *
    (kind === 'hero' ? heroLevelHealthMultiplier(level) : 1 + (level - 1) * COMBAT_LEVEL_BONUS) *
    unitHealthMultiplier(game.players[side]);
  const id = game.nextId++;
  game.units.push({
    ...(productionTier ? { productionTier } : {}),
    ...(kind === 'hero' ? { hero } : {}),
    id,
    side,
    kind,
    x: spawnPosition(side),
    hp: maxHp,
    maxHp,
    level,
    cooldown: 0.5,
    attacking: false,
    silencedUntil: 0,
    strengthUntil: 0,
    row: id % 5,
  });
  return true;
}
