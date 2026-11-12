import { createGame, missingBuildingRequirements, troopName } from '@brwars/simulation';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it } from 'vitest';
import { DetailTooltip, detailAttributes, readDetailTip } from '../DetailTooltip';
import { constructionTooltip } from './construction-tooltip';

it('shows faction-specific troops and their unlock levels alongside the construction requirement', () => {
  const own = createGame().players.right;
  const tip = constructionTooltip(
    'garage',
    'right',
    own,
    20,
    missingBuildingRequirements(own, 'garage'),
  );
  const parsed = readDetailTip({
    dataset: { hudDetail: detailAttributes(tip)['data-hud-detail'] },
  });
  expect(parsed?.requirements).toMatchObject([{ kind: 'media', side: 'right', met: false }]);
  expect(parsed?.production?.map(({ name }) => name)).toEqual(
    ([0, 1, 2, 3] as const).map((tier) => troopName('right', 'siege', tier)),
  );
  const html = renderToStaticMarkup(<DetailTooltip tip={tip} />);
  expect(html).toContain('NV. 15');
  expect(html).toContain('data-met="false"');
  expect(html).toContain('Produz');
  expect(html).toContain('R$ 320');
});

it('shows manual medic production, completed requirements and diminishing popularity', () => {
  const own = createGame().players.left;
  own.buildings = [
    { kind: 'school', level: 1, slot: 0, constructionProgress: 1, progress: 0, completedCycles: 0 },
    {
      kind: 'hospital',
      level: 1,
      slot: 1,
      constructionProgress: 1,
      progress: 0,
      completedCycles: 0,
    },
  ];
  const tip = constructionTooltip(
    'hospital',
    'left',
    own,
    35,
    missingBuildingRequirements(own, 'hospital'),
  );
  expect(tip.production).toEqual([
    { side: 'left', kind: 'medic', name: troopName('left', 'medic') },
  ]);
  expect(tip.requirements?.[0].met).toBe(true);
  expect(tip.stats).toEqual(
    expect.arrayContaining([
      { label: 'POP por segundo', value: '+0,35', icon: 'star' },
      { label: 'POP na inauguração', value: '+3,5', icon: 'star' },
    ]),
  );
});
