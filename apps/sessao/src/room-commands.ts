import type { ElectionAction } from './elections';
import type { PoliticsAction } from './politics';

import type { AttachmentRef } from './internal-mail';

type RoomActions = {
  politics:PoliticsAction;
  election:ElectionAction;
  'mail-publish':{subject:string;body:string;attachment?:AttachmentRef;forwardedFrom?:number};
  'mail-examine':{notice:number};
  'complaint-submit':{id:number;photo?:number};
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
