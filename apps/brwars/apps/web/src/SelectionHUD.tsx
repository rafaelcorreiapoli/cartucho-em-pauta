import {
  heroIdentity,
  maxBaseHp,
  upgradeSecondsRemaining,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { CursorClick, Hammer } from '@phosphor-icons/react';
import { ActionPanel } from './ActionPanel';
import { selectionContext } from './hud/context';
import { BasePortrait, BuildingPortrait } from './hud/portraits';
import { HealthReadout } from './hud/readouts';
import { SelectionCommands } from './hud/SelectionCommands';
import { SelectionDetails } from './hud/SelectionDetails';
import { type MapSelection } from './selection';
import './selection-hud.css';
import { UnitPortrait } from './UnitPortrait';
export function SelectionHUD({
  game,
  side,
  selection,
  send,
}: {
  game: GameState;
  side: Side;
  selection: MapSelection;
  send: (command: Command) => void;
}) {
  const context = selectionContext(game, side, selection);
  const { entity, selectedSide, owned, title } = context;
  const portrait =
    entity.kind === 'hero' ? (
      <UnitPortrait side={selectedSide} kind="hero" hero={entity.record.hero} />
    ) : entity.kind === 'worker' ? (
      <UnitPortrait side={selectedSide} kind="worker" />
    ) : entity.kind === 'unit' ? (
      <UnitPortrait
        side={selectedSide}
        kind={entity.unit.kind}
        tier={entity.unit.productionTier}
        hero={entity.unit.kind === 'hero' ? heroIdentity(entity.unit) : undefined}
      />
    ) : entity.kind === 'base' ? (
      <BasePortrait side={selectedSide} />
    ) : entity.kind === 'plot' && entity.building ? (
      <BuildingPortrait
        kind={entity.building.kind}
        side={selectedSide}
        level={entity.building.level}
      />
    ) : (
      <div className="empty-plot">
        {entity.kind === 'empty' ? <CursorClick size={34} /> : <Hammer size={34} />}
      </div>
    );

  const detail = <SelectionDetails game={game} context={context} />;
  const commands = <SelectionCommands game={game} context={context} side={side} send={send} />;
  if (entity.kind === 'plot' && !entity.building && owned)
    return (
      <ActionPanel
        className="metal-panel contextual-commands construction-palette"
        label="Construções disponíveis no terreno selecionado"
      >
        {commands}
      </ActionPanel>
    );

  return (
    <>
      <section
        className={`selection-panel metal-panel contextual-selection activity-panel ${entity.kind === 'base' ? 'base-inspection' : ''}`}
        aria-label="Atividade da seleção"
      >
        <div className="selection-info">
          <div className="selection-description">
            <h1>{title}</h1>
            {entity.kind === 'plot' && entity.building?.upgrading && (
              <div
                className="selected-health"
                role="progressbar"
                aria-label="Melhoria da estrutura"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor((entity.building.upgradeProgress ?? 0) * 100)}
              >
                <span>
                  Melhorando para nível {entity.building.level + 1} ·{' '}
                  {Math.ceil(upgradeSecondsRemaining(entity.building, game.players[entity.side]))}s
                </span>
                <i>
                  <em
                    style={{
                      width: `${(entity.building.upgradeProgress ?? 0) * 100}%`,
                      background: '#e4cb79',
                    }}
                  />
                </i>
              </div>
            )}
            {detail}
          </div>
        </div>
      </section>
      <section className="selection-identity metal-panel" aria-label="Portrait da seleção">
        <div className="identity-portrait">{portrait}</div>
        {entity.kind === 'base' && (
          <HealthReadout
            compact
            value={entity.player.baseHp}
            max={maxBaseHp(game.players[selectedSide])}
          />
        )}
        {entity.kind === 'unit' && (
          <HealthReadout compact value={entity.unit.hp} max={entity.unit.maxHp} />
        )}
      </section>
      <ActionPanel
        className="commands-panel metal-panel contextual-commands"
        label="Comandos da seleção"
      >
        {commands}
      </ActionPanel>
    </>
  );
}
