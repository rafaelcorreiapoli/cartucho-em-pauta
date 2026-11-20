import {expect, test} from 'bun:test';
import {spriteResolution} from './sprite-resolution';

test('uses physical pixel demand, including high density small screens', () => {
  expect(spriteResolution(100, 1)).toBe(128);
  expect(spriteResolution(176, 1)).toBe(256);
  expect(spriteResolution(100, 3)).toBe(512);
  expect(spriteResolution(128, 1)).toBe(128);
  expect(spriteResolution(128.1, 1)).toBe(256);
  expect(spriteResolution(256, 2)).toBe(512);
  expect(spriteResolution(900, 2)).toBe(512);
});
