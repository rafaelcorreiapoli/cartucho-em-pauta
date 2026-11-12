import { detailAttributes } from './DetailTooltip';
import {
  GLOBAL_POWERS,
  FACTIONS,
  globalPowerName,
  globalPowerQuote,
  isGlobalPowerUnlocked,
  opposite,
  globalPowerUnlockRequirements,
  type GameState,
  type GlobalPowerKind,
  type Side,
} from '@brwars/simulation';
import { Star } from '@phosphor-icons/react';
import './global-powers.css';
export function GlobalPowers({
  game,
  side,
  selected,
  onSelect,
  onCast,
}: {
  game: GameState;
  side: Side;
  selected: GlobalPowerKind;
  onSelect: (kind: GlobalPowerKind) => void;
  onCast: (kind: GlobalPowerKind) => void;
}) {
  const player = game.players[side];
  return (
    <nav className="global-spellbar" aria-label="Magias globais">
      {(Object.keys(GLOBAL_POWERS) as GlobalPowerKind[]).map((kind, index) => {
        const power = GLOBAL_POWERS[kind],
          name = globalPowerName(kind, side),
          hotkey = String(index + 1),
          quote = globalPowerQuote(player, kind),
          cooldown = Math.max(0, player.powerCooldowns?.[kind] ?? 0),
          fraction = Math.min(1, cooldown / quote.cooldown);
        const targets =
          kind === 'sabotage'
            ? game.players[opposite(side)].workers > 0
            : game.units.some((unit) =>
                kind === 'strength' ? unit.side === side : unit.side !== side,
              );
        const unlocked = isGlobalPowerUnlocked(player, kind);
        const requirements = globalPowerUnlockRequirements(player, kind);
        const ready =
          unlocked &&
          game.status === 'playing' &&
          cooldown <= 0 &&
          player.popularity >= quote.cost &&
          targets;
        const reason = !unlocked
          ? 'Cumpra os requisitos para liberar permanentemente.'
          : cooldown > 0
            ? `Recarga: ${Math.ceil(cooldown)}s.`
            : player.popularity < quote.cost
              ? 'Popularidade insuficiente.'
              : !targets
                ? kind === 'sabotage'
                  ? 'Nenhum trabalhador inimigo disponível.'
                  : 'Sem tropas disponíveis para este efeito.'
                : '';
        return (
          <button
            key={kind}
            className={`global-spell ${kind} ${ready ? 'ready' : ''} ${selected === kind ? 'selected' : ''}`}
            aria-label={`${name}, ${quote.cost} de popularidade por uso`}
            aria-disabled={!ready}
            data-unavailable={!unlocked || game.status !== 'playing' || cooldown > 0 || !targets}
            data-command-hotkey={hotkey}
            aria-keyshortcuts={`Shift+${hotkey}`}
            {...detailAttributes({
              title: name,
              subtitle: power.description,
              stats: [
                {
                  label: 'Custo por uso',
                  value: String(quote.cost),
                  icon: 'star',
                },
                { label: 'Recarga', value: `${quote.cooldown}s`, icon: 'clock' },
              ],
              requirements: requirements.map((requirement) => ({
                kind: requirement.building,
                side,
                name: FACTIONS[side].buildings[requirement.building],
                met: requirement.met,
              })),
              footnote: `[Shift + ${hotkey}]${reason ? ` · ${reason}` : ''}`,
            })}
            onClick={() => {
              onSelect(kind);
              if (ready) onCast(kind);
            }}
          >
            <kbd>⇧{hotkey}</kbd>
            <img
              className="spell-portrait"
              src={`/assets/spell-${kind}.webp`}
              alt=""
              draggable={false}
            />
            {fraction > 0 && (
              <i
                className="spell-cooldown"
                aria-hidden="true"
                style={{ height: `${fraction * 100}%` }}
              />
            )}
            <span
              className={`spell-price ${player.popularity < quote.cost ? 'cost-insufficient' : ''}`}
            >
              <Star weight="fill" />
              {quote.cost}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
