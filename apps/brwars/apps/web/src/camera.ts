import type { BattlefieldKind, Side } from '@brwars/simulation';
import { MAP_HEIGHT, MAP_WIDTH, basePosition } from './map-layout';
export const VIEW_WIDTH = 1200;
export const VIEW_HEIGHT = 670;
export type CameraView = { x: number; y: number; width: number; height: number };
export function cameraAt(
  x: number,
  y: number,
  width = VIEW_WIDTH,
  height = VIEW_HEIGHT,
): CameraView {
  width = Math.min(width, MAP_WIDTH);
  height = Math.min(height, MAP_HEIGHT);
  return {
    x: Math.max(0, Math.min(MAP_WIDTH - width, x - width / 2)),
    y: Math.max(0, Math.min(MAP_HEIGHT - height, y - height / 2)),
    width,
    height,
  };
}
export function homeCamera(side: Side, zoom = 1, viewer: Side = side, kind?: BattlefieldKind) {
  const base = basePosition(side, viewer, kind);
  return cameraAt(base.x, base.y - 80, VIEW_WIDTH / zoom, VIEW_HEIGHT / zoom);
}

export const DEFAULT_ZOOM = 0.67;
export const MIN_ZOOM = 0.6;
export const MAX_ZOOM = 1.6;
export const clampZoom = (value: number) => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, value));
export function zoomAround(
  position: { x: number; y: number },
  from: number,
  to: number,
  anchor = { x: 0.5, y: 0.5 },
) {
  return {
    x: position.x + anchor.x * VIEW_WIDTH * (1 / from - 1 / to),
    y: position.y + anchor.y * VIEW_HEIGHT * (1 / from - 1 / to),
  };
}
