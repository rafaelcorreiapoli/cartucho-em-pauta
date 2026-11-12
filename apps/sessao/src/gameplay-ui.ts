import { setCharacterPortrait } from './character-art';
import type { DirectoryContact } from './politics';

export function node<K extends keyof HTMLElementTagNameMap>(tag:K,text = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

export function button(label:string, action:()=>void) {
  const result = node('button',label);
  result.type = 'button';
  result.className = 'hud-button hud-button--secondary';
  result.onclick = action;
  return result;
}

export function glyph(name:string) {
  const icon = document.createElementNS('http://www.w3.org/2000/svg','svg');
  icon.classList.add('hud-glyph');
  icon.setAttribute('aria-hidden','true');
  const use = document.createElementNS(icon.namespaceURI,'use');
  use.setAttribute('href','#icon-'+name);
  icon.append(use);
  return icon;
}

export function contactFace(person:DirectoryContact) {
  const face = node('span');
  face.className = 'portrait phone-contact-face';
  face.setAttribute('aria-hidden','true');
  if (person.character!==undefined) setCharacterPortrait(face,person.character);
  else {
    face.classList.remove('portrait');
    face.textContent = person.name.slice(0,1).toUpperCase();
  }
  return face;
}
