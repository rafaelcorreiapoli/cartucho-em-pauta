import { expect, it } from 'vitest';
import { detailAttributes, readDetailTip, type DetailTip } from './DetailTooltip';
const element = (raw: string) => ({ dataset: { hudDetail: raw } });
it('recupera os detalhes completos serializados pelo HUD', () => {
  const tip: DetailTip = {
    title: 'Pesquisa',
    stats: [{ label: 'Dano', value: '+5%', icon: 'star' }],
  };
  expect(readDetailTip(element(detailAttributes(tip)['data-hud-detail']))).toEqual(tip);
});
it.each([
  '{',
  'null',
  '{}',
  '{"title":"X","stats":[null]}',
  '{"title":"X","stats":[{"label":"A","value":2}]}',
  '{"title":"X","stats":[{"label":"A","value":"2","icon":"toString"}]}',
])('ignora dados inválidos sem quebrar o tooltip: %s', (raw) => {
  expect(readDetailTip(element(raw))).toBeUndefined();
});
