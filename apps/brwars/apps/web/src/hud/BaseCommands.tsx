import { HotkeyLabel } from '../HotkeyLabel';
import { hotkeyAttributes } from '../command-hotkeys';
import {
  BASE_PRODUCTION,
  BASE_QUEUE_LIMIT,
  WORKER_COST,
  productionFactor,
  unitTrainingMultiplier,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { Coins } from '@phosphor-icons/react';
import { HeroRecruitmentActions } from '../HeroRecruitmentActions';
import { RecruitmentBadges } from '../RecruitmentBadges';
import { UnitPortrait } from '../UnitPortrait';
import type { SelectionContext } from './context';
import { money } from './format';

export function BaseCommands({
  game,
  context,
  side,
  send,
}: {
  game: GameState;
  context: SelectionContext;
  side: Side;
  send: (command: Command) => void;
}) {
  const { entity, own, playing } = context;
  let commands;
  if (entity.kind === 'base') {
    commands = (
      <div className="command-grid base-commands">
        <button
          className="command-button economy-command recruitment-card worker-recruitment-card"
          data-low-cash={own.cash < WORKER_COST}
          data-resource-shortage={
            playing && own.cash < WORKER_COST && (own.trainingQueue?.length ?? 0) < BASE_QUEUE_LIMIT
          }
          disabled={
            !playing ||
            own.cash < WORKER_COST ||
            (own.trainingQueue?.length ?? 0) >= BASE_QUEUE_LIMIT
          }
          {...hotkeyAttributes('r')}
          onClick={() => send({ type: 'worker' })}
          data-hud-tooltip="Trabalhador: 5s de treinamento, +R$ 3/s. Permanece no território."
        >
          <RecruitmentBadges
            seconds={Math.ceil(
              BASE_PRODUCTION.worker /
                (productionFactor(own) * unitTrainingMultiplier(own, 'worker')),
            )}
            population={1}
          />

          <UnitPortrait side={side} kind="worker" />
          <strong>
            <HotkeyLabel label="Trabalhador" hotkey="r" />
          </strong>
          <span>
            <Coins size={12} />
            {money(WORKER_COST)}
          </span>
        </button>
        <HeroRecruitmentActions game={game} side={side} send={send} />
      </div>
    );
  } else {
    commands = null;
  }
  return commands;
}
