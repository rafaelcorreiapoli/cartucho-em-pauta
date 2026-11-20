import {expect, test} from 'bun:test';
import {spriteFrameOffsetX, spriteOriginX} from './sprite-alignment';

test('federal walk keeps the measured head axis fixed in every row and step', () => {
  const measuredHeadCenters = [63.5, 54, 63, 54, 64.5, 58, 64, 58, 64, 55.5, 63.5, 55.5];
  measuredHeadCenters.forEach((center, frame) => {
    expect(center + spriteFrameOffsetX('japones-federal-walk', frame)).toBe(64);
    expect(center + spriteFrameOffsetX('assets/japones-federal-walk.png', frame)).toBe(64);
  });
  expect(spriteOriginX('japones-federal-walk', 5, true)).toBe(.5 + 6 / 128);
  expect(spriteOriginX('players', 1)).toBe(.5);
  expect(spriteOriginX('japones-federal-door-breach', 1)).toBe(.5);
});
