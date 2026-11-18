import type { CandyRound } from './candy';
import type { BetsRound } from './bets';
import {npcs} from './npcs';
import { incendiary } from './fire';
import type { RechargeStation } from './station-recharge';
import { firstAidKit } from './medical';
import { money } from './politics';
import { reprography } from './room-activities';
import type { ParliamentarianDeal } from './parliamentarians';
import { officeActions, officeGoods, type OfficeDecor, type OfficeFurniture, type OfficeOption, type OfficeView } from './private-offices';
import { binoculars, concealment, equipment, megaphone, xray } from './equipment';
import { foodDefinition, foods, isDrink, isFood, pinga } from './food';
import { treasurer, type DialogueView, type NpcId } from './npcs';
import { stations } from './plenary';
import type { Office } from './elections';
import type { Motion } from './map';
import type { Decoration, Photo } from './photography';
import type { Contact } from './politics';
import { snakeDirections, type SnakeDirection, type SnakeView } from './snake';

import type { SecurityView } from "./security";
import { spyProducts, type SpyView } from "./surveillance";

export const decorationPopularity = {portrait:4,vip:2} as const;

export const objects = {
  firstAidKit,
  incendiary,
  extinguisher:{name:'Extintor',portrait:'extintor.webp',description:'Leve até as chamas e interaja com o incêndio para apagá-lo.'},
  forensicKit:{name:'Kit de Perícia',portrait:'retrato-kit-pericia.webp',description:'Analisa um documento publicado no Correio Interno.'},
  ...foods,
  pinga,
  ...spyProducts,
  ...officeGoods,
  briefcase:{exposable:true,name:'Maleta de dinheiro',portrait:'retrato-maleta.webp',description:'Uma contribuição espontânea com alça.',amount:3},
  mensalUnderwear:{name:'Cueca do Mensalão',portrait:'retrato-cueca-mensalao.webp',description:`Esconde por ${concealment.duration/1000} s o dinheiro que você está carregando.`,use:'consume'},
  xray:{name:'Raio X',portrait:'retrato-raio-x.webp',description:`Cada carga revela por ${xray.duration/1000} s o saldo de NPCs e cofres dentro da sua visão.`},
  bundle:{exposable:true,name:'Maço de dinheiro',portrait:'retrato-maco.webp',description:'Um maço de procedência criativamente indefinida.',amount:1},
  document:{exposable:true,name:'Lei do Elevador para o Térreo',portrait:'retrato-documento.webp',description:'Garante acesso ao térreo para quem já está no térreo.',destructible:true},
  portrait:{exposable:true,name:'Retrato oficial',portrait:'retrato-fotografia.webp',description:`Na primeira instalação, +${decorationPopularity.portrait} de popularidade. Um lugar na parede para a sua própria cara.`},
  vip:{exposable:true,name:'Placa VIP',portrait:'retrato-placa-vip.webp',description:`Na primeira instalação, +${decorationPopularity.vip} de popularidade. Uma reserva que os outros podem ignorar.`},
  binoculars:{name:'Binóculo',portrait:'retrato-binoculo.webp',description:`Amplia a visão por ${binoculars.duration/1000} s. Recarga automática de ${binoculars.cooldown/1000} s.`},
  megaphone:{name:'Megafone',portrait:'retrato-megafone.webp',description:`Transmite sua voz para todo o Congresso por até ${megaphone.duration/1000} s. Recarga de ${megaphone.cooldown/1000} s após encerrar.`},
  voiceModulator:{name:'Modulador de voz',portrait:'retrato-modulador.webp',description:'Disfarça sua voz enquanto estiver ligado.'},
  vest:{name:'Colete',portrait:'retrato-colete.webp',description:`Reduz em ${Math.round(equipment.vest.damageReduction*100)}% o dano físico recebido.`},
  runningShoes:{name:'Tênis de Corrida da Senhora',portrait:'retrato-tenis.webp',description:`Aumenta em ${equipment.runningShoes.speedBonus}% a velocidade ao andar e correr.`},
  baton:{name:'Porrete',portrait:'retrato-porrete.webp',description:'Golpeia um jogador próximo.'},
} as const satisfies Record<string,{name:string; portrait:string; description:string; exposable?:boolean; use?:'consume'; amount?:number; destructible?:boolean; price?:number; attack?:number}>;

export const documentTemplates = {
  elevator:{title:'Lei do Elevador para o Térreo',stamps:['Secretaria','Gabinete'],signatures:1,office:'senator'},
  queue:{title:'Estatuto da Fila Preferencial para Quem Já Chegou',stamps:['Secretaria'],signatures:2},
} as const;

export type ObjectKind = keyof typeof objects;

export function consumableAction(item:Pick<WorldItem,'id'|'kind'>) {
  const {kind} = item;
  if (!('use' in objects[kind])) return;
  const label = kind==='firstAidKit' ? 'Curar' : kind==='mensalUnderwear' ? 'Usar' :
    isDrink(kind) ? 'Beber' : 'Comer';
  return {label,action:{kind:'use',item:item.id}} as const;
}

export function cashAmount(itemOrKind:ObjectKind | Pick<WorldItem,'kind'|'cash'>) {
  if (typeof itemOrKind!=='string' && itemOrKind.cash!==undefined) return itemOrKind.cash;
  const item = objects[typeof itemOrKind==='string' ? itemOrKind : itemOrKind.kind];
  return 'amount' in item ? item.amount : undefined;
}
const treasuryPartialDivisor = 2;
export const minimumPartialDepositLot = treasuryPartialDivisor/10;
export const treasuryPartialAmount = (amount:number) => Math.floor(Math.round(amount*10)/treasuryPartialDivisor)/10;

export function treasuryDeliveries(inventory:readonly WorldItem[]) {
  return inventory.flatMap(item=>{
    const amount = cashAmount(item);
    if (!amount) return [];
    const action = {kind:'deliver',place:'treasury',item:item.id,expectedCash:amount} as const;
    const deliveries:{label:string;action:GameplayAction}[] = [{label:`Entregar ${money(amount)} ao tesoureiro`,action}];
    const portion = treasuryPartialAmount(amount);
    if (portion>0) deliveries.push({label:`Entregar só ${money(portion)}`,action:{...action,target:'partial'}});
    return deliveries;
  });
}

export type DocumentData = {
  author:string; title:string; edited:boolean; project?:number; description?:string; signatures:Contact[]; stamps:string[];
  requiredStamps:string[]; requiredSignatures:number; requiredOffice?:Office;
};
export type WorldItem = {id:number; kind:ObjectKind; cash?:number; charges?:number; quantity?:number; document?:DocumentData};
export type GroundItem = Pick<WorldItem,'id'|'kind'> & Motion & {title?:string};
export const canStackItem = (kind:ObjectKind) => isFood(kind) && !('exposable' in foodDefinition(kind));
export const itemQuantity = (item:Pick<WorldItem,'quantity'>) => item.quantity ?? 1;
export function selectedItemQuantity(item:WorldItem, quantity:number) {
  return Math.min(itemQuantity(item),Math.max(1,quantity));
}

export type ItemRequest = {id:number; kind:'offer'|'signature'; from:Contact; item:WorldItem};
export type PhoneCall = {peer:Contact; state:'incoming'|'outgoing'|'connected'};
export { canInteract as canReachObject } from './interactions';

export const occupiesInventorySlot = (item:Pick<WorldItem,'kind'>) => item.kind!=='briefcase';
export const INVENTORY_SLOTS = 6;
export const hasInventorySpace = (slotsUsed:number) => slotsUsed<INVENTORY_SLOTS;
export type PhoneActivity = 'open'|'call'|'game';
const phoneActions = ['phone-open','phone-close','call','answer','hangup','game-start','game-stop','game-turn','bets-spin','candy-start','candy-swap'] as const;
type PhoneActionKind = typeof phoneActions[number];

const gameplayActions = ['supply','collect','offer','sign-request','accept','decline','drop','use','destroy','stamp','edit','verify-document','store','recover','deliver',
  ...phoneActions,'photo','selfie','expose','conceal',
  'info-show','info-copy','info-accept','info-decline','info-close','photo-delete','photo-publish',
  'install','uninstall','mark','slice','talk','open-shop','replace-gear','dialogue-choice','dialogue-close',...officeActions,'shop-buy','scan-xray','recharge-xray','use-binoculars','equip','unequip','toggle-megaphone','toggle-modulator','attack','aid','carry','release','inspect-down','treat'] as const;
type GameplayActionKind = typeof gameplayActions[number];
export type GameplayAction = {kind:GameplayActionKind; item?:number; target?:string; place?:string; direction?:SnakeDirection; token?:number; quantity?:number; expectedCash?:number; cells?:[number,number]};
export type PhoneAction = GameplayAction & {kind:PhoneActionKind};

export function isPhoneAction(action:GameplayAction):action is PhoneAction {
  return phoneActions.some(kind=>kind===action.kind);
}

const articulationActions = new Set<GameplayActionKind>([
  ...officeActions,
  'edit','phone-open','call','answer','game-start','game-turn','bets-spin','candy-start','candy-swap','photo','selfie','install','uninstall','mark','slice','photo-publish','talk','open-shop','dialogue-choice','replace-gear','shop-buy','scan-xray','recharge-xray','use-binoculars','equip','unequip','toggle-megaphone','toggle-modulator','attack','aid','carry','release','inspect-down','treat',
]);

export function canUseGameplayAction(action:GameplayAction, articulating:boolean) {
  return articulating || !articulationActions.has(action.kind);
}
export type ExposedItem = {id:number; kind:ObjectKind};

export type GameplayView = {
  parliamentarians?:{id:string;name:string;down:boolean}[];
  parliamentarianDeal?:ParliamentarianDeal;
  robberyProgress?:number;
  forgeryRemaining?:number;
  surveillance?:SpyView;
  security?:SecurityView;
  contacts:(Contact & {bot?:true})[]; inventory:WorldItem[]; equipped?:WorldItem[]; nearby:(WorldItem & Motion)[]; ground:GroundItem[]; stored:WorldItem[]; filed:WorldItem[];
  npcNearby?:NpcId[]; dialogue?:DialogueView; treatment?:{target?:string};
  vitality?:{hp:number; max:number; recovery:number};
  offices?:OfficeView[]; ownOffice?:string; officeFurnishings?:OfficeFurniture[]; officeOptions?:OfficeOption[];
  officeStash?:{id:string;items:WorldItem[];level?:number}; officeDecor?:{id:string;kind:OfficeDecor}[];
  installationProgress?:{elapsed:number;duration:number};
  officeChannel?:{kind:'office-cash'|'office-breach-safe'|'office-breach-door'|'office-breach-cabinet'; officeId:string; label:string; elapsed:number; duration:number};
  concealmentSeconds?:number;
  binocularSeconds?:number;
  xrayVision?:{remaining:number;targets:{id:string;x:number;y:number;safe?:true;balance:number}[]};
  stationCooldowns?:Partial<Record<RechargeStation,number>>;
  equipmentCooldowns?:Record<number,number>;
  megaphoneSeconds?:number;
  modulator?:{active:boolean};
  exposed:number[]; decorations:Decoration[]; interactive:Decoration[]; installable:string[]; requests:ItemRequest[]; call?:PhoneCall; game?:SnakeView; bets?:BetsRound; candy?:CandyRound; locations:string[];
};
export type InteractionCue = 'cash'|'stamp'|'lock'|'pickup';

export type GameplayEvent = {
  type:'security-camera-viewed'|'item-received'|'vip-meeting-time'|'vip-meeting-interrupted'|'security-watch-time'|'security-watch-interrupted'|'cash-part-deposited'|'xray-target-revealed'|'cash-received'|'office-guest-interaction'|'concealed-cash-time'|'wiretap-time'|'room-left'|'plenary-visit-interrupted'|'office-meeting-time'|'public-meeting-time'|'spy-viewed'|'mail-published'|'call-time'|'megaphone-time'|'power-repaired'|'fire-started'|'fire-extinguished'|'character-carried-into-office'|'bill-studied'|'advertisement-aired'|'speech-given'|'audit-performed'|'megaphone-started'|'megaphone-ended'|'concealment-started'|'concealment-ended'|'xray-scanned'|'xray-recharged'|'safe-robbed'|'spy-activity'|'spy-installed'|'spy-discovered'|'spy-removed'|'spy-install-failed'|'npc-robbed'|'npc-vote-bought'|'room-entered'|'game-played'|'money-pocketed'|'door-breached'|'cabinet-breached'|'security-upgraded'|'collected'|'transferred'|'dropped'|'stored'|'recovered'|'used'|'destroyed'|'signed'|'stamped'|'filed'|'delivered'|'edited'|'called'|'hung-up'|'game-started'|'game-stopped'|'game-won'|'photo'|'photo-shown'|'photo-shared'|'photo-published'|'exposed'|'installed'|'uninstalled'|'marked'|'slice'|'purchased'|'equipped'|'unequipped'|'hit'|'aided'|'npc-interacted'|'character-knocked-out'|'character-recovered'|'character-carried'|'character-dropped'|'treated';
  ownOffice?:boolean; targetInOwnOffice?:boolean; targetInPlenary?:boolean; knockedOutByActor?:boolean;
  breachedByActor?:boolean; cashFromOwnBreach?:boolean;
  eventId?:number; actor:string; target?:string; item?:number; inventoryItem?:number; kind?:ObjectKind; position:Motion; at:number; witnesses:string[]; duration?:number; amount?:number; damage?:number; project?:number; reportNotice?:number; photo?:Photo; place?:string; replaced?:boolean;
};

export function readGameplayAction(raw:unknown):GameplayAction | undefined {
  if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
  const kind = gameplayActions.find(kind=>kind===raw.kind);
  if (!kind) return;
  const quantity = 'quantity' in raw ? raw.quantity : undefined;
  if (quantity!==undefined && (typeof quantity!=='number' || !Number.isSafeInteger(quantity) || quantity<1)) return;
  const expectedCash = kind==='deliver' && 'expectedCash' in raw ? raw.expectedCash : undefined;
  if (expectedCash!==undefined && (typeof expectedCash!=='number' || !Number.isFinite(expectedCash) || expectedCash<=0)) return;
  const cells = 'cells' in raw ? raw.cells : undefined;
  if (kind==='candy-swap' && (!Array.isArray(cells) || cells.length!==2 || !cells.every(Number.isSafeInteger))) return;
  return {
    kind,
    ...(kind==='candy-swap' ? {cells:cells as [number,number]} : {}),
    item:'item' in raw && typeof raw.item==='number' && Number.isSafeInteger(raw.item) ? raw.item : undefined,
    target:'target' in raw && typeof raw.target==='string' ? raw.target : undefined,
    place:'place' in raw && typeof raw.place==='string' ? raw.place : undefined,
    token:'token' in raw && typeof raw.token==='number' && Number.isSafeInteger(raw.token) ? raw.token : undefined,
    ...(quantity===undefined ? {} : {quantity}),
    ...(expectedCash===undefined ? {} : {expectedCash}),
    direction:'direction' in raw ? snakeDirections.find(direction=>direction===raw.direction) : undefined,
  };
}

export const terminals = {
  reprography:{point:reprography,title:reprography.title},
  press:{point:stations.press,title:'Imprensa'},
  coffee:{point:stations.coffee,title:'Cafezinho',supply:'coffee'},
  secretary:{point:stations.secretary,title:'Secretaria',supply:'document',stamp:'Secretaria'},
  cabinet:{point:stations.cabinet,title:'Mesa de Verbas',stamp:'Gabinete'},
  archive:{point:stations.archive,title:'Arquivo',storage:true},
  treasury:{point:treasurer.interaction,title:treasurer.label},
  protocol:{point:npcs.protocol.interaction,title:'Protocolo'},
} as const;
export type Terminal = keyof typeof terminals;
export const canVerifyDocumentAt = (place:string|undefined) => place==='secretary' || place==='protocol';
