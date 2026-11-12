import { HEROES, MAX_HERO_LEVEL, heroXpThreshold, type HeroRecord } from '@brwars/simulation';
export function HeroExperience({ record }: { record: HeroRecord | undefined }) {
  if (!record) return null;
  const maxed = record.level >= MAX_HERO_LEVEL,
    start = heroXpThreshold(record.level),
    next = heroXpThreshold(record.level + 1),
    progress = maxed ? 100 : ((record.xp - start) / (next - start)) * 100;
  return (
    <div className="hero-experience">
      <span>
        Nível {record.level}
        <b>{maxed ? 'NÍVEL MÁXIMO' : `${record.xp - start} / ${next - start} XP`}</b>
      </span>
      <div
        role="progressbar"
        aria-label={`Experiência de ${HEROES[record.hero].name}`}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.floor(progress)}
      >
        <i style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
