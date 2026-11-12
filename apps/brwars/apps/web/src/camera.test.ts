import { battlefieldLayout } from '@brwars/simulation';
import { describe, expect, it } from 'vitest';
import { cameraAt, homeCamera, VIEW_HEIGHT, VIEW_WIDTH } from './camera';
import {
  basePosition,
  buildingPosition,
  MAP_HEIGHT,
  MAP_WIDTH,
  MAP_MARGIN_X,
  MAP_MARGIN_Y,
} from './map-layout';
describe('RTS camera bounds', () => {
  it('clamps every edge while retaining the viewport dimensions', () => {
    expect(cameraAt(-100, -100)).toEqual({ x: 0, y: 0, width: VIEW_WIDTH, height: VIEW_HEIGHT });
    expect(cameraAt(10000, 10000)).toEqual({
      x: MAP_WIDTH - VIEW_WIDTH,
      y: MAP_HEIGHT - VIEW_HEIGHT,
      width: VIEW_WIDTH,
      height: VIEW_HEIGHT,
    });
  });
  it('starts at either faction base and keeps that base visible', () => {
    for (const side of ['left', 'right'] as const) {
      const view = homeCamera(side),
        base = basePosition(side, side);
      expect(base.x).toBeGreaterThanOrEqual(view.x);
      expect(base.x).toBeLessThan(view.x + view.width);
      expect(base.y).toBeGreaterThan(view.y);
      expect(base.y).toBeLessThan(view.y + view.height);
    }
    expect(homeCamera('left')).toEqual(homeCamera('right'));
  });
  it('centers a minimap target in the interior', () => {
    const view = cameraAt(1200, 600);
    expect(view.x + view.width / 2).toBe(1200);
    expect(view.y + view.height / 2).toBe(600);
  });
});

it('mantém 48 terrenos únicos, espelhados e dentro do mapa', () => {
  const positions = Array.from({ length: 48 }, (_, slot) => buildingPosition('left', slot));
  expect(new Set(positions.map(({ x, y }) => `${x}:${y}`)).size).toBe(48);
  for (let slot = 0; slot < 48; slot++) {
    const left = positions[slot],
      right = buildingPosition('right', slot);
    expect(left.x).toBeGreaterThan(60);
    expect(left.y).toBeGreaterThan(120);
    expect(left.y).toBeLessThan(MAP_HEIGHT - 60);
    expect(left.x + right.x).toBe(MAP_WIDTH);
    expect(left.y).toBe(right.y);
  }
});

it('zoom mantém o ponto de ancoragem sob o cursor e respeita limites', async () => {
  const { zoomAround, clampZoom, MIN_ZOOM, MAX_ZOOM } = await import('./camera');
  const position = { x: 200, y: 100 },
    anchor = { x: 0.3, y: 0.7 },
    from = 1,
    to = 0.67;
  const next = zoomAround(position, from, to, anchor);
  expect(next.x + (anchor.x * VIEW_WIDTH) / to).toBeCloseTo(
    position.x + (anchor.x * VIEW_WIDTH) / from,
  );
  expect(next.y + (anchor.y * VIEW_HEIGHT) / to).toBeCloseTo(
    position.y + (anchor.y * VIEW_HEIGHT) / from,
  );
  expect(clampZoom(0.01)).toBe(MIN_ZOOM);
  expect(clampZoom(10)).toBe(MAX_ZOOM);
});

it('começa com seis terrenos na primeira fileira inferior e mantém três fileiras de cada lado da estrada', () => {
  const rows = new Map<number, number>();
  for (let slot = 0; slot < 48; slot++) {
    const { y } = buildingPosition('left', slot);
    rows.set(y, (rows.get(y) ?? 0) + 1);
    if (slot < 6) expect(y).toBeGreaterThan(basePosition('left').y);
  }
  expect(rows.size).toBe(6);
  expect([...rows.values()]).toEqual([8, 8, 8, 8, 8, 8]);
  expect([...rows.keys()].filter((y) => y < basePosition('left').y)).toHaveLength(3);
});

it.each(['paulista', 'floresta', 'deserto'] as const)(
  '%s ganha espaço nas quatro bordas sem mudar a disposição dos lotes',
  (kind) => {
    for (const side of ['left', 'right'] as const)
      for (const { slot, x, y } of battlefieldLayout(kind).plots[side]) {
        const plot = buildingPosition(side, slot, 'left', kind);
        expect(plot).toEqual({ x: x + MAP_MARGIN_X, y: y + MAP_MARGIN_Y });
        expect(Math.min(plot.x, MAP_WIDTH - plot.x)).toBeGreaterThanOrEqual(420);
        expect(Math.min(plot.y, MAP_HEIGHT - plot.y)).toBeGreaterThanOrEqual(185);
      }
  },
);
