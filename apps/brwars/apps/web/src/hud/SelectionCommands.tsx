import {
  troopAura,
  workerIncome,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { Coins, CursorClick, Shield, Sword } from '@phosphor-icons/react';
import { HeroRevivalActions } from '../HeroRevivalActions';
import { UnitPassives } from '../UnitEffects';
import { BaseCommands } from './BaseCommands';
import { BuildingCommands } from './BuildingCommands';
import { ConstructionCommands } from './ConstructionCommands';
import type { SelectionContext } from './context';
import { money } from './format';

export function SelectionCommands({
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
  const { entity, owned } = context;
  if (entity.kind !== 'empty' && !owned)
    return (
      <div className="selection-command-empty">
        <Shield />
        <strong>Seleção inimiga</strong>
        <small>Informações disponíveis. Comandos restritos à sua civilização.</small>
      </div>
    );
  if (entity.kind === 'plot')
    return entity.building ? (
      <BuildingCommands game={game} context={context} side={side} send={send} />
    ) : (
      <ConstructionCommands context={context} send={send} />
    );
  if (entity.kind === 'base')
    return <BaseCommands game={game} context={context} side={side} send={send} />;
  let commands;
  if (entity.kind === 'empty')
    commands = (
      <div className="selection-command-empty">
        <CursorClick />
        <strong>Selecione um objeto no mapa</strong>
        <small>Terrenos revelam construções. Prédios e unidades revelam suas informações.</small>
      </div>
    );
  else if (entity.kind === 'hero')
    commands = (
      <div className="building-selection-actions">
        <HeroRevivalActions game={game} side={side} hero={entity.record.hero} send={send} />
      </div>
    );
  else if (entity.kind === 'unit' && (entity.unit.kind === 'hero' || troopAura(entity.unit)))
    commands = <UnitPassives unit={entity.unit} />;
  else if (entity.kind === 'worker')
    commands = (
      <div className="selection-command-empty">
        <Coins />
        <strong>Renda automática · +{money(workerIncome(game.players[entity.side]))}/s</strong>
        <small>Selecione a base para recrutar mais trabalhadores.</small>
      </div>
    );
  else {
    commands = (
      <div className="selection-command-empty">
        <Sword />
        <strong>Combate automático</strong>
        <small>
          Esta unidade avança e ataca sozinha. Sua estratégia está na produção e na economia.
        </small>
      </div>
    );
  }
  return commands;
}
