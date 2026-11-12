import { buildingUpgradeCost } from '@brwars/simulation';
import {
  canUpgradeBuilding,
  battlefieldLayout,
  FACTIONS,
  MAX_BUILDING_LEVEL,
  PLOT_COST,
  isBuildingReady,
  ownsPlot,
  productionBlockers,
  productionSpec,
  troopName,
  type GameState,
  type Side,
} from '@brwars/simulation';
import {
  ArrowFatUp,
  ArrowsClockwise,
  Coins,
  LockSimple,
  Pause,
  Plus,
  UsersThree,
} from '@phosphor-icons/react';
import { Fragment, type Ref, type MouseEvent } from 'react';
import { buildingArt, buildingDisplaySize, buildingStage } from '../building-art';
import buildingOrigins from '../building-origins.json';
import buildingTops from '../building-tops.json';
import {
  BASE_HEALTH_Y_OFFSET,
  BUILDING_GROUND_OFFSET,
  basePosition,
  buildingPosition,
} from '../map-layout';
import { UnitPortrait } from '../UnitPortrait';
import type { MapSelection } from '../selection';
import type { BattlefieldProps } from './contracts';

export function MapBuildingOverlays({
  game,
  playerSide,
  nicknames,
  selection,
  onSelect,
  onUpgrade,
  worldRef,
}: {
  game: GameState;
  playerSide: Side;
  nicknames?: Record<Side, string>;
  selection: MapSelection;
  onSelect: BattlefieldProps['onSelect'];
  onUpgrade: (slot: number, origin?: { x: number; y: number }) => void;
  worldRef: Ref<HTMLDivElement>;
}) {
  function upgrade(slot: number, event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    const element = event.currentTarget.closest<HTMLElement>('.map-world-overlays')!;
    const world = element.getBoundingClientRect();
    const button = event.currentTarget.getBoundingClientRect();
    const clickX = event.detail === 0 ? button.left + button.width / 2 : event.clientX;
    const clickY = event.detail === 0 ? button.top + button.height / 2 : event.clientY;
    onUpgrade(slot, {
      x: ((clickX - world.left) * element.offsetWidth) / world.width,
      y: ((clickY - world.top) * element.offsetHeight) / world.height,
    });
  }
  return (
    <div className="map-building-overlays">
      <div className="map-world-overlays" ref={worldRef}>
        {(['left', 'right'] as const).map((side) => {
          const nick = nicknames?.[side];
          if (!nick) return null;
          const { x, y } = basePosition(side, playerSide, game.battlefield);
          return (
            <span
              key={side}
              className="map-base-nick"
              dir="auto"
              style={{ left: x, top: y - BASE_HEALTH_Y_OFFSET - 4 }}
            >
              {nick}
            </span>
          );
        })}
        {(['left', 'right'] as const).flatMap((side) =>
          game.players[side].buildings
            .filter((building) => isBuildingReady(building))
            .map((building) => {
              const { x, y } = buildingPosition(side, building.slot, playerSide, game.battlefield),
                reasons = productionBlockers(game, side, building);
              const selectedUnit = productionSpec(building, building.productionTier);
              const { texture, frame } = buildingArt(building.kind, side, building.level);
              const roof =
                y +
                BUILDING_GROUND_OFFSET -
                buildingDisplaySize(texture).height *
                  (buildingOrigins[texture][frame] - buildingTops[texture][frame]);
              const position = { left: x, top: roof - 9, transform: 'translate(-50%,-100%)' };
              return (
                <Fragment key={`status-${side}-${building.slot}`}>
                  <div className="map-production-status" style={position}>
                    {selectedUnit && (
                      <span className="map-production-badge">
                        <span
                          title={
                            building.autoPaused
                              ? 'Automático pausado: não inicia novos pedidos'
                              : 'Produção automática ligada'
                          }
                          aria-label={
                            building.autoPaused
                              ? 'Automático pausado'
                              : 'Produção automática ligada'
                          }
                        >
                          {building.autoPaused ? <Pause weight="fill" /> : <ArrowsClockwise />}
                        </span>
                        <span
                          className="map-production-portrait"
                          title={`Produção selecionada: ${troopName(side, selectedUnit.kind, selectedUnit.tier)}`}
                        >
                          <UnitPortrait
                            side={side}
                            kind={selectedUnit.kind}
                            tier={selectedUnit.tier}
                          />
                        </span>
                      </span>
                    )}
                    {reasons.includes('population') && (
                      <span
                        className="blocked"
                        title="Aguardando população para iniciar a próxima unidade"
                        aria-label="Aguardando população"
                      >
                        <UsersThree />
                      </span>
                    )}
                    {reasons.includes('cash') && (
                      <span
                        className="blocked"
                        title="Aguardando R$ para iniciar a próxima unidade"
                        aria-label="Aguardando R$"
                      >
                        <Coins />
                      </span>
                    )}
                  </div>
                  {canUpgradeBuilding(building.kind) && (
                    <div
                      className="map-level-dock"
                      data-stage={buildingStage(building.level)}
                      style={{ left: x, top: y + 28, transform: 'translateX(-50%)' }}
                    >
                      <span
                        className="map-building-level-icon"
                        title={`Nível ${building.level}`}
                        aria-label={`Construção nível ${building.level}`}
                      >
                        NV. <b>{building.level}</b>
                        {side === playerSide && (
                          <button
                            className="map-level-up"
                            aria-label={`Melhorar terreno ${building.slot + 1} para nível ${building.level + 1}`}
                            title={
                              building.level >= MAX_BUILDING_LEVEL
                                ? 'Nível máximo'
                                : building.upgrading
                                  ? 'Melhoria em andamento'
                                  : `Melhorar · R$ ${buildingUpgradeCost(building).toLocaleString('pt-BR')}`
                            }
                            disabled={
                              game.status !== 'playing' ||
                              building.upgrading ||
                              building.level >= MAX_BUILDING_LEVEL ||
                              game.players[side].cash < buildingUpgradeCost(building)
                            }
                            onClick={(event) => upgrade(building.slot, event)}
                          >
                            <ArrowFatUp weight="fill" />
                            <b>UP</b>
                          </button>
                        )}
                      </span>
                      {building.upgrading && (
                        <div
                          role="progressbar"
                          aria-label={`Melhoria do terreno ${building.slot + 1}`}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-valuenow={Math.floor((building.upgradeProgress ?? 0) * 100)}
                        >
                          <i style={{ width: `${(building.upgradeProgress ?? 0) * 100}%` }} />
                        </div>
                      )}
                    </div>
                  )}
                </Fragment>
              );
            }),
        )}

        {(['left', 'right'] as const).flatMap((side) =>
          battlefieldLayout(game.battlefield).plots[side].map(({ slot }) => {
            const building = game.players[side].buildings.find(
              (candidate) => candidate.slot === slot,
            );
            const own = side === playerSide;
            const { x, y: buildingY } = buildingPosition(side, slot, playerSide, game.battlefield);
            const y = buildingY + 29;
            const position = { left: x, top: y, transform: 'translate(-50%,-50%)' };
            if (!building) {
              const selected =
                selection?.kind === 'plot' && selection.side === side && selection.slot === slot;
              const plotPosition = { ...position, top: buildingY + BUILDING_GROUND_OFFSET };
              const acquired = ownsPlot(game.players[side], slot);
              return own ? (
                <button
                  key={`${side}-${slot}`}
                  className={`map-construction-site ${selected ? 'selected' : ''} ${acquired ? '' : 'unowned'}`}
                  style={plotPosition}
                  aria-label={`Selecionar terreno ${slot + 1}`}
                  aria-pressed={selected}
                  title={
                    acquired
                      ? 'Terreno próprio — clique para construir'
                      : `Terreno à venda · R$ ${PLOT_COST}`
                  }
                  onClick={() => onSelect({ kind: 'plot', side, slot })}
                >
                  <span className="construction-site-ground" />
                  <span className="construction-site-marker">
                    <>
                      {acquired ? <Plus weight="bold" /> : <LockSimple weight="bold" />}
                      <small>{acquired ? 'CONSTRUIR' : `R$ ${PLOT_COST}`}</small>
                    </>
                  </span>
                </button>
              ) : null;
            }
            if (!isBuildingReady(building)) {
              const percent = Math.min(99, Math.floor(building.constructionProgress * 100));
              return (
                <div key={`${side}-${slot}`} className="map-construction-progress" style={position}>
                  <button
                    aria-label={`Selecionar obra ${own ? 'aliada' : 'inimiga'} do terreno ${slot + 1}`}
                    onClick={() => onSelect({ kind: 'plot', side, slot })}
                  >
                    <span
                      className="map-construction-name"
                      title={FACTIONS[side].buildings[building.kind]}
                    >
                      {FACTIONS[side].buildings[building.kind]}
                    </span>
                  </button>
                  <div
                    role="progressbar"
                    aria-label={`Construção do terreno ${slot + 1} da ${side === 'left' ? 'esquerda' : 'direita'}`}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={percent}
                  >
                    <i style={{ width: `${percent}%` }} />
                  </div>
                </div>
              );
            }
            return null;
          }),
        )}
      </div>
    </div>
  );
}
