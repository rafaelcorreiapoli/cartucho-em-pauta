import { expect, it } from 'vitest';
import { BASE_GROUND_OFFSET, basePosition, laneX } from './map-layout';
import { workerPose, workerRegion } from './workers';
it('mantém todos os trabalhadores dentro do própria região, atrás da base', () => {
  for (const side of ['left', 'right'] as const) {
    const pen = workerRegion(side);
    let minX = Infinity,
      maxX = -Infinity,
      minY = Infinity,
      maxY = -Infinity;
    for (let index = 0; index < 48; index++)
      for (let time = 0; time < 300; time += 0.25) {
        const pose = workerPose(side, index, time);
        minX = Math.min(minX, pose.x);
        maxX = Math.max(maxX, pose.x);
        minY = Math.min(minY, pose.y);
        maxY = Math.max(maxY, pose.y);
      }
    expect(minX).toBeGreaterThan(pen.x + 20);
    expect(maxX).toBeLessThan(pen.x + pen.width - 20);
    expect(minY).toBeGreaterThan(pen.y + 35);
    expect(maxY).toBeLessThan(pen.y + pen.height - 20);
    if (side === 'left') expect(pen.x + pen.width).toBeLessThan(basePosition(side).x - 108);
    else expect(pen.x).toBeGreaterThan(basePosition(side).x + 108);
  }
});
it('faz pausas e mantém trajetórias contínuas entre ciclos', () => {
  const before = workerPose('left', 0, 11.999),
    after = workerPose('left', 0, 12);
  expect(before.walking).toBe(false);
  expect(after.walking).toBe(true);
  expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.01);
  expect(workerPose('left', 0, 5)).not.toEqual(workerPose('left', 1, 5));
});
it('alinha ataques às bases e entradas de tropas à frente delas', () => {
  expect(laneX(80)).toBe(basePosition('left').x);
  expect(laneX(920)).toBe(basePosition('right').x);
  expect(laneX(105)).toBeGreaterThan(basePosition('left').x);
  expect(laneX(895)).toBeLessThan(basePosition('right').x);
});

it('na Paulista circula em frente à fachada física das duas bases', () => {
  for (const viewer of ['left', 'right'] as const)
    for (const side of ['left', 'right'] as const) {
      const base = basePosition(side, viewer, 'paulista');
      for (let index = 0; index < 12; index++)
        for (let time = 0; time < 30; time++) {
          const pose = workerPose(side, index, time, viewer, 'paulista');
          expect(Math.abs(pose.x - base.x)).toBeLessThan(90);
          expect(pose.y - base.y - BASE_GROUND_OFFSET).toBeGreaterThan(40);
          expect(pose.y - base.y - BASE_GROUND_OFFSET).toBeLessThan(80);
        }
    }
});
