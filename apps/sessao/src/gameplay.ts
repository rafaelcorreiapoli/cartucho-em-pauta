import { stations } from './plenary';
import { cashItems } from './cash-drops';
import type { Office } from './elections';
import { localPerception, type Motion } from './map';
import type { Contact } from './politics';

export const objects = {
  coffee:{name:'Cafezinho',portrait:'retrato-cafezinho.webp',description:'Café da firma, forte o bastante para encerrar uma CPI.',use:'consume'},
  briefcase:{name:'Maleta de dinheiro',portrait:'retrato-maleta.webp',description:'Uma contribuição espontânea com alça.',use:'cash',amount:cashItems.briefcase.amount},
  underwear:{name:'Cueca com dólares',portrait:'retrato-cueca.webp',description:'Reserva cambial de uso pessoal.',use:'cash',amount:cashItems.underwear.amount},
  bundle:{name:'Maço de dinheiro',portrait:'retrato-maco.webp',description:'Um maço de procedência criativamente indefinida.',use:'cash',amount:cashItems.bundle.amount},
  document:{name:'Lei do Elevador para o Térreo',portrait:'retrato-documento.webp',description:'Garante acesso ao térreo para quem já está no térreo.',destructible:true},
  gift:{name:'Presente institucional',portrait:'retrato-presente.webp',description:'Uma lembrancinha. A etiqueta diz “sem contrapartida”.'},
  photo:{name:'Fotografia',portrait:'retrato-fotografia.webp',description:'Registro feito com a câmera do celular.',destructible:true},
} as const satisfies Record<string,{name:string; portrait:string; description:string; use?:'consume'|'cash'; amount?:number; destructible?:boolean}>;

export const documentTemplates = {
  elevator:{title:'Lei do Elevador para o Térreo',stamps:['Secretaria','Gabinete'],signatures:1,office:'senator'},
  queue:{title:'Estatuto da Fila Preferencial para Quem Já Chegou',stamps:['Secretaria'],signatures:2},
} as const;

export type ObjectKind = keyof typeof objects;
export type DocumentData = {
  author:string; title:string; edited:boolean; signatures:Contact[]; stamps:string[];
  requiredStamps:string[]; requiredSignatures:number; requiredOffice?:Office;
};
export type Photo = {at:number; location:string; people:(Contact & {character:number})[]; objects:string[]};
export type WorldItem = {id:number; kind:ObjectKind; document?:DocumentData; photo?:Photo};
export type ItemRequest = {id:number; kind:'offer'|'signature'; from:Contact; item:WorldItem};
export type PhoneCall = {peer:Contact; state:'incoming'|'outgoing'|'connected'};
export type PhoneGame = {tiles?:number[]; total:number; progress:number; elapsed:number};
export const canReachObject = (player:Motion,point:Motion) =>
  Math.hypot(player.x-point.x,player.y-point.y)<=24 && localPerception(player,point).visible;

export const INVENTORY_SLOTS = 6;
export const PHONE_PREVIEW_MS = 3000;
export const gameplayActions = ['supply','collect','offer','sign-request','accept','decline','drop','use','destroy','stamp','edit','file','store','recover','deliver',
  'call','answer','hangup','game-start','game-stop','game-tile','photo'] as const;
export type GameplayAction = {kind:typeof gameplayActions[number]; item?:number; target?:string; place?:string; tile?:number};
export type GameplayView = {
  contacts:Contact[]; inventory:WorldItem[]; nearby:(WorldItem & Motion)[]; ground:(WorldItem & Motion)[]; stored:WorldItem[]; filed:WorldItem[];
  requests:ItemRequest[]; call?:PhoneCall; game?:PhoneGame; locations:string[];
};
export type GameplayEvent = {
  type:'collected'|'transferred'|'dropped'|'stored'|'recovered'|'used'|'destroyed'|'signed'|'stamped'|'filed'|'delivered'|'edited'|'called'|'hung-up'|'game-started'|'game-stopped'|'game-won'|'photo';
  actor:string; target?:string; item?:number; kind?:ObjectKind; position:Motion; at:number; witnesses:string[]; duration?:number;
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
  coffee:{point:stations.coffee,title:'Cafezinho',supply:'coffee'},
  secretary:{point:stations.secretary,title:'Secretaria',supply:'document',stamp:'Secretaria'},
  cabinet:{point:stations.cabinet,title:'Gabinete B',stamp:'Gabinete',storage:true},
  archive:{point:stations.archive,title:'Arquivo',storage:true},
  credentials:{point:stations.credentials,title:'Credenciamento',supply:'gift'},
  treasury:{point:{x:500,y:494},title:'Tesouraria',delivery:['briefcase','underwear','bundle'] as const},
  protocol:{point:stations.amendment,title:'Protocolo',file:true},
} as const;
export type Terminal = keyof typeof terminals;
