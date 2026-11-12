import { VIEW_HEIGHT, VIEW_WIDTH } from '../camera';

/** Supersample text and sprites without unbounded GPU allocations. */
export function renderScale(width: number, height: number, pixelRatio: number) {
  return Math.min(
    3,
    Math.max(1, Math.ceil((pixelRatio || 1) * Math.max(width / VIEW_WIDTH, height / VIEW_HEIGHT))),
  );
}
