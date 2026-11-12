import { detailAttributes } from './DetailTooltip';
import {
  HEROES,
  FACTIONS,
  isBuildingReady,
  heroRevivalQuote,
  productionFactor,
  unitTrainingMultiplier,
  type Command,
  type GameState,
  type HeroKind,
  type Side,
} from '@brwars/simulation';
import { Coins } from '@phosphor-icons/react';
import { recoveryHospital } from './hero-recovery';
import { RecruitmentBadges } from './RecruitmentBadges';
import { UnitPortrait } from './UnitPortrait';
export function HeroRevivalActions({
  game,
  side,
  slot,
  hero,
  send,
}: {
  game: GameState;
  side: Side;
  slot?: number;
  hero?: HeroKind;
  send: (command: Command) => void;
}) {
  const player = game.players[side],
    { hospital, reason } = recoveryHospital(player, slot);
  return (
    <>
      {(player.heroes ?? [])
        .filter((record) => !hero || record.hero === hero)
        .map((record) => {
          const spec = HEROES[record.hero],
            quote = heroRevivalQuote(player, record.hero),
            blocked = game.status !== 'playing' || !hospital || record.status !== 'dead';
          return (
            <button
              key={record.hero}
              className="command-button economy-command recruitment-card hero-recruitment-card"
              disabled={blocked || player.cash < quote.cost}
              data-low-cash={player.cash < quote.cost}
              data-resource-shortage={!blocked && player.cash < quote.cost}
              {...detailAttributes({
                title: `Reviver ${spec.name}`,
                stats: [
                  {
                    label: 'Recuperação',
                    value: `${Math.ceil(quote.duration / (productionFactor(player) * unitTrainingMultiplier(player, 'hero')))}s`,
                    icon: 'clock',
                  },
                  { label: 'Custo', value: `R$ ${quote.cost}`, icon: 'coins' },
                  { label: 'População', value: '3', icon: 'population' },
                ],
                requirements: [
                  {
                    kind: 'hospital',
                    side,
                    name: FACTIONS[side].buildings.hospital,
                    met: player.buildings.some(
                      (building) => building.kind === 'hospital' && isBuildingReady(building),
                    ),
                  },
                ],
                footnote:
                  record.status === 'dead'
                    ? hospital
                      ? `Nível ${record.level} · XP preservado`
                      : player.buildings.some(
                            (building) => building.kind === 'hospital' && isBuildingReady(building),
                          )
                        ? reason
                        : `Nível ${record.level} · XP preservado`
                    : record.status === 'reviving'
                      ? 'Em recuperação'
                      : record.status === 'alive'
                        ? 'Herói em campo'
                        : 'Em treinamento',
              })}
              onClick={() => {
                if (hospital) send({ type: 'hero-revive', hero: record.hero, slot: hospital.slot });
              }}
            >
              <RecruitmentBadges
                seconds={Math.ceil(
                  quote.duration /
                    (productionFactor(player) * unitTrainingMultiplier(player, 'hero')),
                )}
                population={3}
              />
              <UnitPortrait side={side} kind="hero" hero={record.hero} />
              <strong>Reviver {spec.name}</strong>

              <span>
                <Coins size={12} />
                R$ {quote.cost.toLocaleString('pt-BR')}
              </span>
            </button>
          );
        })}
    </>
  );
}
