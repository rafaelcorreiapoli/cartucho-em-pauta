import { GLOBAL_POWERS, SIDES, opposite, type Side } from '../content';
import { medicDestination, stepHealing } from '../healing';
import { auraModifiers, unitAuraSources, unitAuras } from '../hero-auras';
import { awardKillExperience, markHeroDead, unitLevelDamageMultiplier } from '../hero-progression';
import { unitStats } from '../heroes';
import type { GameState, Unit } from '../model';
import { baseDamageMultiplier, movementMultiplier, unitAttackMultiplier } from '../research';
import { baseWeaponStats, stepStructureWeapon } from '../structure-combat';

export function stepCombat(game: GameState, dt: number) {
  const damage = new Map<number, number>();
  const baseDamage: Record<Side, number> = { left: 0, right: 0 };
  const auraSources = unitAuraSources(game),
    modifiers = new Map(
      game.units.map((unit) => [unit.id, auraModifiers(unitAuras(game, unit, auraSources))]),
    );
  const armies = {
    left: game.units.filter((u) => u.side === 'left'),
    right: game.units.filter((u) => u.side === 'right'),
  };
  for (const u of game.units) {
    const stats = unitStats(u),
      mods = modifiers.get(u.id)!,
      range = stats.range * mods.range;
    u.cooldown = Math.max(0, u.cooldown - dt);
    u.attacking = false;
    if (u.kind === 'medic') {
      const destination = medicDestination(game, u);
      u.x +=
        Math.sign(destination - u.x) *
        Math.min(
          Math.abs(destination - u.x),
          stats.speed * mods.speed * movementMultiplier(game.players[u.side], u.kind) * dt,
        );
      continue;
    }
    const enemies = armies[opposite(u.side)];
    let target: Unit | undefined;
    let distance = Infinity;
    for (const enemy of enemies) {
      const d = Math.abs(enemy.x - u.x);
      if (d < distance) {
        distance = d;
        target = enemy;
      }
    }
    const enemyBase = u.side === 'left' ? 920 : 80;
    const inBaseRange = Math.abs(enemyBase - u.x) <= range;
    if ((target && distance <= range) || inBaseRange) {
      u.attacking = (u.silencedUntil ?? 0) <= game.time;
      if (u.cooldown <= 0 && (u.silencedUntil ?? 0) <= game.time) {
        const hit =
          stats.damage *
          unitLevelDamageMultiplier(u.kind, u.level) *
          mods.damage *
          unitAttackMultiplier(game.players[u.side], u.kind) *
          ((u.strengthUntil ?? 0) > game.time ? GLOBAL_POWERS.strength.multiplier : 1);
        const victim = target && distance <= range ? target : undefined;
        game.hits.push({
          id: game.nextId++,
          time: game.time,
          kind: u.kind === 'ranged' ? 'ranged' : u.kind === 'siege' ? 'siege' : 'melee',
          side: u.side,
          sourceId: u.id,
          sourceX: u.x,
          sourceRow: u.row,
          targetX: victim?.x ?? enemyBase,
          targetRow: victim?.row ?? 2,
          targetId: victim?.id ?? 0,
          damage: hit,
        });
        if (target && distance <= range) damage.set(target.id, (damage.get(target.id) ?? 0) + hit);
        else baseDamage[opposite(u.side)] += hit * (u.kind === 'siege' ? 2 : 1);
        u.cooldown = stats.interval / mods.attackSpeed;
      }
    } else
      u.x +=
        (u.side === 'left' ? 1 : -1) *
        stats.speed *
        mods.speed *
        movementMultiplier(game.players[u.side], u.kind) *
        dt;
  }
  for (const side of SIDES) {
    const p = game.players[side];
    if (p.baseHp > 0)
      p.baseAttackCooldown = stepStructureWeapon(
        game,
        side,
        {
          id: side === 'left' ? -1 : -2,
          type: 'base',
          slot: -1,
          x: side === 'left' ? 80 : 920,
          row: 2,
        },
        baseWeaponStats(p),
        p.baseAttackCooldown ?? 0,
        dt,
        damage,
      );
  }
  if (game.hits.length > 80) game.hits.splice(0, game.hits.length - 80);
  for (const u of game.units) {
    u.hp -= (damage.get(u.id) ?? 0) * (modifiers.get(u.id)?.damageTaken ?? 1);
  }
  for (const u of game.units.filter((u) => u.hp <= 0)) {
    game.players[opposite(u.side)].kills++;
    markHeroDead(game, u);
    awardKillExperience(game, u);
  }
  game.units = game.units.filter((u) => u.hp > 0);
  stepHealing(game, dt);
  for (const side of SIDES) {
    game.players[side].baseHp = Math.max(
      0,
      game.players[side].baseHp - baseDamage[side] * baseDamageMultiplier(game.players[side]),
    );
  }
}
