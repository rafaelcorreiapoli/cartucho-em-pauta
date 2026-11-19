import type {FireOption} from '../fire';
import {powerOption,type PowerAction} from '../power';
import {canReachDownedPlayer,doorDestination} from '../interactions';
import {decorationActions} from '../installations';
import {npcs} from '../npcs';
import {cashAmount,treasuryDeliveries,type GameplayAction} from '../gameplay';
import {PLENARY_DOORS,type Player} from '../map';
import type {ParliamentarianFieldAction} from '../parliamentarians';
import type {PlenaryView} from '../plenary';
import type {SpyOption} from '../surveillance';
import {treatmentAction} from './treatment-action';
import {xrayRechargeAction} from './xray-recharge-action';

export type FieldAction = GameplayAction
  | {kind:'power';option:PowerAction}
  | {kind:'fire';option:FireOption}
  | {kind:'spy';option:SpyOption}
  | {kind:'npc-deal';request:ParliamentarianFieldAction}
  | {kind:'cross-door';door:number}
  | {kind:'inspect-stash'}
  | {kind:'edit-document';item:number;project:number}
  | {kind:'open-security'}
  | {kind:'offer-item';target:string};

export function fieldActions(view:PlenaryView|undefined, player:Player|undefined, roster:readonly Player[],signatureTarget?:string) {
  const actions:{label:string; icon:string; action:FieldAction;blocked?:string;disabled?:boolean;target?:{id:string;name:string;verb:string};documentChoice?:true}[] = [];
  const state = view?.gameplay;
  if (state && player) {
    const cash = state.nearby.find(item=>cashAmount(item));
    if (cash && !player.knockedOut && !player.carrying && !player.carried && view?.ballotCountdown===undefined) {
      actions.push({label:'Pegar maleta',icon:'wallet',action:{kind:'collect',item:cash.id}});
    }
    const extinguisher = state.nearby.find(item=>item.kind==='extinguisher');
    if (extinguisher && !player.knockedOut && !player.carrying) {
      actions.push({label:'Pegar extintor',icon:'alert',action:{kind:'collect',item:extinguisher.id}});
    }
    if (view?.ballotCountdown===undefined) {
      for (const panel of [0,1] as const) {
        const option = powerOption(player,panel,view?.outage,view?.canSabotagePower);
        if (option) actions.push({label:option.label,icon:'alert',action:{kind:'power',option}});
      }
    }
  }
  const fire = view?.fireInteraction;
  if (fire?.option) actions.push({label:fire.option.label,icon:'alert',action:{kind:'fire',option:fire.option}});
  const channel = state?.officeChannel;
  const robbery = state?.robberyProgress;
  const spy = state?.surveillance;
  for (const option of spy?.options ?? []) actions.push({
    label:option.label,blocked:option.blocked,icon:option.kind==='cancel' ? 'cross' : 'search',action:{kind:'spy',option},
  });
  if (robbery!==undefined) actions.push({label:'Cancelar roubo',icon:'cross',action:{kind:'npc-deal',request:{kind:'cancel-robbery'}}});
  for (const {label,...action} of state?.officeOptions ?? []) {
    actions.push({label,icon:action.kind==='office-cancel' ? 'cross' : 'document',action});
  }
  if (view?.surveillanceEnabled!==false && state?.security) actions.push({label:'Consultar câmeras',icon:'camera',action:{kind:'open-security'}});
  if (state?.locations.includes('reprography')) {
    for (const item of state.inventory) if (item.document?.project!==undefined && state.forgeryRemaining===undefined) {
      actions.push({label:'Adulterar · '+item.document.title,icon:'document',action:{kind:'edit-document',item:item.id,project:item.document.project}});
    }
  }
  if (state && player && channel?.kind!=='office-cash' && robbery===undefined) {
    for (const npc of state.parliamentarians ?? []) {
      actions.push({label:npc.down ? `Roubar dinheiro · ${npc.name}` : `Conversar · ${npc.name}`,icon:npc.down ? 'wallet' : 'document',
        target:{id:npc.id,name:npc.name,verb:npc.down ? 'Roubar dinheiro' : 'Conversar'},
        action:{kind:'npc-deal',request:{kind:npc.down ? 'rob' : 'talk',target:npc.id}}});
    }
    if (state.locations.includes('treasury')) {
      for (const delivery of treasuryDeliveries(state.inventory)) actions.push({...delivery,icon:'wallet'});
    }
    const recharge = xrayRechargeAction(state,view?.politics?.wallet);
    if (recharge) actions.push({...recharge,icon:'wallet',action:{kind:'recharge-xray'}});
    if (state.officeStash) actions.push({label:'Abrir armário',icon:'inventory',action:{kind:'inspect-stash'}});
    const door = PLENARY_DOORS.findIndex((_,index)=>doorDestination(player,index,false)!==undefined);
    if (door>=0) actions.push({label:'Atravessar porta',icon:'map',action:{kind:'cross-door',door}});
    const treatment = treatmentAction(state.treatment);
    if (treatment) actions.push({...treatment,icon:'shield',action:{kind:'treat'}});
    if (player.carrying) {
      actions.push({label:'Soltar jogador',icon:'cross',action:{kind:'release'}});
    } else {
      if (view?.gameplay && view.portraitsAndVipEnabled!==false && view.ballotCountdown===undefined && !player.knockedOut && !player.carried) {
        for (const option of decorationActions(player.id,state)) {
          actions.push({...option,icon:option.action.kind==='uninstall' ? 'inventory' : 'map'});
        }
      }
      if (!player.carried && state.inventory.length) {
        for (const contact of state.contacts) {
          actions.push({label:`Oferecer item · ${contact.name}`,icon:'inventory',
            target:{id:contact.id,name:contact.name,verb:'Oferecer item'},action:{kind:'offer-item',target:contact.id}});
          const documents = state.inventory.filter(item=>item.document &&
            (item.document.project===undefined || item.document.requiredSignatures>0) &&
            !item.document.signatures.some(signer=>signer.id===contact.id));
          if (documents.length===1) actions.push({label:`Pedir assinatura · ${contact.name}`,icon:'document',
            target:{id:contact.id,name:contact.name,verb:'Pedir assinatura'},action:{kind:'sign-request',target:contact.id,item:documents[0].id}});
          else if (documents.length>1) {
            actions.push({label:`Pedir assinatura · ${contact.name}`,icon:'document',
              target:{id:contact.id,name:contact.name,verb:'Pedir assinatura'},action:{kind:'sign-request',target:contact.id}});
            if (signatureTarget===contact.id) for (const item of documents) actions.push({
              label:`Assinar · ${item.document!.title} #${item.id}`,icon:'document',documentChoice:true,
              target:{id:contact.id,name:contact.name,verb:`${item.document!.title} #${item.id}`},
              action:{kind:'sign-request',target:contact.id,item:item.id},
            });
          }
        }
      }
      for (const target of state.npcNearby ?? []) {
        const npc = npcs[target];
        if (npc.catalog) actions.push({label:`Abrir loja · ${npc.name}`,icon:'inventory',action:{kind:'open-shop',target}});
        else actions.push({label:`${npc.label} · Falar com ${npc.name}`,icon:'document',action:{kind:'talk',target}});
      }
      for (const target of roster) {
        if (canReachDownedPlayer(player,target)) {
          actions.push({label:`Socorrer ${target.nick}`,icon:'shield',target:{id:target.id,name:target.nick,verb:'Socorrer'},action:{kind:'aid',target:target.id}});
          if (!target.carried) actions.push({label:`Carregar ${target.nick}`,icon:'handset',target:{id:target.id,name:target.nick,verb:'Carregar'},action:{kind:'carry',target:target.id}});
          actions.push({label:`Inspecionar ${target.nick}`,icon:'search',target:{id:target.id,name:target.nick,verb:'Inspecionar'},action:{kind:'inspect-down',target:target.id}});
        }
      }
    }
  }
  return actions;
}
