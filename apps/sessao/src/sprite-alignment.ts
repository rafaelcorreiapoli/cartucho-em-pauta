// Measured head bounds in the top 54 rows of each original 128 px walk cell.
// Anchor the head axis at x=64 without changing painting, feet or vertical bobbing.
const federalWalkX = [.5, 10, 1, 10, -.5, 6, 0, 6, 0, 8.5, .5, 8.5] as const;
export function spriteFrameOffsetX(texture: string, frame: number | string): number {
  if (texture !== 'japones-federal-walk' && texture !== 'assets/japones-federal-walk.png') return 0;
  return federalWalkX[Number(frame)] ?? 0;
}
export function spriteOriginX(texture: string, frame: number | string, flip = false) {
  return .5 - spriteFrameOffsetX(texture, frame) * (flip ? -1 : 1) / 128;
}
