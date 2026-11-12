import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { createGame } from '@brwars/simulation';
import { HeroRecruitmentActions } from '../HeroRecruitmentActions';
import { SelectionCommands } from './SelectionCommands';
import { selectionContext } from './context';
it('heróis deixam requisitos só no popover e preservam os dois badges e o preço', () => {
  const game = createGame();
  const html = renderToStaticMarkup(
    <HeroRecruitmentActions game={game} side="right" send={() => {}} />,
  );
  expect(html).not.toContain('<small>Requer');
  expect(html).not.toContain('Requer Arena');
  expect(html).toContain('recruitment-time');
  expect(html).toContain('recruitment-population');
  expect(html).toContain('&quot;requirements&quot;');
  expect(html).toContain('&quot;name&quot;:&quot;Arena XP&quot;');
  expect(html).toContain('&quot;met&quot;:false');
});
it('Hospital da Direita oferece médico próprio sem ocupar um slot de herói', () => {
  const game = createGame();
  game.players.right.buildings = [
    { ...game.players.right.buildings[0], kind: 'hospital', slot: 1 },
  ];
  const html = renderToStaticMarkup(
    <SelectionCommands
      game={game}
      side="right"
      context={selectionContext(game, 'right', { kind: 'plot', side: 'right', slot: 1 })}
      send={() => {}}
    />,
  );
  expect(html).toContain('/assets/portraits-support.png');
  expect(html.replace(/<[^>]*>/g, '')).toContain('Médico do Convênio');
});
