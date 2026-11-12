import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createGame, RESEARCHES, type ResearchKind } from '@brwars/simulation';
import { BankActions } from '../FinanceHUD';
import { ResearchActions } from '../ResearchHUD';
import { researchGroups } from '../research-categories';

it('agrupa todas as pesquisas exatamente uma vez, compartilhando o catálogo do HUD global', () => {
  const kinds = researchGroups.flatMap((group) => group.kinds);
  expect(new Set(kinds).size).toBe(kinds.length);
  expect([...kinds].sort()).toEqual((Object.keys(RESEARCHES) as ResearchKind[]).sort());
});
it('banco abre nas categorias, sem contratar crédito ao navegar', () => {
  const player = createGame().players.left;
  const html = renderToStaticMarkup(
    <BankActions
      player={player}
      playing
      send={() => {
        throw new Error('navigation must not send commands');
      }}
    />,
  );
  expect(html).toContain('Abrir Crédito');
  expect(html).toContain('Abrir Aplicações');
  expect(html).not.toContain('finance-portrait-option');
  expect(html).not.toContain('tablist');
});
it.each(['school', 'academy'] as const)(
  '%s apresenta somente categorias com pesquisas disponíveis',
  (kind) => {
    const player = createGame().players.left;
    player.buildings = [{ ...player.buildings[0], kind }];
    const html = renderToStaticMarkup(
      <ResearchActions player={player} slot={0} playing send={() => {}} />,
    );
    expect(html).toContain('Abrir Exército');
    expect(html).toContain('Abrir Econômico');
    expect(html).not.toContain('data-hud-research-title');
    expect(html.includes('Abrir Poderes globais')).toBe(kind === 'academy');
    expect(html).toContain('Abrir Estrutural');
  },
);
