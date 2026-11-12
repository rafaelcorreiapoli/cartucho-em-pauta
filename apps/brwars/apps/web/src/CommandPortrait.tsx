import type { InvestmentProduct, LoanProduct, ResearchKind } from '@brwars/simulation';
const positions: Record<LoanProduct | InvestmentProduct | ResearchKind, number> = {
  spell_cooldown: 0,
  spell_threshold: 0,
  mobility: 6,
  base_artillery: 0,
  production: 6,
  productivity: 5,
  worker_training: 7,
  construction: 8,
  bridge: 0,
  standard: 1,
  expansion: 2,
  reserve: 3,
  treasury: 4,
  development: 5,
  infantry: 6,
  vitality: 7,
  fortification: 8,
  defense: 9,
  marksmanship: 0,
  siege: 1,
};
export type CommandPortraitKind = keyof typeof positions | 'category_army' | 'category_economy';
export function CommandPortrait({ kind }: { kind: CommandPortraitKind }) {
  if (kind === 'construction')
    return (
      <svg className="command-portrait-image" viewBox="0 0 512 512" aria-hidden="true">
        <image href="/assets/research-construction.png" width={512} height={512} />
      </svg>
    );
  if (kind === 'worker_training' || kind === 'category_army' || kind === 'category_economy') {
    const index = kind === 'worker_training' ? 0 : kind === 'category_army' ? 1 : 2;
    return (
      <svg className="command-portrait-image" viewBox="0 0 512 512" aria-hidden="true">
        <svg width={512} height={512} overflow="hidden">
          <image
            href="/assets/research-category-portraits.png"
            width={1536}
            height={512}
            x={-index * 512}
          />
        </svg>
      </svg>
    );
  }
  if (kind === 'spell_cooldown' || kind === 'spell_threshold')
    return (
      <svg className="command-portrait-image" viewBox="0 0 512 512" aria-hidden="true">
        <image
          href={`/assets/spell-${kind === 'spell_cooldown' ? 'recall' : 'silence'}.webp`}
          width={512}
          height={512}
        />
      </svg>
    );
  if (kind === 'mobility' || kind === 'production' || kind === 'base_artillery')
    return (
      <svg className="command-portrait-image" viewBox="0 0 512 512" aria-hidden="true">
        <image href={`/assets/research-${kind}.webp`} width={512} height={512} />
      </svg>
    );
  const index = positions[kind],
    extra = kind === 'marksmanship' || kind === 'siege',
    columns = extra ? 2 : 5;
  return (
    <svg
      className="command-portrait-image"
      viewBox="0 0 512 512"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden="true"
    >
      <svg width={512} height={512} overflow="hidden">
        <image
          href={extra ? '/assets/research-class-portraits.png' : '/assets/command-portraits.png'}
          width={extra ? 1024 : 2560}
          height={extra ? 512 : 1024}
          x={-(index % columns) * 512}
          y={-Math.floor(index / columns) * 512}
        />
      </svg>
    </svg>
  );
}
