import { expect, it } from 'vitest';
import { battlefieldKind, battlefieldLayout, createGame, execute } from './index';

it.each(['campo', 'paulista', 'reserva'] as const)(
  '%s mantém fileiras paralelas e valida o limite próprio do mapa',
  (kind) => {
    const layout = battlefieldLayout(kind);
    const game = createGame('playing', kind);
    for (const side of ['left', 'right'] as const) {
      const { from, to, y, endY } = layout.route;
      const slope = (endY - y) / (to - from);
      const rows: { offset: number; count: number }[] = [];
      for (const plot of layout.plots[side]) {
        const offset = plot.y - (y + (plot.x - from) * slope);
        const row = rows.find((candidate) => Math.abs(candidate.offset - offset) < 1);
        if (row) row.count++;
        else rows.push({ offset, count: 1 });
      }
      expect(rows.filter(({ offset }) => offset < 0).map(({ count }) => count)).toEqual(
        kind === 'paulista' ? [7, 7, 7] : [8, 8, 8],
      );
      expect(rows.filter(({ offset }) => offset > 0).map(({ count }) => count)).toEqual([8, 8, 8]);
      expect(game.players[side].ownedPlots).toHaveLength(6);
      const limit = kind === 'paulista' ? 56 : 48;
      expect(execute(game, side, { type: 'buy-plot', slot: limit })).toBe('Terreno inválido.');
      expect(execute(game, side, { type: 'buy-plot', slot: limit - 1 })).toBeNull();
      expect(execute(game, side, { type: 'build', slot: limit - 1, kind: 'barracks' })).toBeNull();
    }
  },
);

it.each(['floresta', 'deserto'] as const)('%s usa exatamente a geometria da Paulista', (kind) => {
  const game = createGame('playing', battlefieldKind(kind));
  expect(game.battlefield).toBe(kind);
  expect(battlefieldLayout(game.battlefield)).toBe(battlefieldLayout('paulista'));
  expect(execute(game, 'left', { type: 'buy-plot', slot: 55 })).toBeNull();
});
