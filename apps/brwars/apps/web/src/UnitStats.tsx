import {
  auraModifiers,
  GLOBAL_POWERS,
  MEDIC,
  movementMultiplier,
  troopPopulation,
  unitAttackMultiplier,
  unitAuras,
  unitLevelDamageMultiplier,
  unitStats,
  type GameState,
  type Unit,
} from '@brwars/simulation';
import { Heart, Star, Sword, Target, UsersThree, Wind } from '@phosphor-icons/react';
export function UnitStats({ game, unit }: { game: GameState; unit: Unit }) {
  const stats = unitStats(unit),
    mods = auraModifiers(unitAuras(game, unit)),
    player = game.players[unit.side];
  const attributes = [
    {
      Icon: unit.kind === 'medic' ? Heart : Sword,
      label: unit.kind === 'medic' ? 'Cura por segundo' : 'Dano',
      value:
        unit.kind === 'medic'
          ? MEDIC.healing
          : Math.round(
              stats.damage *
                mods.damage *
                unitLevelDamageMultiplier(unit.kind, unit.level) *
                unitAttackMultiplier(player, unit.kind) *
                ((unit.strengthUntil ?? 0) > game.time ? GLOBAL_POWERS.strength.multiplier : 1),
            ),
    },
    { Icon: Target, label: 'Alcance', value: Math.round(stats.range * mods.range) },
    {
      Icon: Wind,
      label: 'Velocidade de movimento',
      value: Math.round(stats.speed * mods.speed * movementMultiplier(player, unit.kind)),
    },
    {
      Icon: UsersThree,
      label: 'População ocupada',
      value: troopPopulation(unit.kind, unit.productionTier),
    },
    { Icon: Star, label: 'Nível', value: unit.level },
  ];
  return (
    <div className="selected-stats unit-stats-row" aria-label="Atributos da unidade">
      {attributes.map(({ Icon, label, value }) => (
        <span key={label} tabIndex={0} aria-label={`${label}: ${value}`} data-hud-tooltip={label}>
          <Icon weight="light" />
          <b>{value}</b>
        </span>
      ))}
    </div>
  );
}
