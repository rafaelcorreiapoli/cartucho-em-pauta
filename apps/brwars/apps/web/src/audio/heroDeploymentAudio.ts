import type { HeroKind, HeroRecord } from '@brwars/simulation';
import type { SoundEvent } from './gameAudio';

const entrySounds: Partial<Record<HeroKind, SoundEvent>> = {
  lulinha: 'lulaEntry',
  jones: 'jonesEntry',
  stalin: 'stalinEntry',
  trump: 'trumpEntry',
  bolsonaro: 'bolsonaroEntry',
  che: 'cheEntry',
  mamaefalei: 'mamaefaleiEntry',
  marcal: 'marcalEntry',
};
/** One quote per confirmed deployment, including Hospital revivals; snapshots never replay it. */
export function trackHeroDeploymentAudio(
  initial: HeroRecord[],
  options: { entryQuotes?: boolean } = {},
) {
  const statuses = new Map(initial.map((record) => [record.hero, record.status]));
  const seen = new Map(
    initial
      .filter((record) => record.status !== 'training')
      .map((record) => [record.hero, record.revivals]),
  );
  return (records: HeroRecord[]): SoundEvent[] => {
    const sounds: SoundEvent[] = [];
    for (const record of records) {
      if (record.status === 'dead' && statuses.get(record.hero) === 'alive')
        sounds.push('heroDeath');
      statuses.set(record.hero, record.status);
      if (record.status === 'training') continue;
      if (
        options.entryQuotes !== false &&
        record.status === 'alive' &&
        seen.get(record.hero) !== record.revivals &&
        entrySounds[record.hero]
      )
        sounds.push(entrySounds[record.hero]!);
      seen.set(record.hero, record.revivals);
    }
    return sounds;
  };
}
