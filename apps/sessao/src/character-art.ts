const originalCount = 3;

export const characterSheets = [
  {key:'players',path:'assets/sprites-hd.png'},
  {key:'players-expansion',path:'assets/sprites-expansao.png'},
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
  element.style.setProperty('--portrait-column',String(character%2));
  element.style.setProperty('--portrait-row',String(Math.floor(character/2)));
}
