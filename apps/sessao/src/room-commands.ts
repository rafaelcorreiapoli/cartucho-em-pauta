import type { GameplayAction } from './gameplay';
import type { FireCommand } from './fire';
import type { PowerAction } from './power';
import type { RoomActivity } from './room-activities';
import type { ElectionAction } from './elections';
import type { PoliticsAction } from './politics';
import type { Action, BillVote, Vote } from './plenary';
import type { AttachmentRef } from './internal-mail';

import type { ParliamentarianAction } from './parliamentarians';
import type { SpyCommand } from './surveillance';
import type { SecurityAction } from './security';

type RoomActions = {
  character:{character:number};
  'lobby-npc-count':{count:number};
  'lobby-phone-games':{enabled:boolean};
  'start-match':{infiltrators?:number;npcs?:number;asInfiltrator?:boolean};
  gameplay:{action:GameplayAction};
  spy:SpyCommand;
  'security-camera':SecurityAction;
  'npc-deal':ParliamentarianAction;
  'fire-action':FireCommand;
  'power-action':PowerAction;
  'room-activity':{activity:RoomActivity};
  politics:PoliticsAction;
  election:ElectionAction;
  'mail-publish':{subject:string;body:string;attachment?:AttachmentRef;forwardedFrom?:number};
  'mail-examine':{notice:number};
  'complaint-submit':{id:number;photo?:number} | {target:string;photo:number};
  'plenary-action':{action:Action};
  'bill-intent':{vote:Vote|'clear'};
  'bill-vote':{vote:BillVote};
  'cassation-vote':{candidate:string|null};
};

export function createRoomCommandSender(send:(channel:keyof RoomActions,command:RoomActions[keyof RoomActions] & {token:number})=>void) {
  let token = 0;
  return <Channel extends keyof RoomActions>(channel:Channel,action:RoomActions[Channel]) =>
    send(channel,{...action,token:++token});
}

export function readRoomCommandToken(data:unknown) {
  if (!data || typeof data!=='object' || !('token' in data)) return;
  const {token} = data;
  if (typeof token==='number' && Number.isSafeInteger(token) && token>0) return token;
}
