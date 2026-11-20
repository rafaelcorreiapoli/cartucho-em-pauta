import {expect, test} from 'bun:test';
import {spriteCatalog, spriteFrame} from './sprite-catalog';
import {characterSheets, collantSheets, combatSheets, phoneSheets, safeBreachSheets, safeDepositSheets, npcRobberySheets, characterArt} from './character-art';
import {visitorSheets} from './visitors';
import {federalPatrolSheets} from './federal-patrol';
import {NAMES} from './map';

test('review catalog covers every character animation sheet loaded by the game', async () => {
  const paths = new Set(spriteCatalog.flatMap(subject => subject.clips.map(clip => clip.path)));
  for (const sheet of [...collantSheets, ...characterSheets, ...combatSheets, ...phoneSheets, ...safeBreachSheets, ...safeDepositSheets, ...npcRobberySheets, ...visitorSheets, ...federalPatrolSheets]) {
    expect(paths.has(sheet.path)).toBe(true);
  }
  for (const path of paths) expect(await Bun.file(new URL(`../public/${path}`, import.meta.url)).exists()).toBe(true);
  expect(new Set(spriteCatalog.map(subject => subject.id)).size).toBe(spriteCatalog.length);
});

test('walking and idle preserve character rows and game direction mirroring', () => {
  NAMES.forEach((name, index) => {
    const subject = spriteCatalog.find(subject => subject.name === name)!;
    const {frame} = characterArt(index);
    for (const id of ['walk', 'idle']) {
      const clip = subject.clips.find(clip => clip.id === id)!;
      expect(spriteFrame(clip, 0, 0)).toBe(frame);
      expect(spriteFrame(clip, 2, 0)).toBe(frame + 8);
      expect(spriteFrame(clip, 3, 0)).toBe(frame + 4);
      expect(clip.directions[3].flip).toBe(true);
    }
  });
  const federal = spriteCatalog.find(subject => subject.group === 'Federal')!;
  const breach = federal.clips.find(clip => clip.id === 'door-breach')!;
  expect(spriteFrame(breach, 3, 3)).toBe(15);
  expect(breach.directions[3].flip).toBeUndefined();
});

test('Collant review exposes every action, all detail tiers and its explicit left-facing walk',()=>{
  const collant=spriteCatalog.find(subject=>subject.id==='collant')!;
  expect(collant.clips.map(clip=>clip.id)).toEqual(['idle','walk','attack','hit','fall','phone','safe-breach','safe-deposit','npc-robbery']);
  const walk=collant.clips.find(clip=>clip.id==='walk')!;
  expect(spriteFrame(walk,3,3)).toBe(15);
  expect(walk.directions[3].flip).toBeUndefined();
});
