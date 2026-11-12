import { NAMES } from './map';

const originalCount = 3;

export const characterSheets = [
  {key:'players',path:'assets/sprites-hd.png'},
  {key:'players-expansion',path:'assets/sprites-expansao.png'},
] as const;

export const bolsonaroFall = {key:'bolsonaro-fall',path:'assets/bolsonaro-fall.webp'};

export function characterArt(character:number) {
  const expansion = character>=originalCount;
  const sheet = characterSheets[expansion ? 1 : 0];
  const row = (expansion ? character-originalCount : character)*3;
  return {sheet,row,frame:row*4};
}

export function downedArt(character:number, direction:number) {
  const row = direction===3 ? 1 : direction;
  const flipX = direction===3;
  if (NAMES[character]==='Bolsonaro') {
    return {key:bolsonaroFall.key,frame:row*4+3,flipX,rotation:0,originY:.85};
  }
  const {sheet,frame} = characterArt(character);
  return {key:sheet.key,frame:frame+row*4,flipX,rotation:flipX ? -Math.PI/2 : Math.PI/2,originY:.5};
}

export function setCharacterPortrait(element:HTMLElement, character:number) {
  const skin = String(character);
  if (element.dataset.skin===skin) return;
  element.dataset.skin = skin;
  element.style.setProperty('--portrait-column',String(character%2));
  element.style.setProperty('--portrait-row',String(Math.floor(character/2)));
}
