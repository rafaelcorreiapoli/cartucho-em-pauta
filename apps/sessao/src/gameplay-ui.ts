import { objects, type ObjectKind } from './gameplay';

export function node<K extends keyof HTMLElementTagNameMap>(tag:K,text = '') {
  const result = document.createElement(tag);
  result.textContent = text;
  return result;
}

export function itemPortrait(kind:ObjectKind) {
  const portrait = node('img');
  portrait.className = 'item-portrait';
  portrait.src = import.meta.env.BASE_URL+'assets/'+objects[kind].portrait;
  portrait.alt = '';
  portrait.draggable = false;
  return portrait;
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
