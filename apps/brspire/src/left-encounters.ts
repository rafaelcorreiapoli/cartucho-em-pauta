import { campaignRivals, encounters, regionalRivals, type Rival } from "./catalog";

const [pavanato, trump, mamae, marcal, nando, nikolas] = regionalRivals;
const { moro, olavo, havan, jefferson } = campaignRivals;

const opening: readonly Rival[][] = [
  [pavanato], [mamae], [nando], [nikolas], [marcal],
];

const duos: readonly Rival[][] = [
  [mamae, pavanato], [nikolas, marcal], [nando, mamae], [marcal, pavanato],
  [nikolas, nando], [pavanato, nando], [mamae, marcal], [nikolas, pavanato],
];

const tariffTrump: Rival = { ...trump, intents: [
  { kind: "teamGuard", value: 5, label: "Tarifa de Proteção" },
  { kind: "attack", value: 8, label: "Guerra Comercial" },
  { kind: "attack", value: 6 },
] };
const chairMarcal: Rival = { ...marcal, intents: [
  { kind: "guard", value: 4, label: "Pausa no Debate" },
  { kind: "attack", value: 12, label: "Cadeirada" },
  { kind: "attack", value: 5 },
] };

const late: readonly Rival[][] = [
  [nando, tariffTrump], [chairMarcal, pavanato, tariffTrump], [chairMarcal, mamae, nikolas],
  [nando, marcal, pavanato], [olavo, nikolas, nando], [olavo, mamae, marcal],
  [nikolas, tariffTrump], [mamae, nando, pavanato],
];

export const leftCampaignBosses = new Map<number, Rival>([[6, havan], [12, moro], [17, jefferson]]);

export function leftEncounterOptions(stage: number, progress: number, isBoss: boolean, finalBoss: boolean): readonly (readonly Rival[])[] {
  if (finalBoss) return [encounters[stage].rivals];
  const boss = isBoss && leftCampaignBosses.get(progress);
  if (boss) return [[boss]];
  if (progress === 0) return [[encounters[stage].rivals[0]]];
  if (progress === 14) return [[olavo, marcal], [olavo, nando, nikolas], [olavo, mamae, pavanato]];
  return progress < 3 ? opening : progress < 9 ? duos : late;
}
