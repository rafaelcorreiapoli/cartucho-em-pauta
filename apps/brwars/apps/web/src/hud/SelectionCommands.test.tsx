import { createGame } from '@brwars/simulation';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import type { MapSelection } from '../selection';
import { selectionContext } from './context';
import { SelectionCommands } from './SelectionCommands';

function render(selection: MapSelection) {
  const game = createGame();
  return renderToStaticMarkup(
    <SelectionCommands
      game={game}
      side="left"
      context={selectionContext(game, 'left', selection)}
      send={() => {}}
    />,
  );
}
it.each<MapSelection>([
  { kind: 'base', side: 'right' },
  { kind: 'plot', side: 'right', slot: 0 },
  { kind: 'plot', side: 'right', slot: 2 },
])('seleção inimiga nunca expõe ações de produção/construção: %j', (selection) => {
  const html = render(selection);
  expect(html).toContain('Seleção inimiga');
  expect(html).not.toContain('<button');
});
it('terreno próprio disponível abre nas categorias de construção', () => {
  const game = createGame();
  const slot = game.players.left.ownedPlots!.find(
    (slot) => !game.players.left.buildings.some((b) => b.slot === slot),
  )!;
  const html = render({ kind: 'plot', side: 'left', slot });
  expect(html).toContain('plot-commands');
  expect(html).toContain('aria-label="Abrir Básicas"');
  expect(html).toContain('aria-label="Abrir Avançadas"');
  expect(html).not.toContain('construction-card');
});
it('seleção vazia não oferece comandos', () => {
  expect(render(null)).not.toContain('<button');
});
it('base própria mantém ações de recrutamento', () => {
  const html = render({ kind: 'base', side: 'left' });
  expect(html).toContain('base-commands');
  expect(html).toContain('<button');
});
