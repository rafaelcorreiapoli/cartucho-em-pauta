import type Phaser from 'phaser';
import {characterArt, characterSlugs} from './character-art';
import {NAMES} from './map';
import type {VisitorId} from './visitors';
import {spriteResolution, type SpriteResolution} from './sprite-resolution';

export const actorFrameWorldSize = 128 * .295;
type Variant = {key: string; path: string; size: Exclude<SpriteResolution, 128>};
// Only registered, shipped variants are requested. Walk variants have 3 rows × 4 frames.
// Unique action texture keys can also register variants with identical frame ordering.
const castActions = ['walk', 'attack', 'hit', 'fall', 'phone', 'safe-breach', 'safe-deposit', 'npc-robbery'] as const;
export const actorTextureVariants: Readonly<Record<string, readonly Variant[] | undefined>> = Object.fromEntries(
  Object.entries(characterSlugs).flatMap(([name, slug]) => castActions.map(action => [
    action === 'walk' ? `walk:${name}` : `${slug}-${action}`,
    ([256, 512] as const).map(size => ({key: `${slug}-${action}-${size}`, path: `assets/characters-hd/${slug}-${action}-${size}.webp`, size})),
  ])),
);
type Loads = {pending: Set<string>; failed: Set<string>};
const loads = new WeakMap<Phaser.Game, Loads>();

export function actorTextureResolution(pixelScale: number) {
  // Camera zoom already includes canvas density; multiplying by devicePixelRatio again would double it.
  return spriteResolution(actorFrameWorldSize * pixelScale, 1);
}
function requestVariant(scene: Phaser.Scene, variant: Variant) {
  let state = loads.get(scene.game);
  if (!state) { state = {pending: new Set(), failed: new Set()}; loads.set(scene.game, state); }
  if (state.pending.has(variant.key) || state.failed.has(variant.key)) return;
  state.pending.add(variant.key);
  const current = state;
  const loader = scene.load;
  const event = `filecomplete-spritesheet-${variant.key}`;
  const complete = () => { current.pending.delete(variant.key); loader.off('loaderror', failed); };
  const failed = (file: Phaser.Loader.File) => {
    if (file.key !== variant.key) return;
    current.pending.delete(variant.key); current.failed.add(variant.key);
    loader.off(event, complete); loader.off('loaderror', failed);
  };
  loader.once(event, complete);
  loader.on('loaderror', failed);
  loader.spritesheet(variant.key, import.meta.env.BASE_URL + variant.path, {frameWidth: variant.size, frameHeight: variant.size});
  if (!loader.isLoading()) loader.start();
}
function variantFor(scene: Phaser.Scene, art: string, pixelScale: number): Variant | undefined {
  const variants = actorTextureVariants[art];
  const required = actorTextureResolution(pixelScale);
  if (!variants?.length || required === 128) return;
  const desired = variants.find(variant => variant.size >= required) ?? variants[variants.length - 1];
  // Reuse a larger cached texture instead of downloading a second file for a smaller demand.
  const cached = variants.find(variant => variant.size >= desired.size && scene.textures.exists(variant.key));
  if (cached) return cached;
  requestVariant(scene, desired);
  // Keep drawing a loaded lower tier while the requested one loads or after a failure.
  for (let index = variants.length - 1; index >= 0; index--) {
    const variant = variants[index];
    if (scene.textures.exists(variant.key)) return variant;
  }
}
export function adaptiveWalkArt(scene: Phaser.Scene, character: number, visitor: VisitorId | undefined, pixelScale: number) {
  const base = characterArt(character, visitor);
  const variant = variantFor(scene, visitor ? `${visitor}-walk` : `walk:${NAMES[character]}`, pixelScale);
  if (!variant) return {key: base.sheet.key, frame: base.frame, animation: `${visitor ?? character}`};
  const animation = `adaptive:${variant.key}`;
  if (!scene.anims.exists(`${animation}-0`)) for (let row = 0; row < 3; row++) {
    scene.anims.create({key: `${animation}-${row}`, frames: Array.from({length: 4}, (_, step) => ({key: variant.key, frame: row * 4 + step})), frameRate: 9, repeat: -1});
  }
  return {key: variant.key, frame: 0, animation};
}
export function adaptivePoseArt(scene: Phaser.Scene, art: {key: string; frame: number}, pixelScale: number) {
  const variant = variantFor(scene, art.key, pixelScale);
  return variant ? {...art, key: variant.key} : art;
}
