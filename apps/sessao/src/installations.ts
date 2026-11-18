import { hasInventorySpace, occupiesInventorySlot, type GameplayAction, type GameplayView } from './gameplay';
import { canInteract, type InteractionActor } from './interactions';
import type { Motion } from './map';
import { roomActivities } from './room-activities';

export const vipAreaRadius = 12;
export const portraitInteractionRadius = 38;

export const decorationInstallMs = 2000;

export const installationSites = {
  hall:{kind:'portrait',point:{x:210,y:96},label:'Antecâmara'},
  archivePortrait:{kind:'portrait',point:{x:280,y:291},label:'Arquivo'},
  protocolPortrait:{kind:'portrait',point:{x:530,y:27},label:'Protocolo'},
  libraryPortrait:{kind:'portrait',point:{x:406,y:438},label:'Biblioteca'},
  technicalVip:{kind:'vip',point:{x:600,y:232},label:'Apoio Técnico'},
  lobbyVip:{kind:'vip',point:{x:240,y:79},label:'Antecâmara'},
  libraryVip:{kind:'vip',point:{x:433,y:511},label:'Biblioteca'},
  pressVip:{kind:'vip',point:{x:898,y:240},label:'Sala de Imprensa'},
  pizza:{kind:'pizza',point:roomActivities.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export type AgendaDecoration = 'portrait'|'vip'|'anyPortrait'|'anyVip'|'vipSpace'|'freshForeignPortrait'|'markableForeignPortrait';
export const credentialGoods = {portrait:{price:2},vip:{price:1}} as const;
export const installationArt = {
  portrait:{texture:'portrait-mount',sprite:'moldura-congresso.webp',width:26,height:31,centerY:0},
  vip:{texture:'reservation-chair',sprite:'cadeira-reserva.webp',width:27,height:31,centerY:-9},
} as const;

export function canReachInstallation(actor:InteractionActor,point:Motion,kind:Installable) {
  return canInteract(actor,point,kind==='portrait' ? {radius:portraitInteractionRadius} : undefined);
}

export function decorationActions(playerId:string, state:Pick<GameplayView,'interactive'|'installable'|'inventory'>) {
  const actions:{label:string; action:GameplayAction}[] = [];
  for (const [place,{kind,point}] of Object.entries(installationSites)) {
    if (kind==='pizza') continue;
    const placed = state.interactive.find(item=>item.kind===kind && !item.privateOffice && item.x===point.x && item.y===point.y);
    const item = state.inventory.find(item=>item.kind===kind);
    const portrait = kind==='portrait';
    if (item && state.installable.includes(place) && placed?.owner.id!==playerId) {
      const label = placed ? (portrait ? 'Substituir retrato' : 'Substituir placa VIP') :
        (portrait ? 'Pendurar retrato' : 'Reservar cadeira');
      actions.push({label,action:{kind:'install',item:item.id,place}});
    }
    if (placed && (portrait && placed.owner.id!==playerId || hasInventorySpace(state.inventory.filter(occupiesInventorySlot).length))) actions.push({
      label:portrait ? (placed.owner.id===playerId ? 'Retirar retrato' : 'Arrancar retrato') : 'Retirar placa VIP',
      action:{kind:'uninstall',item:placed.id},
    });
  }
  return actions;
}
