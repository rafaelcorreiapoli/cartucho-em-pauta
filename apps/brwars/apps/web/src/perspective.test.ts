import { expect, it } from 'vitest';
import { spawnPosition } from '@brwars/simulation';
import {
  BASE_GROUND_OFFSET,
  basePosition,
  buildingPosition,
  laneX,
  laneY,
  MAP_WIDTH,
  MAP_MARGIN_X,
  worldX,
} from './map-layout';
import { homeCamera } from './camera';
import { workerPose } from './workers';
it.each(['left', 'right'] as const)(
  'jogador %s começa à esquerda e suas tropas avançam para a direita',
  (side) => {
    const enemy = side === 'left' ? 'right' : 'left';
    const ownBase = basePosition(side, side),
      enemyBase = basePosition(enemy, side);
    expect(ownBase.x).toBe(460 + MAP_MARGIN_X);
    expect(enemyBase.x).toBe(1940 + MAP_MARGIN_X);
    const spawn = spawnPosition(side),
      advance = side === 'left' ? 10 : -10;
    expect(laneX(spawn, side)).toBeGreaterThan(ownBase.x);
    expect(laneX(spawn + advance, side)).toBeGreaterThan(laneX(spawn, side));
    for (const zoom of [0.6, 0.67, 1, 1.6]) {
      const camera = homeCamera(side, zoom);
      expect(ownBase.x).toBeGreaterThanOrEqual(camera.x);
      expect(ownBase.x).toBeLessThan(camera.x + camera.width);
    }
    for (let slot = 0; slot < 48; slot++) {
      expect(buildingPosition(side, slot, side).x).toBeLessThan(MAP_WIDTH / 2);
      expect(buildingPosition(enemy, slot, side).x).toBeGreaterThan(MAP_WIDTH / 2);
    }
  },
);
it('a projeção mantém minimapa, marcadores e coordenadas do mundo no mesmo espelhamento reversível', () => {
  for (const x of [0, 120, 460, 1200, 1940, 2400]) {
    expect(worldX(worldX(x, 'right'), 'right')).toBe(x);
    expect(worldX(x, 'left')).toBe(x);
  }
  for (let slot = 0; slot < 48; slot++)
    expect(buildingPosition('right', slot, 'right')).toEqual(
      buildingPosition('left', slot, 'left'),
    );
});
it('trabalhadores espelhados permanecem atrás da própria base e invertem a orientação do sprite', () => {
  for (let index = 0; index < 10; index++)
    for (let time = 0; time < 24; time += 0.5) {
      const canonical = workerPose('right', index, time);
      const projected = workerPose('right', index, time, 'right');
      expect(projected.x).toBe(MAP_WIDTH - canonical.x);
      expect(projected.x).toBeLessThan(basePosition('right', 'right').x);
      expect(projected.y).toBe(canonical.y);
      expect(projected.flipX).toBe(!canonical.flipX);
    }
});

it('a Paulista mantém o terreno e a mesma diagonal ao trocar a facção do jogador', () => {
  const battlefield = 'paulista';
  const left = basePosition('left', 'left', battlefield);
  const right = basePosition('right', 'left', battlefield);
  expect(basePosition('right', 'right', battlefield)).toEqual(left);
  expect(basePosition('left', 'right', battlefield)).toEqual(right);
  expect(right.y).toBeGreaterThan(left.y);

  for (const viewer of ['left', 'right'] as const) {
    const start = viewer === 'left' ? 80 : 920;
    const end = viewer === 'left' ? 920 : 80;
    expect({
      x: laneX(start, viewer, battlefield),
      y: laneY(2, battlefield, start, viewer),
    }).toEqual({ ...left, y: left.y + BASE_GROUND_OFFSET });
    expect({ x: laneX(end, viewer, battlefield), y: laneY(2, battlefield, end, viewer) }).toEqual({
      ...right,
      y: right.y + BASE_GROUND_OFFSET,
    });
    expect(laneY(2, battlefield, 500, viewer)).toBe((left.y + right.y) / 2 + BASE_GROUND_OFFSET);
    expect(buildingPosition(viewer, 1, viewer, battlefield)).toEqual(
      buildingPosition('left', 1, 'left', battlefield),
    );
  }
});
