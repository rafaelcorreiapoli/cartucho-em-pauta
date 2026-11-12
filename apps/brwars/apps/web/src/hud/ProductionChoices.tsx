import {
  automaticProductionSpeed,
  productionSpec,
  PRODUCTION_TIERS,
  TIER_LEVEL,
  troopName,
  troopAura,
  auraDescription,
  type Building,
  type Command,
  type Player,
  type Side,
} from '@brwars/simulation';
import { Check, Coins, LockSimple } from '@phosphor-icons/react';
import { detailAttributes } from '../DetailTooltip';
import { RecruitmentBadges } from '../RecruitmentBadges';
import { UnitPortrait } from '../UnitPortrait';
import { money } from './format';

export function ProductionChoices({
  building,
  player,
  side,
  playing,
  send,
}: {
  building: Building;
  player: Player;
  side: Side;
  playing: boolean;
  send: (command: Command) => void;
}) {
  return PRODUCTION_TIERS.map((tier) => {
    const spec = productionSpec(building, tier);
    if (!spec) return null;
    const name = troopName(side, spec.kind, tier);
    const aura = troopAura({ kind: spec.kind, productionTier: tier });
    const required = TIER_LEVEL[tier];
    const locked = building.level < required;
    const selected = (building.productionTier ?? 0) === tier;
    const active = building.populationReserved && (building.activeTier ?? 0) === tier;
    return (
      <button
        key={tier}
        className={`command-button economy-command recruitment-card production-choice ${locked ? 'requirement-locked' : ''}`}
        aria-label={
          locked ? `${name}, libera no nível ${required}` : `Produzir ${name} automaticamente`
        }
        aria-pressed={selected}
        data-low-cash={player.cash < spec.cost}
        disabled={!playing || locked}
        onClick={() => send({ type: 'select-production', slot: building.slot, tier })}
        {...detailAttributes({
          title: name,
          subtitle: locked
            ? `Libera no NV. ${required}`
            : active
              ? 'Em produção'
              : selected
                ? 'Escolhida para o próximo pedido'
                : 'Selecionar para produção automática',
          footnote: aura
            ? `${aura.name} · ${auraDescription(aura)} · raio ${aura.radius}`
            : undefined,
          stats: [
            { label: 'VIDA BASE', value: String(spec.stats.hp) },
            { label: 'DANO BASE', value: String(spec.stats.damage) },
            { label: 'ALCANCE', value: String(spec.stats.range) },
            { label: 'MOVIMENTO', value: String(spec.stats.speed) },
            {
              label: 'INTERVALO DE ATAQUE',
              value: `${spec.stats.interval.toLocaleString('pt-BR')}s`,
            },
          ],
        })}
      >
        <RecruitmentBadges
          seconds={Math.ceil(spec.duration / automaticProductionSpeed(player, spec.kind))}
          population={spec.population}
        />
        <UnitPortrait side={side} kind={spec.kind} tier={tier} />
        <strong>{name}</strong>
        <span>
          {locked ? (
            <>
              <LockSimple /> NV. {required}
            </>
          ) : (
            <>
              {selected ? <Check weight="bold" /> : <Coins />} {money(spec.cost)}
            </>
          )}
        </span>
      </button>
    );
  });
}
