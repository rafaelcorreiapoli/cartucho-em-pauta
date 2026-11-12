import { stations } from './plenary';
import type { Office } from './elections';
import { localPerception, type Motion } from './map';
import type { Decoration, Photo } from './photography';
import type { Contact } from './politics';

export const objects = {
  coffee:{exposable:true,name:'Cafezinho',portrait:'retrato-cafezinho.webp',description:'Café da firma, forte o bastante para encerrar uma CPI.',use:'consume'},
  briefcase:{exposable:true,name:'Maleta de dinheiro',portrait:'retrato-maleta.webp',description:'Uma contribuição espontânea com alça.',use:'cash',amount:3},
  underwear:{exposable:true,name:'Cueca com dólares',portrait:'retrato-cueca.webp',description:'Reserva cambial de uso pessoal.',use:'cash',amount:2},
  bundle:{name:'Maço de dinheiro',portrait:'retrato-maco.webp',description:'Um maço de procedência criativamente indefinida.',use:'cash',amount:1},
  document:{exposable:true,name:'Lei do Elevador para o Térreo',portrait:'retrato-documento.webp',description:'Garante acesso ao térreo para quem já está no térreo.',destructible:true},
  gift:{exposable:true,name:'Presente institucional',portrait:'retrato-presente.webp',description:'Uma lembrancinha. A etiqueta diz “sem contrapartida”.'},
  portrait:{exposable:true,name:'Retrato oficial',portrait:'retrato-fotografia.webp',description:'Um lugar na parede para a sua própria cara.'},
  vip:{exposable:true,name:'Placa VIP',portrait:'retrato-documento.webp',description:'Uma reserva que os outros podem ignorar.'},
  pizza:{exposable:true,name:'Pizza parlamentar',portrait:'retrato-presente.webp',description:'Seis fatias para dividir no Cafezinho.',use:'consume'},
} as const satisfies Record<string,{name:string; portrait:string; description:string; exposable?:boolean; use?:'consume'|'cash'; amount?:number; destructible?:boolean}>;

export const documentTemplates = {
  elevator:{title:'Lei do Elevador para o Térreo',stamps:['Secretaria','Gabinete'],signatures:1,office:'senator'},
  queue:{title:'Estatuto da Fila Preferencial para Quem Já Chegou',stamps:['Secretaria'],signatures:2},
} as const;

export type ObjectKind = keyof typeof objects;

export function cashAmount(kind:ObjectKind) {
  const item = objects[kind];
  return 'amount' in item ? item.amount : undefined;
}
export type DocumentData = {
  author:string; title:string; edited:boolean; signatures:Contact[]; stamps:string[];
  requiredStamps:string[]; requiredSignatures:number; requiredOffice?:Office;
};
export type WorldItem = {id:number; kind:ObjectKind; document?:DocumentData};
export type GroundItem = Pick<WorldItem,'id'|'kind'> & Motion & {title?:string};
export type ItemRequest = {id:number; kind:'offer'|'signature'; from:Contact; item:WorldItem};
export type PhoneCall = {peer:Contact; state:'incoming'|'outgoing'|'connected'};
export type PhoneGame = {tiles?:number[]; total:number; progress:number; elapsed:number};
export const canReachObject = (player:Motion,point:Motion) =>
  Math.hypot(player.x-point.x,player.y-point.y)<=24 && localPerception(player,point).visible;

export const INVENTORY_SLOTS = 6;
export const PHONE_PREVIEW_MS = 3000;
export const gameplayActions = ['supply','collect','offer','sign-request','accept','decline','drop','use','destroy','stamp','edit','file','store','recover','deliver',
  'call','answer','hangup','game-start','game-stop','game-tile','photo','selfie','expose','conceal',
  'info-show','info-copy','info-accept','info-decline','info-close','photo-delete','photo-publish',
  'install','uninstall','mark','slice','buy'] as const;
export type GameplayAction = {kind:typeof gameplayActions[number]; item?:number; target?:string; place?:string; tile?:number};
export type GameplayView = {
  contacts:Contact[]; inventory:WorldItem[]; nearby:(WorldItem & Motion)[]; ground:GroundItem[]; stored:WorldItem[]; filed:WorldItem[];
  exposed?:number; decorations:Decoration[]; interactive:Decoration[]; installable:string[]; requests:ItemRequest[]; call?:PhoneCall; game?:PhoneGame; locations:string[];
};
export type GameplayEvent = {
  type:'collected'|'transferred'|'dropped'|'stored'|'recovered'|'used'|'destroyed'|'signed'|'stamped'|'filed'|'delivered'|'edited'|'called'|'hung-up'|'game-started'|'game-stopped'|'game-won'|'photo'|'photo-shown'|'photo-shared'|'photo-published'|'exposed'|'installed'|'uninstalled'|'marked'|'slice';
  actor:string; target?:string; item?:number; kind?:ObjectKind; position:Motion; at:number; witnesses:string[]; duration?:number; photo?:Photo; place?:string; replaced?:boolean;
};

export function readGameplayAction(raw:unknown):GameplayAction | undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw) || !gameplayActions.some(kind => kind===raw.kind)) return;
  return {
    kind:raw.kind as GameplayAction['kind'],
    item:'item' in raw && typeof raw.item==='number' && Number.isSafeInteger(raw.item) ? raw.item : undefined,
    target:'target' in raw && typeof raw.target==='string' ? raw.target : undefined,
    place:'place' in raw && typeof raw.place==='string' ? raw.place : undefined,
    tile:'tile' in raw && typeof raw.tile==='number' && Number.isInteger(raw.tile) ? raw.tile : undefined,
  };
}

export const terminals = {
  press:{point:stations.press,title:'Imprensa'},
  coffee:{point:stations.coffee,title:'Cafezinho',supply:'coffee'},
  secretary:{point:stations.secretary,title:'Secretaria',supply:'document',stamp:'Secretaria'},
  cabinet:{point:stations.cabinet,title:'Gabinete B',stamp:'Gabinete',storage:true},
  archive:{point:stations.archive,title:'Arquivo',storage:true},
  credentials:{point:stations.credentials,title:'Credenciamento',supply:'gift'},
  treasury:{point:{x:500,y:494},title:'Tesouraria',delivery:['briefcase','underwear','bundle'] as const},
  protocol:{point:stations.amendment,title:'Protocolo',file:true},
} as const;
export type Terminal = keyof typeof terminals;
