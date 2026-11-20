import { NAMES, type Motion } from './map';
import type {VisitorId} from './visitors';

const originalCount = 3;

export const characterSheets = [
  {key:'players',path:'assets/characters-hd/players-128.webp'},
  {key:'players-expansion',path:'assets/characters-hd/players-expansion-128.webp'},
] as const;

export const characterSlugs:Record<(typeof NAMES)[number],string> = {
  Lula:'lula',
  Bolsonaro:'bolsonaro',
  Clodovil:'clodovil',
  Tiririca:'tiririca',
  'Sikêra Jr.':'sikera-jr',
  'Alexandre Frota':'alexandre-frota',
  'Sergio Moro':'sergio-moro',
  'Inês Brasil':'ines-brasil',
};
const combatActions = ['attack','hit','fall'] as const;
const hitFrameMs = 55;
const fallFrameMs = 100;

export const phoneSheets = Object.values(characterSlugs).map(character=>{
  const key = `${character}-phone`;
  return {key,path:`assets/characters-hd/${key}-128.webp`};
});

export function phoneArt(character:number,time:number,reducedMotion:boolean) {
  const skin = characterSlugs[NAMES[character]];
  if (!skin) return;
  return {key:`${skin}-phone`,frame:reducedMotion ? 0 : Math.floor(time/135)%4};
}

export const npcRobberySheets = Object.values(characterSlugs).map(skin=>{
  const key = `${skin}-npc-robbery`;
  return {key,path:`assets/characters-hd/${key}-128.webp`};
});

export function npcRobberyArt(character:number,time:number,reducedMotion:boolean,actor:Motion & {direction:number},target:Motion & {direction:number}) {
  const skin = characterSlugs[NAMES[character]];
  if (!skin) return;
  const dx = target.x-actor.x;
  // On a vertical approach, use the victim's lying orientation when there is no horizontal offset.
  const flipX = Math.abs(dx)>.5 ? dx<0 : actor.direction===3 || actor.direction!==1 && target.direction===3;
  return {key:`${skin}-npc-robbery`,frame:reducedMotion ? 0 : Math.floor(time/180)%8,flipX};
}

export const safeDepositSheets = Object.values(characterSlugs).map(skin=>{
  const key = `${skin}-safe-deposit`;
  return {key,path:`assets/characters-hd/${key}-128.webp`};
});

export function safeDepositArt(character:number,time:number,reducedMotion:boolean) {
  const skin = characterSlugs[NAMES[character]];
  if (!skin) return;
  return {key:`${skin}-safe-deposit`,frame:reducedMotion ? 3 : Math.floor(time/200)%8};
}

export const safeBreachSheets = Object.values(characterSlugs).map(character=>{
  const key = safeBreachKey(character);
  return {key,path:`assets/characters-hd/${key}-128.webp`};
});

function safeBreachKey(skin:string) {
  return `${skin}-safe-breach`;
}

export function safeBreachArt(character:number,time:number,reducedMotion:boolean) {
  const skin = characterSlugs[NAMES[character]];
  if (!skin) return;
  return {key:safeBreachKey(skin),frame:reducedMotion ? 0 : Math.floor(time/200)%4};
}

export const combatSheets = Object.values(characterSlugs).flatMap(character=>
  combatActions.map(action=>{
    const key = combatSheet(character,action);
    return {key,path:`assets/characters-hd/${key}-128.webp`};
  }),
);

function combatSheet(character:string, action:(typeof combatActions)[number]) {
  return `${character}-${action}`;
}

export function characterArt(character:number,visitor?:VisitorId) {
  if (visitor) return {sheet:{key:`${visitor}-walk`,path:visitor==='japones-federal' ? 'assets/japones-federal-walk.png' : `assets/world-hd/${visitor}-walk-128.webp`},row:0,frame:0};
  const expansion = character>=originalCount;
  const sheet = characterSheets[expansion ? 1 : 0];
  const row = (expansion ? character-originalCount : character)*3;
  return {sheet,row,frame:row*4};
}

export function attackArt(character:number, row:number, progress:number, impactProgress:number) {
  const skin = characterSlugs[NAMES[character]];
  if (!skin) return;
  // The third frame shows the arm fully extended at the moment of impact.
  const frame = progress<impactProgress*.55 ? 0 :
    progress<impactProgress ? 1 : progress<(1+impactProgress)/2 ? 2 : 3;
  return {key:combatSheet(skin,'attack'),frame:row*4+frame};
}

export function hitArt(character:number, direction:number, elapsed:number,visitor?:VisitorId) {
  const skin = visitor ?? characterSlugs[NAMES[character]];
  const frame = Math.floor(elapsed/hitFrameMs);
  if (!skin || frame>=4) return;
  const row = direction===3 ? 1 : direction;
  return {key:combatSheet(skin,'hit'),frame:row*4+frame,flipX:direction===3};
}

export function downedArt(character:number, direction:number, elapsed = Infinity,visitor?:VisitorId) {
  const row = direction===3 ? 1 : direction;
  const flipX = direction===3;
  const skin = visitor ?? characterSlugs[NAMES[character]];
  if (skin) {
    const frame = Math.min(3,Math.floor(elapsed/fallFrameMs));
    return {key:combatSheet(skin,'fall'),frame:row*4+frame,flipX,rotation:0,originY:frame===3 ? .85 : 1};
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
