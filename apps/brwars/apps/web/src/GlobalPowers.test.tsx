import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createGame } from '@brwars/simulation';
import { GlobalPowers } from './GlobalPowers';
import { DetailTooltip } from './DetailTooltip';
it('magias usam os números de 1 a 4, sem modificador Shift', () => {
  const html = renderToStaticMarkup(
    <GlobalPowers
      game={createGame()}
      side="left"
      selected="bills"
      onSelect={() => {}}
      onCast={() => {}}
    />,
  );
  for (const key of ['1', '2', '3', '4'])
    expect(html).toContain(`aria-keyshortcuts="Shift+${key}"`);
  expect(html).not.toContain('Concluído');
  expect(html).not.toContain('Renda mínima');
});
it('requisitos são portraits com estado próprio, sem rótulo de conclusão', () => {
  const html = renderToStaticMarkup(
    <DetailTooltip
      tip={{
        title: 'Agora vai!',
        stats: [],
        requirements: [
          { kind: 'academy', side: 'left', name: 'Universidade popular', met: true },
          { kind: 'hospital', side: 'left', name: 'Hospital popular', met: false },
        ],
      }}
    />,
  );
  expect(html).toContain('data-met="true"');
  expect(html).toContain('data-met="false"');
  expect(html).toContain('/assets/academies.png');
  expect(html).toContain('/assets/hospitals.png');
  expect(html).not.toContain('Concluído');
});
