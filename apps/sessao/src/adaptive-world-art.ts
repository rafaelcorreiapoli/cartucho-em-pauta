import type Phaser from 'phaser';
import {requestArtTexture} from './adaptive-character-art';
import {worldAssets} from './world-assets';

const registered = new Map<string, NonNullable<(typeof worldAssets)[string]>>();
type Base = {key: string; frame: string | number};
const bases = new WeakMap<Phaser.GameObjects.Image, Base>();

export function registerWorldArt(key: string, filename: string) {
  const asset = worldAssets[filename];
  if (asset && asset.kind !== 'animation') registered.set(key, {...asset, variants: asset.variants.filter(variant => variant.width > asset.width || variant.height > asset.height)});
}
export function loadWorldImage(scene: Phaser.Scene, key: string, filename: string) {
  registerWorldArt(key, filename);
  scene.load.image(key, `${import.meta.env.BASE_URL}assets/${filename}`);
}

export function worldArtKey(image: Phaser.GameObjects.Image) {
  const base = bases.get(image);
  return base && registered.get(base.key)?.variants.some(variant => variant.key === image.texture.key) ? base.key : image.texture.key;
}

/** Share the same detail selection in the live map, surveillance and saved photos. */
export function updateWorldArt(scene: Phaser.Scene, pixelScale: number, viewport: {x: number; y: number; width: number; height: number} | undefined = scene.cameras.main.visible ? scene.cameras.main.worldView : undefined) {
  function visit(children: readonly Phaser.GameObjects.GameObject[]) {
    for (const child of children) {
      if (!child.active || !(child as Phaser.GameObjects.Image).visible) continue;
      if (child.type === 'Container') {
        visit((child as Phaser.GameObjects.Container).list);
        continue;
      }
      if (child.type !== 'Image' && child.type !== 'Sprite') continue;
      const image = child as Phaser.GameObjects.Image;
      let base = bases.get(image);
      // An open/closed safe can change its base texture independently of detail selection.
      if (!base || image.texture.key !== base.key && registered.has(image.texture.key) || image.texture.key === base.key && image.frame.name !== base.frame) {
        base = {key: image.texture.key, frame: image.frame.name};
        bases.set(image, base);
      }
      const asset = registered.get(base.key);
      if (!asset) continue;
      if (viewport && viewport.width > 0) {
        const bounds = image.getBounds();
        if (bounds.right < viewport.x || bounds.left > viewport.x + viewport.width || bounds.bottom < viewport.y || bounds.top > viewport.y + viewport.height) continue;
      }
      const width = Math.abs(image.displayWidth), height = Math.abs(image.displayHeight);
      const requiredWidth = width * pixelScale, requiredHeight = height * pixelScale;
      let key = base.key;
      if (requiredWidth > asset.width || requiredHeight > asset.height) {
        const variants = asset.variants;
        const desired = variants.find(variant => variant.width >= requiredWidth && variant.height >= requiredHeight) ?? variants.at(-1);
        if (desired) {
          const cached = variants.find(variant => variant.width >= desired.width && scene.textures.exists(variant.key));
          if (cached) key = cached.key;
          else {
            requestArtTexture(scene, desired, asset.kind === 'atlas' ? {width: desired.width, height: desired.height} : undefined);
            key = [...variants].reverse().find(variant => scene.textures.exists(variant.key))?.key ?? base.key;
          }
        }
      }
      if (image.texture.key !== key) image.setTexture(key, base.frame).setDisplaySize(width, height);
    }
  }
  visit(scene.children.list);
}
