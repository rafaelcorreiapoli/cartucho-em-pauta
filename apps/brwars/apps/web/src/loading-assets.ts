import { UNIT_PORTRAIT_FILES } from './portrait-art';
import { gameAudio } from './audio';
export interface LoadingState {
  progress: number;
  ready: boolean;
  phase: string;
  error?: boolean;
}
/** Interface images; world textures are downloaded and prepared by Phaser's loader. */
export const HUD_ASSETS = [
  ...UNIT_PORTRAIT_FILES,
  'lobby-showdown.webp',
  'command-portraits.png',
  'research-class-portraits.png',
  'research-category-portraits.png',
  'research-construction.png',
  'research-mobility.webp',
  'research-base_artillery.webp',
  'research-production.webp',
  'promotion-local.webp',
  'promotion-event.webp',
  'spell-bills.webp',
  'spell-recall.webp',
  'spell-silence.webp',
  'spell-strength.webp',
  'spell-sabotage.webp',
];
export async function prepareInterfaceAssets(onProgress: (progress: number) => void) {
  let completed = 0,
    audioProgress = 0;
  const total = HUD_ASSETS.length + 1;
  const update = () => onProgress((completed + audioProgress) / total);
  await Promise.all([
    ...HUD_ASSETS.map(async (file) => {
      const image = new Image();
      image.src = `${import.meta.env.BASE_URL}assets/${file}`;
      await image.decode();
      completed++;
      update();
    }),
    gameAudio.prepare((progress) => {
      audioProgress = progress;
      update();
    }),
  ]);
  await Promise.all([
    ...[600, 700, 800].map((weight) => document.fonts.load(`${weight} 16px "Barlow Condensed"`)),
    ...[400, 500, 600, 700, 800, 900].map((weight) =>
      document.fonts.load(`${weight} 16px "DM Sans"`),
    ),
  ]);
  await document.fonts.ready;
  onProgress(1);
}
