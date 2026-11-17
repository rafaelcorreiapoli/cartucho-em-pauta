import { hasInventorySpace, type GameplayAction, type GameplayView } from './gameplay';
import { roomActivities } from './room-activities';

export const vipAreaRadius = 12;

export const installationSites = {
  hall:{kind:'portrait',point:{x:210,y:96},label:'Antecâmara'},
  archivePortrait:{kind:'portrait',point:{x:540,y:27},label:'Arquivo'},
  protocolPortrait:{kind:'portrait',point:{x:280,y:291},label:'Protocolo'},
  libraryPortrait:{kind:'portrait',point:{x:380,y:293},label:'Biblioteca'},
  technicalVip:{kind:'vip',point:{x:600,y:232},label:'Apoio Técnico'},
  lobbyVip:{kind:'vip',point:{x:240,y:79},label:'Antecâmara'},
  libraryVip:{kind:'vip',point:{x:455,y:373},label:'Biblioteca'},
  pressVip:{kind:'vip',point:{x:898,y:240},label:'Sala de Imprensa'},
  pizza:{kind:'pizza',point:roomActivities.coffee,label:'Mesa do Cafezinho'},
} as const;
export type Installable = typeof installationSites[keyof typeof installationSites]['kind'];
export const credentialGoods = {portrait:{price:2},vip:{price:1}} as const;
export const installationArt = {
  portrait:{texture:'portrait-mount',sprite:'moldura-congresso.webp',width:26,height:31,centerY:0},
  vip:{texture:'reservation-chair',sprite:'cadeira-reserva.webp',width:27,height:31,centerY:-9},
} as const;

export function decorationActions(playerId:string, state:Pick<GameplayView,'interactive'|'installable'|'inventory'>) {
  const actions:{label:string; action:GameplayAction}[] = [];
  for (const place of state.installable) {
    if (!Object.hasOwn(installationSites,place)) continue;
    const {kind,point} = installationSites[place as keyof typeof installationSites];
    if (kind==='pizza') continue;
    const placed = state.interactive.find(item=>item.kind===kind && !item.privateOffice && item.x===point.x && item.y===point.y);
    const item = state.inventory.find(item=>item.kind===kind);
    const portrait = kind==='portrait';
    if (item && placed?.owner.id!==playerId) {
      const label = placed ? (portrait ? 'Substituir retrato' : 'Substituir placa VIP') :
        (portrait ? 'Pendurar retrato' : 'Reservar cadeira');
      actions.push({label,action:{kind:'install',item:item.id,place}});
    }
    if (placed && hasInventorySpace(state.inventory.length)) actions.push({
      label:portrait ? 'Retirar retrato' : 'Retirar placa VIP',
      action:{kind:'uninstall',item:placed.id},
    });
  }
  return actions;
}
