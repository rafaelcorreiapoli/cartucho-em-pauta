import { HotkeyLabel } from './HotkeyLabel';
import { assignHotkeys, hotkeyAttributes } from './command-hotkeys';
import {
  BASE_QUEUE_LIMIT,
  heroAlive,
  heroCount,
  HEROES,
  heroQueued,
  heroRecord,
  heroRecruitmentCost,
  heroRecruitmentRequirements,
  heroRecruitmentBuildingRequirements,
  isBuildingReady,
  populationCapacity,
  FACTIONS,
  heroRoster,
  MAX_HEROES,
  productionFactor,
  unitTrainingMultiplier,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { Coins } from '@phosphor-icons/react';
import { detailAttributes } from './DetailTooltip';
import { RecruitmentBadges } from './RecruitmentBadges';
import { UnitPortrait } from './UnitPortrait';
export function HeroRecruitmentActions({
  game,
  side,
  send,
}: {
  game: GameState;
  side: Side;
  send: (command: Command) => void;
}) {
  const player = game.players[side],
    playing = game.status === 'playing',
    acquired = heroCount(game, side),
    full = acquired >= MAX_HEROES,
    queueFull = (player.trainingQueue?.length ?? 0) >= BASE_QUEUE_LIMIT,
    requirements = heroRecruitmentRequirements(player, side),
    missingCivic = requirements.length > 0;
  const roster = heroRoster(side);
  const hotkeys = assignHotkeys(
    roster.map((hero) => HEROES[hero].name),
    ['l', 'r', 'c'],
  );
  return (
    <>
      {roster.map((hero, index) => {
        const spec = HEROES[hero],
          cost = heroRecruitmentCost(player, hero),
          alive = heroAlive(game, side, hero),
          queued = heroQueued(player, hero, side),
          record = heroRecord(player, hero),
          blocked = missingCivic || !!record || !playing || full || queueFull || alive || queued;
        const status =
          record?.status === 'dead'
            ? 'Reviva no Hospital'
            : record?.status === 'reviving'
              ? 'Em recuperação'
              : alive
                ? `Nível ${record?.level ?? 1}`
                : queued
                  ? 'Na fila'
                  : missingCivic
                    ? ''
                    : full
                      ? 'Elenco de 3 heróis'
                      : '';
        return (
          <button
            key={hero}
            {...hotkeyAttributes(hotkeys[index])}
            className="command-button economy-command recruitment-card hero-recruitment-card"
            data-low-cash={player.cash < cost}
            data-resource-shortage={!blocked && player.cash < cost}
            disabled={blocked || player.cash < cost}
            {...detailAttributes({
              title: spec.name,
              subtitle: spec.description,
              requirements: heroRecruitmentBuildingRequirements(player).map((kind) => ({
                kind,
                side,
                name: FACTIONS[side].buildings[kind],
                met: player.buildings.some(
                  (building) => building.kind === kind && isBuildingReady(building),
                ),
              })),
              stats: [
                { label: 'VIDA', value: String(spec.hp) },
                { label: 'DANO', value: String(spec.damage) },
                { label: 'MOVIMENTO', value: String(spec.speed) },
                {
                  label: 'TREINAMENTO',
                  value: `${Math.ceil(spec.duration / (productionFactor(player) * unitTrainingMultiplier(player, 'hero')))}s`,
                  icon: 'clock',
                },
                { label: 'CUSTO', value: `R$ ${cost}`, icon: 'coins' },
                { label: 'POPULAÇÃO', value: '3', icon: 'population' },
                ...(acquired >= 2
                  ? [
                      {
                        label: 'Capacidade necessária',
                        value: `${populationCapacity(player)} / 100`,
                        icon: 'population' as const,
                      },
                    ]
                  : []),
              ],
              footnote: status || '5 passivas de área · níveis 1, 3, 5, 7 e 10',
            })}
            onClick={() => send({ type: 'hero', hero })}
          >
            <RecruitmentBadges
              seconds={Math.ceil(
                spec.duration / (productionFactor(player) * unitTrainingMultiplier(player, 'hero')),
              )}
              population={3}
            />
            <UnitPortrait side={side} kind="hero" hero={hero} />
            <strong>
              <HotkeyLabel label={spec.name} hotkey={hotkeys[index]} />
            </strong>
            <span>
              <Coins size={12} />
              {cost.toLocaleString('pt-BR', {
                style: 'currency',
                currency: 'BRL',
                maximumFractionDigits: 0,
              })}
            </span>
          </button>
        );
      })}
    </>
  );
}
