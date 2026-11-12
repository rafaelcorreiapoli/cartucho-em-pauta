import { usesPaulistaLayout, type BattlefieldKind, type Side } from '@brwars/simulation';
import { BASE_GROUND_OFFSET, TERRAIN_WIDTH, basePosition, mapPoint, worldX } from './map-layout';
export function workerRegion(side: Side, kind?: BattlefieldKind) {
  if (usesPaulistaLayout(kind)) {
    const base = basePosition(side, 'left', kind);
    return { x: base.x - 120, y: base.y + BASE_GROUND_OFFSET - 2, width: 240, height: 105 };
  }
  return mapPoint({
    x: side === 'left' ? 50 : TERRAIN_WIDTH - 350,
    y: 570,
    width: 300,
    height: 180,
  });
}
function random(seed: number) {
  const value = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
  return value - Math.floor(value);
}
/** Cosmetic routes derived from match time: no frame-rate drift or simulation commands. */
export function workerPose(
  side: Side,
  index: number,
  time: number,
  viewer: Side = 'left',
  kind?: BattlefieldKind,
) {
  const pen = workerRegion(side, kind),
    groundY = usesPaulistaLayout(kind)
      ? basePosition(side, viewer, kind).y + BASE_GROUND_OFFSET - 2
      : pen.y,
    clock = Math.max(0, time) + index * 2.37,
    cycle = Math.floor(clock / 12),
    phase = clock % 12;
  const point = (step: number) => ({
    x: pen.x + 35 + random(index * 97 + step * 11 + 1) * (pen.width - 70),
    y: groundY + 50 + random(index * 61 + step * 19 + 2) * (pen.height - 75),
  });
  const from = point(cycle),
    to = point(cycle + 1),
    fraction = Math.min(1, phase / 9);
  return {
    x: worldX(from.x + (to.x - from.x) * fraction, viewer),
    y: from.y + (to.y - from.y) * fraction,
    walking: phase < 9,
    flipX: to.x < from.x !== (viewer === 'right'),
  };
}
