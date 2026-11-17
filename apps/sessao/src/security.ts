import { roomBounds } from './congress-layout';
import { canInteract } from './interactions';
import { securityRoom, type Motion, type Player, type Rect } from './map';
import { snackBar } from './npcs';
import { cameraSees } from './surveillance';

export const securityCameras = [
  {id:'corridor',label:'Corredor central',x:650,y:144,area:[480,125,223,36]},
  {id:'coffee',label:'Cafezinho',x:265,y:204,area:roomBounds('Cafezinho')},
  {id:'press',label:'Sala de Imprensa',x:870,y:193,area:[713,172,237,87]},
  {id:'library',label:'Biblioteca',x:461,y:351,area:[326,270,266,122]},
  {id:'protocol',label:'Protocolo',x:174,y:345,area:[10,270,306,122]},
  {id:'snacks',label:snackBar.name,x:922,y:304,area:snackBar.bounds},
] as const satisfies readonly (Motion & {id:string;label:string;area:Rect})[];

export type SecurityCamera = typeof securityCameras[number];
export type SecurityCameraId = SecurityCamera['id'];
export type SecurityAction = {kind:'open'|'close'} | {kind:'select'; camera:SecurityCameraId};
export type SecurityView = {camera?:SecurityCameraId};

function inside({x,y}:Motion,[left,top,width,height]:Rect) {
  return x>=left && x<left+width && y>=top && y<top+height;
}

export function canUseSecurityTerminal(player:Player) {
  return !player.carried && inside(player,securityRoom.bounds) &&
    canInteract(player,securityRoom.terminal,{handsFree:true});
}

export function securityCameraSees(camera:SecurityCamera, origin:Motion, point:Motion) {
  return inside(point,camera.area) && cameraSees(origin,point);
}
