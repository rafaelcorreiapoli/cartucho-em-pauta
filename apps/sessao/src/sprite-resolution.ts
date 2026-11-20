export const spriteResolutions = [128, 256, 512] as const;
export type SpriteResolution = (typeof spriteResolutions)[number];

/** Choose texture detail from physical pixels, independently of world/camera size. */
export function spriteResolution(displaySize: number, density: number): SpriteResolution {
  const pixels = Math.max(1, displaySize) * Math.max(1, density);
  return spriteResolutions.find(size => size >= pixels) ?? 512;
}
