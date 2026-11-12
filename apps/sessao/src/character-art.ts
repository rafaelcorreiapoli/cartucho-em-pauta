import { NAMES } from './map';

const originalCount = 3;

export const characterSheets = [
  {key:'players',path:'assets/sprites-hd.png',rows:originalCount*3},
  {key:'players-expansion',path:'assets/sprites-expansao.png',rows:(NAMES.length-originalCount)*3},
] as const;

export function characterArt(character:number) {
  const expansion = character>=originalCount;
  const sheet = characterSheets[expansion ? 1 : 0];
  const row = (expansion ? character-originalCount : character)*3;
  return {sheet,row,frame:row*4};
}

export function setCharacterPortrait(element:HTMLElement, character:number) {
  const skin = String(character);
  if (element.dataset.skin===skin) return;
  element.dataset.skin = skin;
  const {sheet,row} = characterArt(character);
  element.style.setProperty('--portrait-sheet',`url("${import.meta.env.BASE_URL}${sheet.path}")`);
  element.style.setProperty('--portrait-rows',String(sheet.rows));
  element.style.setProperty('--portrait-row',String(row));
}
