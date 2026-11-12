import type { ConsumableId, RelicId } from "./items";
import { startingDeck, type CardId } from "./catalog";

export type Faction = "left" | "right";

export const heroes = {
  flavio: {
    name: "Flávio Bolsonaro",
    title: "O herdeiro do gabinete",
    description: "Promete abrir a caixa-preta. Abre uma caixa de bombons.",
    faction: "right",
    playable: true,
    signatures: ["rachadinha", "tiozaoZap"],
    startingItems: [],
    startingRelics: ["bombons"],
    deck: ["fariaLimer", "fariaLimer", "fariaLimer", "fariaLimer", "cidadaoDeBem", "cidadaoDeBem", "cidadaoDeBem", "cidadaoDeBem", "tiozaoZap", "rachadinha"],
  },
  lula: {
    faction: "left",
    playable: true,
    startingRelics: [],
    name: "Lula",
    title: "A voz do sindicato",
    description: "Handcap natural, mas promete picanha.",
    signatures: ["radio"],
    startingItems: ["picanha"],
    deck: startingDeck,
  },
  che: {
    faction: "left",
    playable: false,
    startingRelics: [],
    name: "Che Guevara",
    title: "O batedor da Sierra",
    description: "Levou um mapa da Sierra Maestra para conquistar o Brasil. Quando percebeu, já tinha convocado uma reunião sobre o desvio.",
    signatures: ["scout"],
    startingItems: [],
    deck: ["scout", "scout", "scout", "militant", "militant", "nurse", "nurse", "nurse", "nurse", "megaphone"],
  },
  stalin: {
    faction: "left",
    playable: false,
    startingRelics: [],
    name: "Stalin",
    title: "O mestre dos cinco anos",
    description: "Tem um plano de cinco anos para cada turno. A comissão ainda está decidindo quem vai embaralhar.",
    signatures: ["foreman"],
    startingItems: [],
    deck: ["foreman", "foreman", "militant", "militant", "militant", "nurse", "nurse", "nurse", "nurse", "radio"],
  },
} satisfies Record<string, {
  faction: Faction;
  playable: boolean;
  startingRelics: readonly RelicId[];
  name: string;
  title: string;
  description: string;
  signatures: readonly CardId[];
  startingItems: readonly ConsumableId[];
  deck: readonly CardId[];
}>;

export type HeroId = keyof typeof heroes;

export function isHeroId(value: string | undefined): value is HeroId {
  return value !== undefined && Object.hasOwn(heroes, value);
}
