import { stepHospitals } from './hospital';
import { unlockGlobalPowers } from '../spell-rules';
import { GLOBAL_POWERS, SIDES, type GlobalPowerKind, type Side } from '../content';
import { stepFinance } from '../finance';
import { finish } from '../game-state';
import { normalizeHeroes } from '../hero-progression';
import { type HeroKind } from '../heroes';
import type { GameState } from '../model';
import { stepResearch } from '../research';
import { stepBaseAttackUpgrade } from '../structure-combat';
import { stepBuildings } from './buildings';
import { stepCombat } from './combat';
import { stepRecruitment } from './production';

export function step(game: GameState, dt: number, instantConstructionSide?: Side) {
  if (game.status !== 'playing' || !Number.isFinite(dt) || dt <= 0 || dt > 0.25) return;
  game.time += dt;
  game.powers = (game.powers ?? []).filter((power) => game.time - power.time < 3);
  game.hits = game.hits.filter((hit) => game.time - hit.time < 1.5);
  for (const side of SIDES) {
    const p = game.players[side];
    const instantConstruction = side === instantConstructionSide;
    normalizeHeroes(game, side);
    p.popularity ??= 0;
    p.powerCooldowns ??= { bills: 0, recall: 0, silence: 0, strength: 0, sabotage: 0 };
    for (const kind of Object.keys(GLOBAL_POWERS) as GlobalPowerKind[]) {
      const remaining = Math.max(0, (p.powerCooldowns[kind] ?? 0) - dt);
      p.powerCooldowns[kind] = remaining < 1e-8 ? 0 : remaining;
    }
    stepRecruitment(game, side, dt);
    stepHospitals(game, side, dt);
    stepFinance(game, p, dt);
    stepResearch(game, side, dt);
    stepBaseAttackUpgrade(p, dt, instantConstruction);
    p.heroCooldown = Math.max(0, p.heroCooldown - dt);
    p.heroCooldowns ??= {};
    for (const hero of Object.keys(p.heroCooldowns) as HeroKind[]) {
      const remaining = Math.max(0, (p.heroCooldowns[hero] ?? 0) - dt);
      p.heroCooldowns[hero] = remaining < 1e-8 ? 0 : remaining;
    }
    stepBuildings(game, side, dt, instantConstruction);
    unlockGlobalPowers(p);
  }
  stepCombat(game, dt);
  const leftDead = game.players.left.baseHp <= 0;
  const rightDead = game.players.right.baseHp <= 0;
  if (leftDead || rightDead)
    finish(game, leftDead && rightDead ? 'draw' : leftDead ? 'right' : 'left');
}
