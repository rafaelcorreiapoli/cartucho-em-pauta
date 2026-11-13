import {PLENARY_BOUNDS} from './map';

const [left,top,width,height] = PLENARY_BOUNDS;
export const plenaryCameraCenter = {x:left+width/2,y:top+height/2-30};

export function plenaryZoom(normal:number,width:number,height:number) {
  return Math.min(normal,width/580,height/340);
}
