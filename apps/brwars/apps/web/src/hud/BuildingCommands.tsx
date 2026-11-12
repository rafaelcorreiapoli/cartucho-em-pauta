import { buildingUpgradeCost } from '@brwars/simulation';
import { HotkeyLabel } from '../HotkeyLabel';
import { hotkeyAttributes } from '../command-hotkeys';
import {
  BUILDINGS,
  canUpgradeBuilding,
  MAX_BUILDING_LEVEL,
  constructionMultiplier,
  demolitionRefund,
  isBuildingReady,
  isPopularityBuilding,
  isResearchBuilding,
  upgradeDuration,
  upgradeSecondsRemaining,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { ArrowFatUp, ChartLineUp, Pause, Play, Trash } from '@phosphor-icons/react';
import { BankActions } from '../FinanceHUD';
import { HeroRevivalActions } from '../HeroRevivalActions';
import { PromotionActions } from '../PromotionHUD';
import { MedicRecruitmentAction } from './MedicRecruitmentAction';
import { ProductionChoices } from './ProductionChoices';
import { ResearchActions } from '../ResearchHUD';
import type { SelectionContext } from './context';
import { money } from './format';

export function BuildingCommands({
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
  const { entity, owned, own, playing } = context;
  const demolishButton =
    owned && entity.kind === 'plot' && entity.building ? (
      <button
        className="command-button economy-command demolition-command"
        disabled={!playing}
        {...hotkeyAttributes('d')}
        onClick={() => send({ type: 'demolish', slot: entity.slot })}
        data-hud-tooltip="D · Recupera 50% da construção e upgrades pagos. Mantém o terreno; cancela pedidos e pesquisas deste prédio."
      >
        <div className="command-tile-body">
          <Trash />
          <strong>
            <HotkeyLabel label="Demolir" hotkey="d" />
          </strong>
        </div>
        <span>+{money(demolitionRefund(entity.building))}</span>
      </button>
    ) : null;

  let commands;
  if (entity.kind === 'plot' && entity.building && !isBuildingReady(entity.building)) {
    commands = <div className="building-selection-actions">{demolishButton}</div>;
  } else if (
    entity.kind === 'plot' &&
    entity.building &&
    isResearchBuilding(entity.building.kind)
  ) {
    commands = (
      <ResearchActions
        key={`${side}:${entity.slot}:${entity.building.kind}`}
        player={own}
        slot={entity.slot}
        playing={playing}
        send={send}
        extra={<>{demolishButton}</>}
      />
    );
  } else if (entity.kind === 'plot' && entity.building?.kind === 'bank') {
    commands = (
      <BankActions
        key={`${side}:${entity.slot}:bank`}
        player={own}
        playing={playing}
        send={send}
        extra={demolishButton}
      />
    );
  } else if (entity.kind === 'plot' && entity.building) {
    const building = entity.building;
    const maxed = building.level >= MAX_BUILDING_LEVEL;
    const promotionButtons =
      building.kind === 'civic' ? (
        <PromotionActions building={building} player={own} playing={playing} send={send} />
      ) : null;
    commands = (
      <div
        className={`building-selection-actions ${building.kind === 'civic' ? 'with-promotions' : ''}`}
      >
        {building.kind === 'hospital' && (
          <>
            <MedicRecruitmentAction
              building={building}
              player={own}
              side={side}
              playing={playing}
              send={send}
            />
            <HeroRevivalActions game={game} side={side} slot={building.slot} send={send} />
          </>
        )}
        <ProductionChoices
          building={building}
          player={own}
          side={side}
          playing={playing}
          send={send}
        />
        {canUpgradeBuilding(building.kind) && (
          <button
            className="command-button economy-command"
            data-low-cash={own.cash < buildingUpgradeCost(building)}
            data-resource-shortage={
              playing && !maxed && !building.upgrading && own.cash < buildingUpgradeCost(building)
            }
            disabled={
              !playing || maxed || building.upgrading || own.cash < buildingUpgradeCost(building)
            }
            {...hotkeyAttributes('l')}
            onClick={() => send({ type: 'upgrade', slot: entity.slot })}
            data-hud-tooltip={
              building.kind === 'workplace'
                ? '+4 empregos'
                : building.kind === 'housing'
                  ? '+2 de população máxima'
                  : isPopularityBuilding(building.kind)
                    ? '+5% da geração-base por nível; retorno decrescente por tipo'
                    : '+5% de vida e dano das próximas tropas por nível'
            }
          >
            <div className="command-tile-body">
              <ArrowFatUp weight="fill" />
              <strong>
                <HotkeyLabel
                  hotkey="l"
                  label={
                    building.upgrading
                      ? `Melhorando · ${Math.floor((building.upgradeProgress ?? 0) * 100)}%`
                      : maxed
                        ? 'Nível máximo'
                        : 'Melhorar'
                  }
                />
              </strong>
            </div>
            <span>
              {building.upgrading
                ? `${Math.ceil(upgradeSecondsRemaining(building, own))}s restantes`
                : maxed
                  ? `Nível ${MAX_BUILDING_LEVEL}`
                  : `${money(buildingUpgradeCost(building))} · ${Math.ceil(upgradeDuration(building) / constructionMultiplier(own))}s`}
            </span>
          </button>
        )}
        {BUILDINGS[building.kind].unit && (
          <button
            className="command-button economy-command"
            disabled={!playing}
            {...hotkeyAttributes('p')}
            onClick={() =>
              send({ type: 'auto-production', slot: building.slot, paused: !building.autoPaused })
            }
            data-hud-tooltip={
              building.autoPaused
                ? 'P · Retomar produção automática. Aguarda vagas disponíveis.'
                : 'P · Não iniciar novos pedidos. A unidade em treinamento termina normalmente.'
            }
          >
            <div className="command-tile-body">
              {building.autoPaused ? <Play weight="fill" /> : <Pause weight="fill" />}
              <strong>
                <HotkeyLabel label="Produção automática" hotkey="p" />
              </strong>
            </div>
            <span>{building.autoPaused ? 'Retomar' : 'Pausar'}</span>
          </button>
        )}
        {promotionButtons}
        {demolishButton}
        <div className="automatic-production">
          <ChartLineUp />
          <strong>
            {building.kind === 'workplace'
              ? '+4 empregos'
              : building.kind === 'housing'
                ? 'População máxima'
                : isPopularityBuilding(building.kind)
                  ? 'Popularidade por segundo'
                  : 'Produção automática'}
          </strong>
          <small>{BUILDINGS[building.kind].description}</small>
        </div>
      </div>
    );
  } else {
    commands = null;
  }
  return commands;
}
