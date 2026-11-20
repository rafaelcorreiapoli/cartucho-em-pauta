import {worldAssets} from './world-assets';
import {NAMES} from './map';
import {characterArt, characterSheets, combatSheets, phoneSheets, safeBreachSheets, safeDepositSheets, npcRobberySheets, attackArt, phoneArt, safeBreachArt, safeDepositArt, npcRobberyArt} from './character-art';
import {visitorRoster, visitorSheets} from './visitors';
import {federalPatrolRules, federalPatrolSheets} from './federal-patrol';
import {mapNpcs} from './npcs';

export type SpriteDirection = {label: string; row: number; flip?: boolean};
export type SpriteClip = {id: string; name: string; path: string; size: number; start: number; count: number; fps: number; directions: readonly SpriteDirection[]; loop: boolean};
export type SpriteSubject = {id: string; name: string; group: string; clips: SpriteClip[]};
const directions: readonly SpriteDirection[] = [
  {label: 'Frente', row: 0}, {label: 'Direita', row: 1},
  {label: 'Costas', row: 2}, {label: 'Esquerda · espelhado', row: 1, flip: true},
];
const fixed = (label: string): readonly SpriteDirection[] => [{label, row: 0}];
const sheets = [...characterSheets, ...combatSheets, ...phoneSheets, ...safeBreachSheets, ...safeDepositSheets, ...npcRobberySheets, ...visitorSheets, ...federalPatrolSheets];
function path(key: string) {
  const sheet = sheets.find(sheet => sheet.key === key);
  if (!sheet) throw new Error(`Spritesheet não registrada: ${key}`);
  return sheet.path;
}
function clip(id: string, name: string, key: string, options: Partial<Omit<SpriteClip, 'id' | 'name' | 'path'>> = {}): SpriteClip {
  return {id, name, path: path(key), size: 128, start: 0, count: 4, fps: 9, directions, loop: true, ...options};
}
function walking(key: string, start = 0) {
  return [clip('idle', 'Parado', key, {start, count: 1}), clip('walk', 'Caminhar', key, {start})];
}
const players = NAMES.map((name, character): SpriteSubject => {
  const {sheet, frame} = characterArt(character);
  const actor = {x: 0, y: 0, direction: 1};
  const phone = phoneArt(character, 0, false)!;
  const breach = safeBreachArt(character, 0, false)!;
  const deposit = safeDepositArt(character, 0, false)!;
  const robbery = npcRobberyArt(character, 0, false, actor, {...actor, x: 1})!;
  const attack = attackArt(character, 0, 0, .5)!;
  return {id: phone.key.replace(/-phone$/, ''), name, group: 'Jogadores', clips: [
    ...walking(sheet.key, frame),
    clip('attack', 'Atacar', attack.key, {fps: 10, loop: false}),
    clip('hit', 'Receber golpe', attack.key.replace(/-attack$/, '-hit'), {fps: 1000 / 55, loop: false}),
    clip('fall', 'Cair / caído', attack.key.replace(/-attack$/, '-fall'), {fps: 10, loop: false}),
    clip('phone', 'Usar celular', phone.key, {fps: 1000 / 135, directions: fixed('Frente')}),
    clip('safe-breach', 'Arrombar cofre', breach.key, {fps: 5, directions: fixed('Pose única')}),
    clip('safe-deposit', 'Recolher dinheiro', deposit.key, {count: 8, fps: 5, directions: fixed('Pose única')}),
    clip('npc-robbery', 'Saquear visitante', robbery.key, {count: 8, fps: 1000 / 180, directions: [{label: 'Direita', row: 0}, {label: 'Esquerda · espelhado', row: 0, flip: true}]}),
  ]};
});
export const spriteCatalog: SpriteSubject[] = [
  ...players,
  ...visitorRoster.map(({id, name}): SpriteSubject => ({id, name, group: 'Visitantes', clips: [
    ...walking(`${id}-walk`),
    clip('hit', 'Receber golpe', `${id}-hit`, {fps: 1000 / 55, loop: false}),
    clip('fall', 'Cair / caído', `${id}-fall`, {fps: 10, loop: false}),
  ]})),
  {id: federalPatrolRules.skin, name: federalPatrolRules.name, group: 'Federal', clips: [
    ...walking(`${federalPatrolRules.skin}-walk`),
    clip('door-breach', 'Arrombar porta', `${federalPatrolRules.skin}-door-breach`, {fps: 5, directions: directions.map((direction, row) => ({label: row === 3 ? 'Esquerda' : direction.label, row}))}),
  ]},
  {id: 'lula-safe-breach-imagegen', name: 'Lula · cofre ImageGen', group: 'Experimento de enquadramento', clips: [
    {...players[0].clips.find(clip => clip.id === 'safe-breach')!, path: 'assets/lula-safe-breach-imagegen.png'},
  ]},
  ...([256, 512] as const).map((size): SpriteSubject => ({
    id: `tiririca-test-${size}`, name: `Tiririca · teste ${size} px`, group: 'Experimento de nitidez',
    clips: [1, 4].map(count => ({id: count === 1 ? 'idle' : 'walk', name: count === 1 ? 'Parado' : 'Caminhar', path: `assets/tiririca-walk-${size}.png`, size, start: 0, count, fps: 9, directions, loop: true})),
  })),
  ...Object.entries(worldAssets).filter(([filename]) => !Object.values(mapNpcs).some(npc => npc.sprite === filename)).filter(([,asset]) => asset?.kind !== 'animation').map(([filename,asset]): SpriteSubject => ({
    id: `asset:${asset!.id}`, name: asset!.id.replaceAll('-', ' '), group: 'Objetos e interface', clips: [
      {id: 'idle', name: asset!.kind === 'atlas' ? 'Atlas completo' : 'Imagem', path: `assets/${filename}`, size: 0, start: 0, count: 1, fps: 1, directions: fixed('Original'), loop: true},
    ],
  })),
  ...Object.entries(mapNpcs).map(([id, npc]): SpriteSubject => ({id: `npc-${id}`, name: npc.name, group: 'NPCs fixos', clips: [
    {id: 'idle', name: 'Pose única', path: `assets/${npc.sprite}`, size: 0, start: 0, count: 1, fps: 1, directions: fixed('Original'), loop: true},
  ]})),
];

/** Rows in walking atlases always have four columns, even for a one-frame idle clip. */
export function spriteFrame(clip: SpriteClip, direction: number, frame: number) {
  return clip.start + clip.directions[direction].row * 4 + frame;
}

/** Inspect the exact shipped tier while retaining legacy art for visual comparison. */
export function spriteSubjectResolution(subject: SpriteSubject, resolution: string): SpriteSubject {
  const character = players.findIndex(player => player.id === subject.id);
  if (character < 0) return {...subject, clips: subject.clips.map(clip => {
    const entry = Object.entries(worldAssets).find(([filename,asset]) => clip.path === `assets/${filename}` || asset?.variants.some(variant => variant.path === clip.path));
    if (!entry) return clip;
    const [filename,asset] = entry;
    if (resolution === 'original') return {...clip, path: `assets/${filename}`, size: asset!.kind === 'animation' ? 128 : clip.size};
    const variant = asset!.variants.find(variant => variant.size === (asset!.id === 'office' ? Number(resolution)*1.5 : Number(resolution)));
    return variant ? {...clip, path: variant.path, size: clip.size ? variant.width : 0, start: 0} : clip;
  })};
  return {...subject, clips: players[character].clips.map(clip => {
    const walk = clip.id === 'walk' || clip.id === 'idle';
    if (resolution === 'original') return {...clip,
      path: walk ? `assets/${character < 3 ? 'sprites-hd.png' : 'sprites-expansao.png'}` : `assets/${subject.id}-${clip.id}.webp`};
    const size = Number(resolution);
    return {...clip, path: `assets/characters-hd/${subject.id}-${walk ? 'walk' : clip.id}-${size}.webp`, size, start: 0};
  })};
}

export function spriteSubjectHasResolutions(subject: SpriteSubject) {
  return subject.group === 'Jogadores' || subject.clips.some(clip => Object.entries(worldAssets).some(([filename,asset]) => clip.path === `assets/${filename}` || asset?.variants.some(variant => variant.path === clip.path)));
}
