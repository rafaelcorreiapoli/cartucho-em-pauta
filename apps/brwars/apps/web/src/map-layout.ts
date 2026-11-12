import {
  battlefieldLayout,
  LANE_ROW_SPACING,
  MAP_WIDTH as TERRAIN_WIDTH,
  MAP_HEIGHT as TERRAIN_HEIGHT,
  opposite,
  type BattlefieldKind,
  type Side,
} from '@brwars/simulation';

export { TERRAIN_WIDTH, TERRAIN_HEIGHT };

export const MAP_MARGIN_X = 320;
export const MAP_MARGIN_Y = 140;
export const MAP_WIDTH = TERRAIN_WIDTH + 2 * MAP_MARGIN_X;
export const MAP_HEIGHT = TERRAIN_HEIGHT + 2 * MAP_MARGIN_Y;

export function mapPoint<T extends { x: number; y: number }>(point: T): T {
  return { ...point, x: point.x + MAP_MARGIN_X, y: point.y + MAP_MARGIN_Y };
}

export const BASE_GROUND_OFFSET = 33;
export const BASE_HEALTH_Y_OFFSET = 148;
export const BUILDING_GROUND_OFFSET = 21;

export const worldX = (x: number, viewer: Side = 'left') =>
  viewer === 'right' ? MAP_WIDTH - x : x;

export function basePosition(side: Side, viewer: Side = 'left', kind?: BattlefieldKind) {
  const { x, y } = battlefieldLayout(kind).bases[viewer === 'left' ? side : opposite(side)];
  return mapPoint({ x, y });
}

export function buildingPosition(
  side: Side,
  slot: number,
  viewer: Side = 'left',
  kind?: BattlefieldKind,
) {
  const physicalSide = viewer === 'left' ? side : opposite(side);
  const plot = battlefieldLayout(kind).plots[physicalSide].find((plot) => plot.slot === slot);
  if (!plot) throw new Error(`Terreno inválido: ${side}/${slot}`);
  return mapPoint({ x: plot.x, y: plot.y });
}

export function constructionFrame(progress: number, time: number) {
  const stage = Math.min(3, Math.max(0, Math.floor(progress * 4)));
  return stage * 2 + (Math.floor(time * 4) % 2);
}

function laneProgress(x: number, viewer: Side) {
  const progress = (x - 80) / 840;
  return viewer === 'left' ? progress : 1 - progress;
}

export function laneX(x: number, viewer: Side = 'left', kind?: BattlefieldKind) {
  const { from, to } = battlefieldLayout(kind).route;
  return MAP_MARGIN_X + from + laneProgress(x, viewer) * (to - from);
}

export function laneY(
  row: number,
  kind: BattlefieldKind | undefined,
  x: number,
  viewer: Side = 'left',
) {
  const { y, endY } = battlefieldLayout(kind).route;
  return MAP_MARGIN_Y + y + laneProgress(x, viewer) * (endY - y) + row * LANE_ROW_SPACING;
}
