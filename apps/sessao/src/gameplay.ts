import type { DialogueView, NpcId } from './npcs';
import { stations } from './plenary';
import type { Office } from './elections';
import { localPerception, type Motion } from './map';
import type { Decoration, Photo } from './photography';
import type { Contact } from './politics';
import { snakeDirections, type SnakeDirection, type SnakeView } from './snake';

export const objects = {
  coffee:{exposable:true,name:'Cafezinho',portrait:'retrato-cafezinho.webp',description:'Café da firma, forte o bastante para encerrar uma CPI.',use:'consume'},
  briefcase:{exposable:true,name:'Maleta de dinheiro',portrait:'retrato-maleta.webp',description:'Uma contribuição espontânea com alça.',use:'cash',amount:3},
  underwear:{exposable:true,name:'Cueca com dólares',portrait:'retrato-cueca.webp',description:'Reserva cambial de uso pessoal.',use:'cash',amount:2},
  bundle:{name:'Maço de dinheiro',portrait:'retrato-maco.webp',description:'Um maço de procedência criativamente indefinida.',use:'cash',amount:1},
  document:{exposable:true,name:'Lei do Elevador para o Térreo',portrait:'retrato-documento.webp',description:'Garante acesso ao térreo para quem já está no térreo.',destructible:true},
  gift:{exposable:true,name:'Presente institucional',portrait:'retrato-presente.webp',description:'Uma lembrancinha. A etiqueta diz “sem contrapartida”.'},
  portrait:{exposable:true,name:'Retrato oficial',portrait:'retrato-fotografia.webp',description:'Um lugar na parede para a sua própria cara.'},
  vip:{exposable:true,name:'Placa VIP',portrait:'retrato-documento.webp',description:'Uma reserva que os outros podem ignorar.'},
  binoculars:{name:'Binóculo',portrait:'retrato-presente.webp',description:'Amplia a visão em duas unidades enquanto equipado.'},
  voiceModulator:{name:'Modulador de voz',portrait:'retrato-presente.webp',description:'Distorce sua voz até a bateria acabar.'},
  vest:{name:'Colete',portrait:'retrato-presente.webp',description:'Reduz em 35% o dano físico recebido.'},
  baton:{name:'Porrete',portrait:'retrato-presente.webp',description:'Golpeia um jogador próximo.'},
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
export const canReachObject = (player:Motion,point:Motion) =>
  Math.hypot(player.x-point.x,player.y-point.y)<=24 && localPerception(player,point).visible;

export const INVENTORY_SLOTS = 6;
const phoneActions = ['call','answer','hangup','game-start','game-stop','game-turn'] as const;
type PhoneActionKind = typeof phoneActions[number];

const gameplayActions = ['supply','collect','offer','sign-request','accept','decline','drop','use','destroy','stamp','edit','file','store','recover','deliver',
  ...phoneActions,'photo','selfie','expose','conceal',
  'info-show','info-copy','info-accept','info-decline','info-close','photo-delete','photo-publish',
  'install','uninstall','mark','slice','buy','talk','dialogue-choice','dialogue-close','shop-buy','equip','unequip','toggle-modulator','attack','aid','carry','release','inspect-down','treat'] as const;
type GameplayActionKind = typeof gameplayActions[number];
export type GameplayAction = {kind:GameplayActionKind; item?:number; target?:string; place?:string; direction?:SnakeDirection; token?:number};
export type PhoneAction = GameplayAction & {kind:PhoneActionKind};

export function isPhoneAction(action:GameplayAction):action is PhoneAction {
  return phoneActions.some(kind=>kind===action.kind);
}

const articulationActions = new Set<GameplayActionKind>([
  'call','answer','game-start','game-turn','photo','selfie','buy','install','uninstall','mark','slice','photo-publish','talk','dialogue-choice','shop-buy','equip','unequip','toggle-modulator','attack','aid','carry','release','inspect-down','treat',
]);

export function canUseGameplayAction(action:GameplayAction, articulating:boolean) {
  return articulating || !articulationActions.has(action.kind);
}
const replaySensitiveActions = new Set<GameplayActionKind>(['attack','aid','carry','release','treat']);
export const needsFieldToken = (kind:GameplayActionKind) => replaySensitiveActions.has(kind);

export type GameplayView = {
  contacts:Contact[]; inventory:WorldItem[]; equipped?:WorldItem[]; nearby:(WorldItem & Motion)[]; ground:GroundItem[]; stored:WorldItem[]; filed:WorldItem[];
  npcNearby?:NpcId[]; dialogue?:DialogueView; treatment?:{target?:string};
  vitality?:{hp:number; max:number; recovery:number};
  modulator?:{active:boolean; battery:number; recharge:number};
  exposed?:number; decorations:Decoration[]; interactive:Decoration[]; installable:string[]; requests:ItemRequest[]; call?:PhoneCall; game?:SnakeView; locations:string[];
};
export type GameplayEvent = {
  type:'collected'|'transferred'|'dropped'|'stored'|'recovered'|'used'|'destroyed'|'signed'|'stamped'|'filed'|'delivered'|'edited'|'called'|'hung-up'|'game-started'|'game-stopped'|'game-won'|'photo'|'photo-shown'|'photo-shared'|'photo-published'|'exposed'|'installed'|'uninstalled'|'marked'|'slice'|'purchased'|'equipped'|'unequipped'|'hit'|'aided'|'npc-interacted'|'character-knocked-out'|'character-recovered'|'character-carried'|'character-dropped'|'treated';
  actor:string; target?:string; item?:number; kind?:ObjectKind; position:Motion; at:number; witnesses:string[]; duration?:number; damage?:number; photo?:Photo; place?:string; replaced?:boolean;
};

export function readGameplayAction(raw:unknown):GameplayAction | undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
  const kind = gameplayActions.find(kind=>kind===raw.kind);
  if (!kind) return;
  return {
    kind,
    item:'item' in raw && typeof raw.item==='number' && Number.isSafeInteger(raw.item) ? raw.item : undefined,
    target:'target' in raw && typeof raw.target==='string' ? raw.target : undefined,
    place:'place' in raw && typeof raw.place==='string' ? raw.place : undefined,
    token:'token' in raw && typeof raw.token==='number' && Number.isSafeInteger(raw.token) ? raw.token : undefined,
    direction:'direction' in raw ? snakeDirections.find(direction=>direction===raw.direction) : undefined,
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
