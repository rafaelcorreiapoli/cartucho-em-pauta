import {
  HEROES,
  MAX_HERO_LEVEL,
  heroXpThreshold,
  type GameState,
  type HeroKind,
  type Side,
  type Unit,
} from '@brwars/simulation';
import { UnitPortrait } from './UnitPortrait';
const statusLabels = {
  training: 'Em treinamento',
  alive: 'Em campo',
  dead: 'Morto · reviva no Hospital',
  reviving: 'Em recuperação no Hospital',
};
export function HeroRosterHUD({
  game,
  side,
  onSelect,
}: {
  game: GameState;
  side: Side;
  onSelect: (hero: HeroKind, unit: Unit | undefined) => void;
}) {
  const heroes = game.players[side].heroes ?? [];
  if (!heroes.length) return null;
  return (
    <section className="hero-roster-hud" aria-label="Seus heróis">
      {heroes.map((record) => {
        const spec = HEROES[record.hero],
          unit = game.units.find(
            (unit) => unit.side === side && unit.hero === record.hero && unit.hp > 0,
          ),
          life = unit ? Math.max(0, Math.min(100, (unit.hp / unit.maxHp) * 100)) : 0;
        const start = heroXpThreshold(record.level),
          next = heroXpThreshold(record.level + 1),
          xp =
            record.level >= MAX_HERO_LEVEL
              ? 100
              : Math.max(0, Math.min(100, ((record.xp - start) / (next - start)) * 100));
        const dead = record.status === 'dead' || record.status === 'reviving';
        return (
          <button
            key={record.hero}
            className={`hero-roster-card${dead ? ' fallen' : ''}`}
            aria-label={`${spec.name}, nível ${record.level}, ${statusLabels[record.status]}`}
            onClick={() => onSelect(record.hero, unit)}
            data-hud-tooltip={`${spec.name} · Nível ${record.level}\n${statusLabels[record.status]}\n${unit ? `${Math.ceil(unit.hp)} / ${Math.ceil(unit.maxHp)} PV\n` : ''}${record.level >= MAX_HERO_LEVEL ? 'Nível máximo' : `${record.xp - start} / ${next - start} XP`}`}
          >
            <UnitPortrait side={side} kind="hero" hero={record.hero} />
            <b className="hero-roster-level" aria-label={`Nível ${record.level}`}>
              {record.level}
            </b>
            <div className="hero-roster-bars">
              <div
                role="progressbar"
                aria-label={`Vida de ${spec.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(life)}
              >
                <i
                  style={{
                    width: `${life}%`,
                    background: life < 30 ? '#e16455' : life < 70 ? '#e3c85a' : '#87d16b',
                  }}
                />
              </div>
              <div
                className="xp"
                role="progressbar"
                aria-label={`XP de ${spec.name}`}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.floor(xp)}
              >
                <i style={{ width: `${xp}%` }} />
              </div>
            </div>
          </button>
        );
      })}
    </section>
  );
}
