import { FACTIONS, buildingUpgradeBatches, type Player, type Side } from '@brwars/simulation';
import { ArrowFatUp, Coins } from '@phosphor-icons/react';
import type { Session } from '../session';
import { BuildingPortrait } from './portraits';

export function BuildingUpgradeBatches({
  player,
  side,
  send,
}: {
  player: Player;
  side: Side;
  send: Session['send'];
}) {
  const batches = buildingUpgradeBatches(player);
  if (!batches.length) return null;

  return (
    <section
      className="field-upgrade-batches"
      aria-label="Melhorias em lote"
      data-camera-controls
      onKeyDown={(event) => {
        if (event.key === ' ') event.stopPropagation();
      }}
    >
      {batches.map(({ kind, buildings, totalCost }) => {
        const name = FACTIONS[side].buildings[kind];
        const cost = `R$ ${totalCost.toLocaleString('pt-BR')}`;
        return (
          <button
            key={kind}
            type="button"
            aria-label={`Melhorar ${buildings.length} × ${name} em um nível cada por ${cost}`}
            onClick={() => send({ type: 'upgrade-batch', kind })}
          >
            <span className="field-upgrade-art" aria-hidden="true">
              <BuildingPortrait kind={kind} side={side} level={buildings[0]?.level} />
              <b>{buildings.length}×</b>
            </span>
            <span className="field-upgrade-info" aria-hidden="true">
              <strong>{name}</strong>
              <small>
                <Coins size={13} /> {cost}
              </small>
            </span>
            <span className="field-upgrade-action" aria-hidden="true">
              <ArrowFatUp size={16} weight="fill" />
              +1 NV.
            </span>
          </button>
        );
      })}
    </section>
  );
}
