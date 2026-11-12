import { leftRivalSprites } from "./right-encounters";
import { campaignRivals } from "./catalog";
import { cards, encounters } from "./catalog";
import { eventCatalog } from "./event-catalog";
import { heroes, type HeroId } from "./heroes";
import { heroFrameAssets } from "./sprite";
import { consumables, relics } from "./items";
import { gameAudio } from "./audio";

async function loadImage(url: string) {
  const image = new Image();
  const timeout = window.setTimeout(() => image.removeAttribute("src"), 15_000);
  try {
    image.src = url;
    await image.decode();
  } catch {
    console.warn("Imagem indisponível durante o carregamento:", url);
  } finally {
    window.clearTimeout(timeout);
  }
}

export async function loadGameAssets(asset: (name: string) => string, onProgress: (percent: number) => void) {
  const rivals = new Set(encounters.flatMap(({ rivals }) => rivals.map(({ id }) => id)));
  const images = new Set([
    "faction-left", "faction-right", "shop-merchant",
    ...[...Object.values(relics), ...Object.values(consumables)].map(({ image }) => image),
    ...Object.values(cards).map(({ image }) => image),
    ...encounters.map(({ arena }) => arena),
    ...eventCatalog.map(({ id }) => `event-${id}`),
    ...leftRivalSprites.flatMap((sprite) => ["idle", "attack", "hit", "defeat"].map((pose) => `${sprite}-${pose}`)),
    ...Object.values(campaignRivals).flatMap(({ id }) => [`rival-${id}-idle`, `rival-${id}-sheet`]),
    ...[...rivals].flatMap((id) => [`rival-${id}-idle`, `rival-${id}-sheet`]),
    ...(Object.keys(heroes) as HeroId[]).flatMap((id) => [
      `${id}-portrait`, `${id}-idle`,
      ...heroFrameAssets(id),
    ]),
  ]);
  const urls = [...[...images].map(asset), `${import.meta.env.BASE_URL}assets/brasil.svg`];
  const audio = gameAudio.prefetch();
  const total = urls.length + audio.length;
  let loaded = 0;
  const advance = () => onProgress(Math.round(++loaded * 100 / total));

  async function loadImages() {
    for (let url = urls.pop(); url !== undefined; url = urls.pop()) {
      await loadImage(url);
      advance();
    }
  }

  await Promise.all([
    ...Array.from({ length: 8 }, loadImages),
    ...audio.map((request) => request.then(advance)),
  ]);
}
