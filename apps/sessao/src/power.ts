import {canInteract,type InteractionActor} from './interactions';

export const powerPanels = [
  {name:'Apoio Técnico',x:510,y:183},
  {name:'Credenciamento',x:260,y:418},
] as const;

export const powerRules = {radius:22,visionFactor:.45,repairMs:2000,cooldownMs:45_000,popularityReward:3} as const;

export type PowerPanel = 0|1;
export type PowerAction = {kind:'sabotage'|'repair'|'cancel';panel:PowerPanel};
export type PowerView = {occupied:[boolean,boolean]; operating?:PowerPanel; seconds?:number; paused:boolean};

export function canOperatePanel(player:InteractionActor,panel:PowerPanel) {
  return canInteract(player,powerPanels[panel],{radius:powerRules.radius,handsFree:true,clearFloor:true});
}

export function powerOption(player:InteractionActor,panel:PowerPanel,outage:PowerView|undefined,canSabotage:boolean|undefined) {
  if (!canOperatePanel(player,panel) || outage?.paused) return;
  if (outage?.operating===panel) return {kind:'cancel',panel,label:'Soltar painel elétrico'} as const;
  if (outage && !outage.occupied[panel]) return {kind:'repair',panel,label:'Operar painel elétrico'} as const;
  if (!outage && canSabotage && panel===0) return {kind:'sabotage',panel,label:'Cortar energia'} as const;
}
