import {
  AURA_STAT_NAMES,
  auraDescription,
  auraTargetLabel,
  HERO_AURAS,
  HEROES,
  heroIdentity,
  isAuraBuff,
  unitAuras,
  troopAura,
  troopName,
  type AuraStat,
  type GameState,
  type Unit,
} from '@brwars/simulation';
import { Heart, Lightning, Shield, Sword, Target, Wind } from '@phosphor-icons/react';
import { detailAttributes } from './DetailTooltip';
const icons: Record<AuraStat, typeof Sword> = {
  damage: Sword,
  damageTaken: Shield,
  range: Target,
  speed: Wind,
  attackSpeed: Lightning,
  healing: Heart,
};
export function UnitEffects({ game, unit }: { game: GameState; unit: Unit }) {
  const effects = [...new Map(unitAuras(game, unit).map((effect) => [effect.id, effect])).values()];
  return (
    <>
      {(unit.strengthUntil ?? 0) > game.time && (
        <span
          className="effect-chip buff"
          data-hud-tooltip="Agora vai! · +100% dano enquanto durar a magia"
        >
          <Sword />
          <em>+100%</em>
        </span>
      )}
      {(unit.silencedUntil ?? 0) > game.time && (
        <span
          className="effect-chip debuff"
          data-hud-tooltip="Modo avião · ataques bloqueados enquanto durar a magia"
        >
          <Lightning />
          <em>×</em>
        </span>
      )}
      {effects.length > 0 && (
        <div className="unit-effect-row" aria-label="Efeitos de área ativos">
          {effects.map((effect) => {
            const Icon = icons[effect.stat];
            const source = game.units.find((unit) => unit.id === effect.sourceId);
            return (
              <span
                key={`${effect.sourceId}-${effect.id}`}
                tabIndex={0}
                className={`effect-chip ${isAuraBuff(effect) ? 'buff' : 'debuff'}`}
                aria-label={`${effect.name}: ${auraDescription(effect)}`}
                {...detailAttributes({
                  title: effect.name,
                  subtitle: effect.hero
                    ? HEROES[effect.hero].name
                    : source && troopName(source.side, source.kind, source.productionTier),
                  stats: [
                    {
                      label: AURA_STAT_NAMES[effect.stat].toUpperCase(),
                      value:
                        effect.stat === 'healing'
                          ? `+${effect.amount} PV/s`
                          : `${effect.amount > 0 ? '+' : '−'}${Math.round(Math.abs(effect.amount) * 100)}%`,
                    },
                    { label: 'ÁREA', value: String(effect.radius) },
                  ],
                  footnote: `${auraTargetLabel(effect)} · somente dentro da área`,
                })}
              >
                <Icon />
                <em>
                  {effect.stat === 'healing'
                    ? `+${effect.amount}`
                    : `${effect.amount > 0 ? '+' : '−'}${Math.round(Math.abs(effect.amount) * 100)}%`}
                </em>
              </span>
            );
          })}
        </div>
      )}
    </>
  );
}

export function UnitPassives({ unit }: { unit: Unit }) {
  const aura = troopAura(unit);
  const skills = unit.kind === 'hero' ? HERO_AURAS[heroIdentity(unit)] : aura ? [aura] : [];
  return (
    <div className="building-selection-actions">
      {skills.map((skill) => {
        const Icon = icons[skill.stat],
          unlocked = unit.level >= skill.level;
        return (
          <button
            key={skill.id}
            className="command-button economy-command"
            disabled={!unlocked}
            aria-label={`${skill.name}, ${unlocked ? 'ativa' : `libera no nível ${skill.level}`}`}
            {...detailAttributes({
              title: skill.name,
              subtitle: unlocked ? 'Passiva ativa' : `Libera no nível ${skill.level}`,
              stats: [
                {
                  label: AURA_STAT_NAMES[skill.stat].toUpperCase(),
                  value: `${skill.amount > 0 ? '+' : '−'}${Math.round(Math.abs(skill.amount) * 100)}%`,
                },
                { label: 'ÁREA', value: String(skill.radius) },
              ],
              footnote: auraTargetLabel(skill),
            })}
          >
            {unit.kind === 'hero' && <em className="research-level-badge">{skill.level}</em>}
            <div className="command-tile-body">
              <Icon />
              <strong>{skill.name}</strong>
            </div>
            <span>{unlocked ? 'Passiva ativa' : `Libera no nível ${skill.level}`}</span>
          </button>
        );
      })}
    </div>
  );
}
