import {
  BASE_QUEUE_LIMIT,
  FACTIONS,
  MEDIC,
  productionFactor,
  unitTrainingMultiplier,
  type Building,
  type Player,
  type Side,
  type Command,
} from '@brwars/simulation';
import { Coins } from '@phosphor-icons/react';
import { HotkeyLabel } from '../HotkeyLabel';
import { hotkeyAttributes } from '../command-hotkeys';
import { RecruitmentBadges } from '../RecruitmentBadges';
import { UnitPortrait } from '../UnitPortrait';
import { money } from './format';
export function MedicRecruitmentAction({
  building,
  player: own,
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
  return (
    <button
      className="command-button economy-command recruitment-card"
      data-low-cash={own.cash < MEDIC.cost}
      data-resource-shortage={
        playing && own.cash < MEDIC.cost && (building.medicQueue?.length ?? 0) < BASE_QUEUE_LIMIT
      }
      disabled={
        !playing || own.cash < MEDIC.cost || (building.medicQueue?.length ?? 0) >= BASE_QUEUE_LIMIT
      }
      {...hotkeyAttributes('c')}
      onClick={() => send({ type: 'medic', slot: building.slot })}
      data-hud-tooltip={`${FACTIONS[side].units.medic} · cura 5 PV em um aliado por ciclo de 1s, raio 140. Prioriza o aliado mais ferido.`}
    >
      <RecruitmentBadges
        seconds={Math.ceil(
          MEDIC.duration / (productionFactor(own) * unitTrainingMultiplier(own, 'medic')),
        )}
        population={MEDIC.population}
      />

      <UnitPortrait side={side} kind="medic" />
      <strong>
        <HotkeyLabel label={FACTIONS[side].units.medic} hotkey="c" />
      </strong>
      <span>
        <Coins size={12} />
        {money(MEDIC.cost)}
      </span>
    </button>
  );
}
