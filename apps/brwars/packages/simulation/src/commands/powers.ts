import {
  GLOBAL_POWER,
  FACTIONS,
  GLOBAL_POWERS,
  globalPowerName,
  opposite,
  recallPosition,
  type GlobalPowerKind,
  type Side,
} from '../content';
import { addLog } from '../game-state';
import { auraModifiers, unitAuras } from '../hero-auras';
import { awardKillExperience, markHeroDead } from '../hero-progression';
import type { GameState } from '../model';
import {
  globalPowerQuote,
  unlockGlobalPowers,
  isGlobalPowerUnlocked,
  globalPowerUnlockRequirements,
} from '../spell-rules';

export function executePower(
  game: GameState,
  side: Side,
  command: Record<string, unknown>,
): string | null {
  const p = game.players[side];
  const kind = command.kind ?? 'bills';
  if (typeof kind !== 'string' || !Object.hasOwn(GLOBAL_POWERS, kind))
    return 'Poder global inválido.';
  const powerKind = kind as GlobalPowerKind,
    quote = globalPowerQuote(p, powerKind);
  unlockGlobalPowers(p);
  if (!isGlobalPowerUnlocked(p, powerKind))
    return `Requer: ${globalPowerUnlockRequirements(p, powerKind)
      .filter((requirement) => !requirement.met)
      .map((requirement) => FACTIONS[side].buildings[requirement.building])
      .join(' · ')}.`;
  if ((p.powerCooldowns?.[powerKind] ?? 0) > 0) return 'Esta magia está recarregando.';
  if (p.popularity < quote.cost) return 'Popularidade insuficiente.';
  const enemy = game.players[opposite(side)];
  const workers = enemy.workers;
  const workerLoss =
    powerKind === 'sabotage' ? Math.min(workers, 3 + Math.min(2, Math.floor(workers / 10))) : 0;
  const targets =
    powerKind === 'sabotage'
      ? []
      : game.units.filter((unit) =>
          powerKind === 'strength' ? unit.side === side : unit.side !== side,
        );
  if (powerKind === 'sabotage' && !workerLoss) return 'Nenhum trabalhador inimigo disponível.';
  if (powerKind !== 'sabotage' && !targets.length)
    return powerKind === 'strength'
      ? 'Nenhuma tropa aliada em campo.'
      : 'Nenhuma unidade inimiga em campo.';
  p.popularity -= quote.cost;
  p.powerCooldowns ??= { bills: 0, recall: 0, silence: 0, strength: 0, sabotage: 0 };
  p.powerCooldowns[powerKind] = quote.cooldown;
  game.powers ??= [];
  game.powers.push({
    kind: powerKind,
    id: game.nextId++,
    time: game.time,
    side,
    ...(workerLoss > 0 ? { workerLoss } : {}),
    targets: targets.map(({ id, x, row, kind }) => ({ id, x, row, kind })),
  });
  if (workerLoss > 0) {
    enemy.workers -= workerLoss;
    addLog(
      game,
      `${globalPowerName(powerKind, side)}: ${FACTIONS[opposite(side)].name} perdeu ${workerLoss} ${workerLoss === 1 ? 'trabalhador' : 'trabalhadores'}.`,
    );
    return null;
  }
  const protection = new Map(
    targets.map((unit) => [unit.id, auraModifiers(unitAuras(game, unit)).damageTaken]),
  );
  for (const target of targets) {
    if (powerKind === 'bills')
      target.hp -= target.maxHp * GLOBAL_POWER.damageFraction * (protection.get(target.id) ?? 1);
    if (powerKind === 'recall') {
      target.x = recallPosition(target.x, target.side);
      target.attacking = false;
    }
    if (powerKind === 'silence') {
      target.silencedUntil = game.time + GLOBAL_POWERS.silence.duration;
      target.attacking = false;
    }
    if (powerKind === 'strength')
      target.strengthUntil = game.time + GLOBAL_POWERS.strength.duration;
  }
  for (const unit of game.units.filter((unit) => unit.hp <= 0)) {
    p.kills++;
    markHeroDead(game, unit);
    awardKillExperience(game, unit);
  }
  game.units = game.units.filter((unit) => unit.hp > 0);
  addLog(
    game,
    `${side === 'left' ? 'Esquerda' : 'Direita'} invocou ${globalPowerName(powerKind, side)}`,
  );
  return null;
}
