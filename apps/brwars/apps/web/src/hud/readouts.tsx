import { constructionSecondsRemaining, type Building } from '@brwars/simulation';

const healthColor = (fraction: number) =>
  fraction < 0.3 ? '#ed554c' : fraction < 0.7 ? '#f3ca43' : '#71d46b';
export function HealthReadout({
  value,
  max,
  compact = false,
}: {
  value: number;
  max: number;
  compact?: boolean;
}) {
  return (
    <div
      className="selected-health"
      role="progressbar"
      aria-label="Vida"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={Math.max(0, value)}
    >
      {!compact && (
        <span>
          VIDA{' '}
          <b>
            {Math.max(0, Math.ceil(value))} / {Math.ceil(max)}
          </b>
        </span>
      )}
      <i>
        <em
          style={{
            width: `${Math.max(0, (value / max) * 100)}%`,
            background: healthColor(value / max),
          }}
        />
      </i>
    </div>
  );
}
export function ConstructionReadout({
  building,
  speed = 1,
}: {
  building: Building;
  speed?: number;
}) {
  const percent = Math.min(100, Math.floor((building.constructionProgress ?? 1) * 100));
  return (
    <div className="selected-construction">
      <span>
        EM CONSTRUÇÃO{' '}
        <b>
          {percent}% · {Math.ceil(constructionSecondsRemaining(building) / speed)}s
        </b>
      </span>
      <div
        role="progressbar"
        aria-label="Andamento da construção selecionada"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <i style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
