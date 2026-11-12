import {
  POPULARITY_CAP,
  POPULARITY_MIN,
  popularityCrisis,
  popularityRate,
  unemploymentRate,
  unemploymentPopularityRate,
  type Player,
} from '@brwars/simulation';
import { Star } from '@phosphor-icons/react';
import './popularity-meter.css';
const signed = (value: number, digits = 2) =>
  `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR', { maximumFractionDigits: digits })}`;
export function PopularityMeter({ player }: { player: Player }) {
  const value = Math.max(POPULARITY_MIN, Math.min(POPULARITY_CAP, player.popularity ?? 0)),
    rate = popularityRate(player),
    crisis = popularityCrisis(player),
    position = ((value - POPULARITY_MIN) / (POPULARITY_CAP - POPULARITY_MIN)) * 100;
  const direction = rate > 1e-8 ? 1 : rate < -1e-8 ? -1 : 0,
    length = Math.min(40, 8 + Math.abs(rate) * 10),
    start = 50,
    end = start + direction * length;
  return (
    <div
      className="resource popularity-meter"
      data-hud-tooltip={`Popularidade: ${signed(value)} (${POPULARITY_MIN} a +${POPULARITY_CAP}).\nTendência: ${signed(rate, 3)}/s. A seta aponta a direção e cresce com a intensidade.\nDesemprego: ${(unemploymentRate(player) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · ${signed(unemploymentPopularityRate(player), 3)} POP/s.\n${crisis.label}. Trabalhadores: ${Math.round(crisis.workerProductivity * 100)}% de produtividade. Unidades e obras: ${Math.round(crisis.production * 100)}% da velocidade.\nDiversifique: cópias ativas de cada tipo rendem 100%, 35%, 12,25%…`}
    >
      <div className="popularity-meter-heading">
        <Star weight="fill" />
        <small>POPULARIDADE</small>
        <b className={value < 0 ? 'negative' : ''}>{signed(Math.round(value), 0)}</b>
      </div>
      <div
        className="popularity-track"
        role="meter"
        aria-label="Popularidade do governo"
        aria-valuemin={POPULARITY_MIN}
        aria-valuemax={POPULARITY_CAP}
        aria-valuenow={value}
        aria-valuetext={`${signed(value)}. Tendência: ${signed(rate, 3)} por segundo.`}
      >
        <i className="popularity-zero" />
        <i className="popularity-pointer" style={{ left: `${position}%` }} />
      </div>
      <div
        className={`popularity-trend ${direction < 0 ? 'falling' : direction > 0 ? 'rising' : 'steady'}`}
        aria-label={`Tendência de popularidade: ${signed(rate, 3)} por segundo`}
      >
        <svg viewBox="0 0 100 12" aria-hidden="true">
          {direction ? (
            <>
              <path d={`M${start} 6H${end}`} />
              <path d={`M${end - direction * 4} 2L${end} 6L${end - direction * 4} 10`} />
            </>
          ) : null}
        </svg>
      </div>
    </div>
  );
}
