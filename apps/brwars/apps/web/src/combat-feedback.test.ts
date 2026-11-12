import { expect, it } from 'vitest';
import { PendingImpacts } from './combat-feedback';
it('holds lethal and overlapping damage until each visual impact arrives', () => {
  const pending = new PendingImpacts();
  pending.add(1, 15);
  pending.add(1, 20);
  expect(pending.health(1, -10, 25)).toBe(25);
  expect(pending.has(1)).toBe(true);
  pending.resolve(1, 15);
  expect(pending.health(1, -10, 25)).toBe(10);
  expect(pending.has(1)).toBe(true);
  pending.resolve(1, 20);
  expect(pending.has(1)).toBe(false);
});
it('clears delayed damage on session changes and tolerates resolved base hits', () => {
  const pending = new PendingImpacts();
  pending.add(1, 20);
  pending.clear();
  pending.resolve(1, 20);
  expect(pending.has(1)).toBe(false);
  expect(pending.health(1, 80, 100)).toBe(80);
});
