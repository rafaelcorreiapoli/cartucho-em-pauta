import type { ElectionAction } from './elections';
import type { PoliticsAction } from './politics';

type PoliticalActions = {politics:PoliticsAction; election:ElectionAction};

export function createPoliticalSender(send:(channel:keyof PoliticalActions,command:PoliticalActions[keyof PoliticalActions] & {token:number})=>void) {
  let token = 0;
  return <Channel extends keyof PoliticalActions>(channel:Channel,action:PoliticalActions[Channel]) =>
    send(channel,{...action,token:++token});
}

export function readPoliticalToken(data:unknown) {
  if (!data || typeof data!=='object' || !('token' in data)) return;
  const {token} = data;
  if (typeof token==='number' && Number.isSafeInteger(token) && token>0) return token;
}
