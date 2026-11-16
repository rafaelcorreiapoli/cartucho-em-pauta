import { installationArt, installationSites } from './installations';
import { desks, furnishings, securityRoom, walls, type Motion, type Rect } from './map';
import { mapNpcs, treasurer } from './npcs';
import type { Decoration } from './photography';
import { powerPanels } from './power';
import { isOfficeFurniture, officeFixtures, officeFurniture, privateOffices } from './private-offices';

export const groundItemArt = {size:20, anchor:.8} as const;

function spriteBounds({x,y}:Motion, width:number, height:number, anchor=.5):Rect {
  return [x-width/2,y-height*anchor,width,height];
}

export function overlaps([ax,ay,aw,ah]:Rect,[bx,by,bw,bh]:Rect) {
  return ax<bx+bw && ax+aw>bx && ay<by+bh && ay+ah>by;
}

export function installationBounds(point:Motion, kind:'portrait'|'vip') {
  const {width,height,centerY} = installationArt[kind];
  return spriteBounds({x:point.x,y:point.y+centerY},width,height);
}

const fixtureBounds:Rect[] = [
  ...walls,
  ...furnishings.map(({area})=>area),
  ...desks.map(([x,y]):Rect => {
    if (x===securityRoom.terminal.x-22 && y===securityRoom.terminal.y-20) return [x,y-14,45,34];
    if (x===treasurer.counter.x && y===treasurer.counter.y) return [x,y-3,45,23];
    return [x,y-17,45,37];
  }),
  ...Object.values(mapNpcs).map(npc=>spriteBounds(npc,38,38,1)),
  ...powerPanels.map(point=>spriteBounds(point,24,17.5,.85)),
  ...privateOffices.flatMap(office=>(['safe','cabinet'] as const).map(kind=>{
    const {x,y} = office[kind];
    const {width,height,footOffset} = officeFixtures[kind];
    return spriteBounds({x,y:y-footOffset},width,height,1);
  })),
  ...Object.values(installationSites).flatMap(({point,kind})=>
    kind==='pizza' ? [] : [installationBounds(point,kind)]),
];

function placedBounds(item:Decoration):Rect {
  if (isOfficeFurniture(item.kind)) {
    const {width,height,anchor} = officeFurniture[item.kind];
    return spriteBounds(item,width,height,anchor);
  }
  return item.kind==='pizza' ? spriteBounds(item,26,26) : installationBounds(item,item.kind);
}

export function cashSpriteFits(point:Motion, placements:Iterable<Decoration>) {
  const {size,anchor} = groundItemArt;
  const bounds = spriteBounds(point,size,size,anchor);
  if (fixtureBounds.some(fixture=>overlaps(bounds,fixture))) return false;
  for (const item of placements) {
    if (overlaps(bounds,placedBounds(item))) return false;
  }
  return true;
}
