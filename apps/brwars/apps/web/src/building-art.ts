import { TIER_LEVEL, type BuildingKind, type Side } from '@brwars/simulation';
export const EVOLVING_BUILDINGS = ['barracks', 'media', 'garage', 'housing', 'workplace'] as const;
export const EVOLUTION_FRAME_SIZE = 512;
export const evolutionTexture = (kind: (typeof EVOLVING_BUILDINGS)[number]) =>
  `evolved-${kind}` as const;

export function buildingStage(level: number) {
  if (level >= TIER_LEVEL[3]) return 3;
  if (level >= TIER_LEVEL[2]) return 2;
  if (level >= TIER_LEVEL[1]) return 1;
  return 0;
}

const atlases = {
  academy: 'academies',
  bank: 'banks',
  housing: 'housing',
  civic: 'civic',
  school: 'schools',
  hospital: 'hospitals',
  workplace: 'workplaces',
} as const;
export function buildingArt(kind: BuildingKind, side: Side, level = 1) {
  const stage = buildingStage(level);
  const evolving = EVOLVING_BUILDINGS.find((candidate) => candidate === kind);
  if (stage && evolving) {
    const texture = evolutionTexture(evolving);
    return {
      texture,
      file: `${texture}.webp`,
      frame: (side === 'left' ? 0 : 3) + stage - 1,
      width: EVOLUTION_FRAME_SIZE,
      height: EVOLUTION_FRAME_SIZE,
      columns: 3,
      sheetWidth: EVOLUTION_FRAME_SIZE * 3,
      sheetHeight: EVOLUTION_FRAME_SIZE * 2,
    };
  }
  if (kind === 'park' || kind === 'depot') {
    return {
      texture: 'park-depot' as const,
      file: 'park-depot-v3.webp',
      frame: (kind === 'depot' ? 2 : 0) + (side === 'right' ? 1 : 0),
      width: 512,
      height: 512,
      columns: 2,
      sheetWidth: 1024,
      sheetHeight: 1024,
    };
  }
  if (kind in atlases) {
    const texture = kind as keyof typeof atlases;
    return {
      texture,
      file: `${atlases[texture]}.png`,
      frame: side === 'left' ? 0 : 1,
      width: 768,
      height: 1024,
      columns: 2,
      sheetWidth: 1536,
      sheetHeight: 1024,
    };
  }
  return {
    texture: 'buildings' as const,
    file: 'buildings.png',
    frame:
      (side === 'left' ? 0 : 4) +
      { barracks: 0, media: 1, garage: 2 }[kind as 'barracks' | 'media' | 'garage'],
    width: 384,
    height: 512,
    columns: 4,
    sheetWidth: 1536,
    sheetHeight: 1024,
  };
}

export function buildingDisplaySize(texture: string) {
  if (texture.startsWith('evolved-')) return { width: 104, height: 104 };
  return { width: 92, height: texture === 'park-depot' ? 92 : 108 };
}
