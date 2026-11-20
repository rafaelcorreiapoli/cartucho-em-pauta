import data from './world-assets.json';

type AssetVariant = {key: string; path: string; width: number; height: number; size: number};
type WorldAsset = {id: string; kind: string; width: number; height: number; variants: AssetVariant[]};
export const worldAssets: Readonly<Record<string, WorldAsset | undefined>> = data;

/** Native browser source selection; sizes describes the image's rendered CSS width. */
export function assetImageSources(filename: string, sizes = '48px') {
  const asset = worldAssets[filename];
  return {
    src: `${import.meta.env.BASE_URL}assets/${filename}`,
    ...(asset?.kind === 'image' ? {
      srcSet: asset.variants.map(variant => `${import.meta.env.BASE_URL}${variant.path} ${variant.width}w`).join(', '),
      sizes,
    } : {}),
  };
}
