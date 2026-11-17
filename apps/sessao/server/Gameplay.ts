import { extinguisherSpawns } from '../src/fire';
import { powerRules } from '../src/power';
import { StationCooldowns } from './StationCooldowns';
import { stationRecharge } from '../src/station-recharge';
import { isCredentialGood, marketProduct } from '../src/market-catalog';
import { documentRules } from '../src/internal-mail';
import { attributeUpgrades, type Attribute } from '../src/progression';
import { PrivateOffices } from './PrivateOffices';
import { decorPoint, decorSlots, isOfficeFurniture, officeActions, officeDoorPoint, officeGoods, officeRules, privateOffices, type OfficeAction, type OfficeDecor, type OfficeLayout, type OfficeOption } from '../src/private-offices';
import { archiveDutyRoom, money } from '../src/politics';
import { foodDefinition, isFood, type FoodEffect } from '../src/food';
import { MAX_STAMINA } from '../src/movement';
import { npcs, type DialogueCondition } from '../src/npcs';
import { canStackItem, itemQuantity, canReachObject, canVerifyDocumentAt, isPhoneAction, cashAmount, treasuryPartialAmount, documentTemplates, hasInventorySpace, objects, terminals, type Terminal, type GameplayAction, type GameplayEvent, type GameplayView, type ObjectKind, type WorldItem } from '../src/gameplay';
import { blockedBy, canStand, HEIGHT, localPerception, roomAt, worldVisible, VISION_RADIUS, WIDTH, inPlenary, type Motion, type Player } from '../src/map';
import { cashSpriteFits } from '../src/map-props';
import { findRoute } from '../src/navigation';
import { PHOTO_HEIGHT, PHOTO_LOOK_UP, PHOTO_WIDTH, inPhotoFrame, type Decoration, type Photo, type PhotoPerson, type PhotoScene } from '../src/photography';
import { canReachInstallation, decorationInstallMs, installationSites, vipAreaRadius, type AgendaDecoration } from '../src/installations';
import { bills, recoveryPolicy, stations } from '../src/plenary';
import { PhotoAlbum } from './PhotoAlbum';
import { NpcDialogues } from './NpcDialogues';
import { Combat } from './Combat';
import { Transport } from './Transport';
import { canReachDownedPlayer } from '../src/interactions';
import { firstAidKit, infirmary } from '../src/medical';
import { VoiceEquipment } from './VoiceEquipment';
import { gearConflict, binoculars, equippedWeapon, equipment, megaphone, isGear, concealment, xray, type Gear } from '../src/equipment';
import { PhoneSession } from './PhoneSession';
import { publishGameplay, type GameplayWorld } from './gameplay-world';

import { Surveillance } from "./Surveillance";
import { securityCameraSees, type SecurityCamera } from "../src/security";
import { cameraSees, spyRules, type SpyDevice } from "../src/surveillance";

type GroundPlace = {ground:Motion; expires?:number};
type Place = {holder:string} | {equipped:string} | GroundPlace | {storage:string} | {filed:true};
type Item = {data:WorldItem; place:Place};
type Request = {id:number; kind:'offer'|'signature'; item:number; from:string; to:string; expires:number; quantity?:number};
type PendingInstallation = {action:GameplayAction; origin:Motion; started:number; ends:number};
const interactionDuration = (player:Player, baseMs:number) =>
  Math.ceil(baseMs/(1+(player.interactionSpeedBonus ?? 0)/100));

const mapEntrance = {x:140,y:146};
const maxGroundItems = 36;
const cashLifetime = 55_000;
const terminalKeys = Object.keys(terminals) as Terminal[];
const locations = (player:Player) => terminalKeys.filter(key => canReachObject(player,terminals[key].point));

function installationConflict(placed:Decoration|undefined,owner:string) {
  if (placed?.kind==='pizza') return 'Já tem pizza na mesa.';
  if (placed?.owner.id===owner) return 'Você já ocupou este lugar.';
}

export class Gameplay {
  constructor(private readonly stationCooldowns = new StationCooldowns(),private readonly powerOut = ()=>false) {}

  private surveillance = new Surveillance();
  private lastPolicyHeal = 0;
  private roomSamples = new Map<string,{room:string; at:number; x:number; y:number; active:boolean; archiveDuty:boolean; plenaryVisit:boolean; concealedCash:boolean; securityPeer?:string; vip?:{id:number; peer:string}}>();
  private privateOffices = new PrivateOffices();
  private items = new Map<number,Item>();
  private requests = new Map<number,Request>();
  private phone = new PhoneSession();
  private dialogues = new NpcDialogues();
  private combat = new Combat();
  private transport = new Transport();
  private modulator = new VoiceEquipment();
  private serial = 0;
  private binocularUse = new Map<string,{activeUntil:number; readyAt:number}>();
  private scanning = new Map<string,{item:number;ends:number;balances:Map<string,number>;reported:Set<string>}>();
  private concealedUntil = new Map<string,number>();
  private exposed = new Map<string,Set<number>>();
  private album = new PhotoAlbum();
  private portraitInstalledAt = new Map<string,number>();
  private pendingInstallations = new Map<string,PendingInstallation>();
  private installations = new Map<string,Decoration>();
  private servings = new Map<number,Set<string>>();
  private clearedSites = new Map<string,{by:string;owner:string}>();
  private transfers: (Photo['transfers'][number] & {at:number; point:Motion; destination:Motion})[] = [];

  private random = Math.random;
  private nextCashSpawn = Infinity;

  private readonly forgery = new Map<string,{item:number;project:number;end:number}>();
  private readonly signedProjects = new Map<number,Map<string,{project:number;at:number}>>();

  documentAttachment(owner:string,id:number) {
    const item = this.inventory(owner).find(({data})=>data.id===id)?.data;
    if (!item?.document || item.document.project===undefined) return;
    const document = item.document;
    const signatures = this.signedProjects.get(id);
    const authentic = document.signatures.every(signer=>signatures?.get(signer.id)?.project===document.project);
    const {title,description} = document;
    return {document:{id,title,description,signatures:document.signatures.map(({name})=>name)},authentic};
  }

  incendiaryItem(owner:string,serial?:number) {
    return this.inventory(owner).find(({data})=>data.kind==='incendiary' && (serial===undefined || data.id===serial))?.data.id;
  }

  consumeIncendiary(owner:string,serial:number) {
    if (this.incendiaryItem(owner,serial)===undefined) return false;
    this.remove(this.items.get(serial)!);
    return true;
  }

  consumeForensicKit(owner:string) {
    const kit = this.inventory(owner).find(({data})=>data.kind==='forensicKit');
    if (!kit) return false;
    this.remove(kit);
    return true;
  }

  private documentRequirements(item:WorldItem) {
    const document = item.document!;
    const missing = document.requiredStamps.filter(stamp=>!document.stamps.includes(stamp));
    const recorded = this.signedProjects.get(item.id);
    const valid = document.project===undefined ? document.signatures.length :
      document.signatures.filter(person=>recorded?.get(person.id)?.project===document.project).length;
    if (valid!==document.signatures.length) return 'O documento não atende aos requisitos formais.';
    const signatures = document.requiredSignatures-valid;
    if (signatures>0) missing.push(`${signatures} assinatura(s)`);
    if (missing.length) return `Falta: ${missing.join(', ')}.`;
  }

  private signProject(item:WorldItem,signer:Player,now:number) {
    if (item.document?.project===undefined) return;
    const history = this.signedProjects.get(item.id) ?? new Map();
    history.set(signer.id,{project:item.document.project,at:now});
    this.signedProjects.set(item.id,history);
  }

  private readonly originalDocuments = new Map<number,NonNullable<WorldItem['document']>>();
  private megaphoneBroadcast?: {owner:string;item:number;until:number;sampledAt:number};
  private megaphoneRecharge = new Map<number,{owner:string;until:number}>();

  megaphoneSpeaker() { return this.megaphoneBroadcast?.owner; }

  stopMegaphone(id:string,world:GameplayWorld) {
    const active = this.megaphoneBroadcast;
    if (active?.owner!==id) return;
    this.megaphoneBroadcast = undefined;
    this.megaphoneRecharge.set(active.item,{owner:id,until:world.now+megaphone.cooldown});
    const player = world.players.find(player=>player.id===id);
    if (player) publishGameplay(world,player,'megaphone-ended',{item:active.item,kind:'megaphone',witnesses:[]});
    world.feedback?.(id,'Megafone encerrado.');
  }

  private updateMegaphone(world:GameplayWorld,exploring:boolean) {
    const active = this.megaphoneBroadcast;
    if (active) {
      const player = world.players.find(player=>player.id===active.owner);
      if (!exploring || !player || player.knockedOut || player.carried || !world.voice(active.owner) ||
          this.wearing(active.owner,'megaphone')?.id!==active.item) {
        this.stopMegaphone(active.owner,world);
      } else {
        const end = Math.min(world.now,active.until);
        const duration = Math.min(100,end-active.sampledAt);
        active.sampledAt = end;
        if (duration>0 && world.hasMission?.(player.id,'discursoMegafone')) {
          publishGameplay(world,player,'megaphone-time',{duration,witnesses:[]});
        }
        if (world.now>=active.until) this.stopMegaphone(active.owner,world);
      }
    }
    for (const [item,recharge] of this.megaphoneRecharge) {
      if (world.now<recharge.until) continue;
      this.megaphoneRecharge.delete(item);
      if (this.wearing(recharge.owner,'megaphone')?.id===item) world.feedback?.(recharge.owner,'Megafone pronto.');
    }
  }

  reset(now:number,random = Math.random,players:Player[] = [], officeRandom = Math.random) {
    this.stationCooldowns.reset();
    this.items.clear();
    for (const extinguisher of extinguisherSpawns) this.create('extinguisher',this.groundPlace('extinguisher',extinguisher,now));
    this.surveillance.reset();
    this.roomSamples.clear();
    this.lastPolicyHeal = now;
    this.privateOffices.reset(players,officeRandom);
    this.syncOfficeDoors(players,now);
    this.album.reset();
    this.exposed.clear();
    this.concealedUntil.clear();
    this.scanning.clear();
    this.binocularUse.clear();
    this.pendingInstallations.clear();
    this.installations.clear();
    this.portraitInstalledAt.clear();
    this.servings.clear();
    this.clearedSites.clear();
    this.transfers = [];
    this.requests.clear();
    this.phone.reset();
    this.dialogues.reset();
    this.combat.reset(players);
    this.transport.reset();
    this.modulator.reset();
    this.megaphoneBroadcast = undefined;
    this.megaphoneRecharge.clear();
    this.originalDocuments.clear();
    this.forgery.clear();
    this.signedProjects.clear();
    for (const player of players) {
      player.pocketing = undefined;
      player.interactionSpeedBonus = undefined;
      player.staminaMax = player.runningShoes = player.sprinting = undefined;
      player.stamina = MAX_STAMINA;
      player.speedModifier = undefined;
      player.staminaRegenModifier = undefined;
    }
    this.random = random;
    this.nextCashSpawn = now+4000+random()*8000;
  }

  private inventory(id:string) {
    return [...this.items.values()].filter(({place}) => 'holder' in place && place.holder===id);
  }

  private equipped(id:string) {
    return [...this.items.values()].filter(({place}) => 'equipped' in place && place.equipped===id);
  }

  owns(id:string,kind:ObjectKind) {
    return [...this.inventory(id),...this.equipped(id)].some(({data})=>data.kind===kind);
  }

  hasAgendaDecoration(id:string, kind:AgendaDecoration, replacement=false) {
    if (kind==='vipSpace') return Object.entries(installationSites).some(([site,{kind}])=>
      kind==='vip' && this.installations.get(site)?.owner.id!==id);
    if (kind==='anyPortrait' || kind==='anyVip') {
      return [...this.installations.values()].some(item=>item.kind===(kind==='anyPortrait' ? 'portrait' : 'vip'));
    }
    if (replacement) return Object.entries(installationSites).some(([site,definition])=>{
      if (definition.kind!==kind) return false;
      const installed = this.installations.get(site);
      return installed ? installed.owner.id!==id : this.clearedSites.get(site)?.by===id;
    });
    return [...this.installations.values()].some(item=>item.kind===kind &&
      (kind==='portrait' ? item.owner.id===id : item.owner.id!==id));
  }

  installedPizza(id:string) {
    const pizza = this.installations.get('pizza');
    if (!pizza?.slices) return;
    const served = this.servings.get(pizza.id) ?? new Set<string>();
    return {id:pizza.id,owned:pizza.owner.id===id,canTakeSlice:!served.has(id),slices:pizza.slices,served};
  }

  hasKnownForeignSpy(id:string) { return this.surveillance.hasKnownForeignDevice(id); }

  ownsWiretap(id:string) { return this.surveillance.countInstalled(id,'wiretap')>0; }

  ownsSpyCameras(id:string) { return this.surveillance.countInstalled(id,'spyCamera'); }

  canInstallSpy(id:string,kind:SpyDevice) { return this.surveillance.canInstall(id,kind); }

  hasLuxuryDecoration() { return [...this.installations.values()].some(item=>isOfficeFurniture(item.kind)); }

  hasOffice(id:string) { return !!this.privateOffices.ownedBy(id); }

  officeStock(id:string) {
    const office = this.privateOffices.ownedBy(id);
    return office ? decorSlots.filter(isOfficeFurniture).filter(kind=>!this.installations.has(`office:${office.id}:${kind}`)) : [];
  }

  private wearing(id:string, kind:Gear) {
    return this.equipped(id).find(({data})=>data.kind===kind)?.data;
  }

  healthFraction(player:Player, now:number) {
    const {hp,max} = this.combat.view(player,now);
    return hp/max;
  }

  private binocularRemaining(id:string,now:number) {
    return this.wearing(id,'binoculars') ? Math.max(0,(this.binocularUse.get(id)?.activeUntil ?? 0)-now) : 0;
  }

  vision(id:string,now:number) {
    return VISION_RADIUS*(this.binocularRemaining(id,now) ? binoculars.multiplier : 1)*(this.powerOut() ? powerRules.visionFactor : 1);
  }

  private stopBinoculars(id:string) {
    const use = this.binocularUse.get(id);
    if (use) use.activeUntil = 0;
  }

  officeSpawn(id:string) { return this.privateOffices.spawnFor(id); }

  private syncOfficeDoors(players:Player[],now:number) {
    const doors = this.privateOffices.doors(now);
    for (const player of players) player.barriers = doors;
  }

  private available(id:string) { return hasInventorySpace(this.inventory(id).length); }

  private stack(id:string,kind:ObjectKind,except?:number) {
    return canStackItem(kind) ? this.inventory(id).find(item=>item.data.kind===kind && item.data.id!==except) : undefined;
  }

  private takeUnits(item:Item,quantity:number):Item {
    const remaining = itemQuantity(item.data)-quantity;
    if (remaining===0) return item;
    item.data.quantity = remaining;
    this.clearRequests(item.data.id);
    const split = {data:{id:++this.serial,kind:item.data.kind,quantity},place:item.place};
    this.items.set(split.data.id,split);
    return split;
  }

  private addToInventory(item:Item,id:string) {
    const stack = this.stack(id,item.data.kind,item.data.id);
    if (stack) {
      stack.data.quantity = itemQuantity(stack.data)+itemQuantity(item.data);
      this.remove(item);
      return stack.data;
    }
    this.move(item,{holder:id});
    return item.data;
  }

  private move(item:Item, place:Place) {
    this.hide(item);
    item.place = place;
    this.clearRequests(item.data.id);
  }

  private clearRequests(id:number) {
    for (const [key,request] of this.requests) if (request.item===id) this.requests.delete(key);
  }

  private remove(item:Item) {
    this.originalDocuments.delete(item.data.id);
    this.signedProjects.delete(item.data.id);
    this.hide(item);
    this.items.delete(item.data.id);
    if (item.data.kind==='voiceModulator') this.modulator.deactivate(item.data.id);
    this.clearRequests(item.data.id);
  }

  private hide(item:Item) {
    if ('holder' in item.place) this.exposed.get(item.place.holder)?.delete(item.data.id);
  }

  private expose(id:string,item:number) {
    const items = this.exposed.get(id) ?? new Set<number>();
    items.add(item);
    this.exposed.set(id,items);
  }

  hasVisibleCash(id:string,now:number,observer:string) {
    if (observer!==id && (this.concealedUntil.get(id) ?? 0)>now) return false;
    return this.inventory(id).some(({data})=>!!cashAmount(data));
  }

  visibleItems(id:string,now=Infinity,observer?:string) {
    const concealed = observer!==id && (this.concealedUntil.get(id) ?? 0)>now;
    const visible = [...this.exposed.get(id) ?? []].flatMap(itemId=>{
      const item = this.items.get(itemId);
      return item && 'holder' in item.place && item.place.holder===id && !(concealed && cashAmount(item.data)) ? [{id:itemId,kind:item.data.kind}] : [];
    });
    const extinguisher = this.inventory(id).find(({data})=>data.kind==='extinguisher');
    if (extinguisher) visible.push({id:extinguisher.data.id,kind:'extinguisher'});
    return visible;
  }

  distributePinga(player:Player,now:number) {
    if (this.available(player.id) || this.stack(player.id,'pinga')) {
      const item = this.create('pinga',{holder:player.id});
      this.addToInventory(this.items.get(item.id)!,player.id);
    } else this.create('pinga',this.groundPlace('pinga',player,now));
  }

  private create(kind:ObjectKind, place:Place) {
    const data:WorldItem = {id:++this.serial,kind};
    if (kind==='xray') data.charges = xray.capacity;
    this.items.set(data.id,{data,place});
    return data;
  }

  hasOfficeChannel(id:string) { return this.privateOffices.channels.has(id); }

  hasCashLot(id:string,amount:number) {
    return this.inventory(id).some(({data})=>cashAmount(data)===amount);
  }

  physicalCash() { return [...this.items.values()].reduce((sum,item)=>sum+(cashAmount(item.data) ?? 0),0); }

  signableDocuments(player:Player,npc:Player,world:GameplayWorld) {
    return this.inventory(player.id).flatMap(({data})=>{
      const doc = data.document;
      return doc && doc.project===undefined && !doc.signatures.some(person=>person.id===npc.id) &&
        (!doc.requiredOffice || (world.hasMandate?.(npc.id) ?? world.office(npc.id)===doc.requiredOffice))
        ? [{id:data.id,title:doc.title}] : [];
    });
  }

  signWithNpc(player:Player,npc:Player,itemId:number,price:number,world:GameplayWorld) {
    if (!this.signableDocuments(player,npc,world).some(document=>document.id===itemId)) return 'Documento indisponível.';
    if (price && !world.payNpc?.(player.id,npc.id,price)) return 'Pagamento indisponível.';
    const item = this.items.get(itemId)!;
    item.data.document!.signatures.push({id:npc.id,name:npc.nick});
    this.signProject(item.data,npc,world.now);
    this.event(world,npc,'signed',item.data,player.id);
    console.info(JSON.stringify({event:'npc-signature',from:player.id,to:npc.id,amount:price,item:itemId}));
    return 'Assinatura obtida.';
  }

  robNpc(player:Player,npc:Player,world:GameplayWorld) {
    if (!this.available(player.id)) return 'Inventário cheio.';
    const amount = world.takeWallet?.(npc.id) ?? 0;
    if (!amount) return 'O parlamentar está sem dinheiro.';
    const cash = this.create('briefcase',{holder:player.id});
    cash.cash = amount;
    this.expose(player.id,cash.id);
    publishGameplay(world,player,'npc-robbed',{target:npc.id,item:cash.id,kind:cash.kind,amount});
    console.info(JSON.stringify({event:'npc-robbery',from:npc.id,to:player.id,amount,item:cash.id}));
    return 'Maleta roubada. Leve-a ao seu cofre.';
  }

  private event(world:GameplayWorld, actor:Player, type:GameplayEvent['type'], item?:WorldItem, target?:string,
    facts?:Partial<Pick<GameplayEvent,'inventoryItem'|'photo'|'project'|'place'|'amount'|'duration'|'replaced'|'witnesses'>>) {
    publishGameplay(world,actor,type,{target,item:item?.id,kind:item?.kind,...facts});
  }

  private groundPlace(kind:ObjectKind | WorldItem, {x,y}:Motion, now:number):GroundPlace {
    return {ground:{x,y},expires:cashAmount(kind) && (typeof kind==='string' || kind.cash===undefined) ? now+cashLifetime : undefined};
  }

  private groundItems(now:number) {
    return [...this.items.values()].flatMap(({data,place}) =>
      'ground' in place && (place.expires ?? Infinity)>now ? [{...data,...place.ground}] : []);
  }

  private visibleGround(player:Player,now:number) {
    return this.groundItems(now).filter(item=>worldVisible(player,item,this.vision(player.id,now)));
  }

  private spawnCash({now,cashFlow}:GameplayWorld) {
    if (now<this.nextCashSpawn) return;
    this.nextCashSpawn = now+8000+this.random()*10000;
    const ground = this.groundItems(now);
    const barriers = this.privateOffices.doors(now);
    if (ground.length>=maxGroundItems || ground.filter(item=>cashAmount(item)).length>=8) return;
    for (let attempt=0;attempt<16;attempt++) {
      const x = 24+Math.floor(this.random()*(WIDTH-48));
      const y = 24+Math.floor(this.random()*(HEIGHT-48));
      if (barriers.some(rect=>blockedBy(rect,x,y)) || !canStand(x,y) || !canStand(x-8,y+6) || !canStand(x+8,y+6) ||
        ground.some(item=>Math.hypot(x-item.x,y-item.y)<36) || !cashSpriteFits({x,y},this.installations.values())) continue;
      const last = findRoute({...mapEntrance,barriers},{x,y}).at(-1);
      if (last?.x!==x || last.y!==y) continue;
      const kind = 'briefcase';
      this.create(kind,this.groundPlace(kind,{x,y},now));
      cashFlow?.('spawned',cashAmount(kind)!);
      console.info(JSON.stringify({event:'money-issued',source:'cash-spawn',amount:cashAmount(kind)}));
      return;
    }
  }

  tick(world:GameplayWorld, exploring:boolean, voting=false) {
    if (world.policies?.recovery && world.now>=this.lastPolicyHeal+recoveryPolicy.tickMs) {
      this.lastPolicyHeal = world.now;
      for (const player of world.players) {
        if (!player.npc && !player.knockedOut && world.present?.(player.id)!==false && world.hasMandate?.(player.id)) {
          this.combat.heal(player,recoveryPolicy.hpPerTick);
        }
      }
    }
    for (const [id,operation] of this.forgery) {
      const player = world.players.find(person=>person.id===id);
      const item = this.inventory(id).find(({data})=>data.id===operation.item)?.data;
      if (!exploring || !player || world.present?.(id)===false || !item?.document ||
          !canReachObject(player,terminals.reprography.point,{handsFree:true})) {
        this.forgery.delete(id);
        world.feedback?.(id,'Adulteração interrompida.');
      } else if (world.now>=operation.end) {
        this.forgery.delete(id);
        const bill = bills[operation.project];
        if (!this.originalDocuments.has(item.id)) this.originalDocuments.set(item.id,structuredClone(item.document));
        Object.assign(item.document,{project:operation.project,title:bill.name,description:bill.description});
        this.clearRequests(item.id);
        this.event(world,player,'edited',item);
        world.feedback?.(id,'Documento adulterado.');
      }
    }
    this.album.tick(world.now);
    for (const [id,ends] of this.concealedUntil) {
      if (ends>world.now) continue;
      this.concealedUntil.delete(id);
      const player = world.players.find(player=>player.id===id);
      if (player) publishGameplay(world,player,'concealment-ended',{witnesses:[]});
    }
    this.transfers = this.transfers.filter(event=>world.now-event.at<=2400);
    for (const item of this.items.values()) {
      if ('ground' in item.place && (item.place.expires ?? Infinity)<=world.now) {
        const amount = cashAmount(item.data);
        if (amount) world.cashFlow?.('expired',amount);
        this.remove(item);
      }
    }
    this.privateOffices.expireDoors(world.players,world.now);
    this.syncOfficeDoors(world.players,world.now);
    this.tickXray(world,exploring);
    this.surveillance.tick(world.players,world.now,this.spyAccess(world),exploring,id=>world.present?.(id)!==false);
    if (exploring) this.spawnCash(world);
    for (const [id,request] of this.requests) if (request.expires<=world.now) this.requests.delete(id);
    this.phone.tick(world,exploring,player=>this.privateOffices.ownedBy(player.id)?.name===roomAt(player));
    this.recordRoomVisits(world,exploring);
    this.transport.tick(world,exploring);
    this.combat.tick(world.players,world.now,exploring || voting,{
      recovered:player=>{
        this.transport.detach(player,world);
        publishGameplay(world,player,'character-recovered');
      },
      canHit:player=>world.present?.(player.id)!==false && (!voting || !player.npc && inPlenary(player)),
      armored:player=>!!this.wearing(player.id,'vest'),
      hit:(attacker,target,damage)=>{
        publishGameplay(world,attacker,'hit',{target:target.id,damage});
        if (!target.knockedOut) return;
        this.transport.detach(target,world);
        publishGameplay(world,attacker,'character-knocked-out',{target:target.id});
        this.dialogues.close(target.id);
        this.stopModulator(target.id);
        this.phone.leave(target,world);
      },
    });
    this.tickOfficeChannels(world,exploring);
    this.tickInstallations(world,exploring);
    this.updateMegaphone(world,exploring);
    if (!exploring) this.dialogues.reset();
    for (const player of world.players) {
      if (!exploring || player.knockedOut || player.carried) this.stopBinoculars(player.id);
      if (player.knockedOut) this.stopModulator(player.id);
    }
  }

  private stopModulator(id:string) {
    const item = this.wearing(id,'voiceModulator');
    if (item) this.modulator.deactivate(item.id);
  }

  private nearbyParliamentarian(player:Player,world:GameplayWorld,previous?:string,eligible?:(other:Player)=>boolean) {
    const nearby = world.players.filter(other=>other.id!==player.id && !other.knockedOut && !other.carried &&
      world.present?.(other.id)!==false && world.hasMandate?.(other.id)!==false && canReachObject(player,other) && (!eligible || eligible(other)));
    return nearby.find(other=>other.id===previous)?.id ?? nearby[0]?.id;
  }

  private vipMeeting(player:Player,world:GameplayWorld,previous?:{id:number; peer:string}) {
    const room = roomAt(player);
    for (const plate of this.installations.values()) {
      if (plate.kind!=='vip' || roomAt(plate)!==room || !canReachObject(player,plate,{radius:vipAreaRadius})) continue;
      const peer = this.nearbyParliamentarian(player,world,previous?.id===plate.id ? previous.peer : undefined,
        person=>roomAt(person)===room && canReachObject(person,plate,{radius:vipAreaRadius}));
      if (peer) return {id:plate.id,peer};
    }
  }

  private recordRoomVisits(world:GameplayWorld, exploring:boolean) {
    for (const player of world.players) {
      const room = roomAt(player);
      const previous = this.roomSamples.get(player.id);
      const active = exploring && world.present?.(player.id)!==false && !player.knockedOut && !player.carried;
      const plenaryVisit = active && room==='Plenário' && !!world.hasMission?.(player.id,'presencaPlenario');
      const archiveDuty = active && room===archiveDutyRoom && !!world.hasMission?.(player.id,'plantaoArquivo');
      const concealedCash = active && !!world.hasMission?.(player.id,'nadaADeclarar') &&
        (this.concealedUntil.get(player.id) ?? 0)>world.now && this.hasVisibleCash(player.id,world.now,player.id);
      const securityPeer = active && !player.swing && this.wearing(player.id,'baton') &&
        world.hasMission?.(player.id,'segurancaParlamentar') ? this.nearbyParliamentarian(player,world,previous?.securityPeer) : undefined;
      const vip = active && world.hasMission?.(player.id,'reuniaoVip') ? this.vipMeeting(player,world,previous?.vip) : undefined;
      this.roomSamples.set(player.id,{room,at:world.now,x:player.x,y:player.y,active,archiveDuty,plenaryVisit,concealedCash,securityPeer,vip});
      if (previous?.plenaryVisit && !active) publishGameplay(world,player,'plenary-visit-interrupted',{witnesses:[]});
      if (previous?.archiveDuty && !archiveDuty) {
        publishGameplay(world,player,'room-left',{place:archiveDutyRoom,witnesses:[]});
      }
      if (previous?.vip) {
        if (previous.vip.id!==vip?.id || previous.vip.peer!==vip.peer) {
          publishGameplay(world,player,'vip-meeting-interrupted',{witnesses:[]});
        } else {
          const duration = Math.min(100,world.now-previous.at);
          if (duration>0) publishGameplay(world,player,'vip-meeting-time',{duration,witnesses:[]});
        }
      }
      if (previous?.securityPeer) {
        if (previous.securityPeer!==securityPeer) {
          publishGameplay(world,player,'security-watch-interrupted',{witnesses:[]});
        } else {
          const duration = Math.min(100,world.now-previous.at);
          if (duration>0) publishGameplay(world,player,'security-watch-time',{target:securityPeer,duration,witnesses:[]});
        }
      }
      if (!active || !previous) continue;
      if (concealedCash && previous.concealedCash && (previous.x!==player.x || previous.y!==player.y)) {
        const duration = Math.min(100,world.now-previous.at);
        if (duration>0) publishGameplay(world,player,'concealed-cash-time',{duration,witnesses:[]});
      }
      if (previous.active && previous.room!==room && previous.room==='Plenário' && world.hasMission?.(player.id,'presencaPlenario')) {
        publishGameplay(world,player,'room-left',{place:previous.room});
      }
      if (previous.room===room && room!=='Corredor' && room!=='Sala de Isolamento' &&
          (world.hasMission?.(player.id,'reuniaoGabinete') || world.hasMission?.(player.id,'reuniaoPublica'))) {
        const inOffice = privateOffices.some(office=>office.name===room);
        const peers = world.players.filter(other=>other.id!==player.id && !other.npc && !other.knockedOut &&
          world.present?.(other.id)!==false && roomAt(other)===room).length;
        const type = inOffice && peers>=1 ? 'office-meeting-time' : !inOffice && peers>=3 ? 'public-meeting-time' : undefined;
        const duration = Math.min(100,world.now-previous.at);
        if (type && duration>0) publishGameplay(world,player,type,{duration,place:room});
      }
      if (previous.room!==room && room!=='Corredor' && (room!=='Plenário' || previous.active)) {
        const office = [...this.privateOffices.offices.values()].find(entry=>entry.layout.name===room &&
          world.players.some(other=>other.id===entry.owner));
        const carryingBriefcase = office?.owner===player.id && this.inventory(player.id).some(item=>item.data.kind==='briefcase');
        publishGameplay(world,player,'room-entered',{place:room,target:office?.owner,kind:carryingBriefcase ? 'briefcase' : undefined});
      } else if (previous.room===room) {
        const ownOffice = this.privateOffices.ownedBy(player.id)?.name===room;
        const recording = archiveDuty && previous.archiveDuty ||
          room==='Cafezinho' && !world.plenary && world.hasMission?.(player.id,'pausaCafe') ||
          ownOffice && world.hasMission?.(player.id,'trabalhoRemoto');
        const duration = Math.min(100,world.now-previous.at);
        if (recording && duration>0) publishGameplay(world,player,'room-time',{place:room,duration,target:ownOffice ? player.id : undefined});
      }
    }
  }

  leave(player:Player, world:GameplayWorld, permanent:boolean) {
    this.surveillance.leave(player.id,permanent);
    this.scanning.delete(player.id);
    this.stopBinoculars(player.id);
    this.privateOffices.channels.delete(player.id);
    this.pendingInstallations.delete(player.id);
    if (this.roomSamples.get(player.id)?.securityPeer) {
      publishGameplay(world,player,'security-watch-interrupted',{witnesses:[]});
    }
    if (this.roomSamples.get(player.id)?.vip) {
      publishGameplay(world,player,'vip-meeting-interrupted',{witnesses:[]});
    }
    if (this.roomSamples.get(player.id)?.archiveDuty) {
      publishGameplay(world,player,'room-left',{place:archiveDutyRoom,witnesses:[]});
    }
    if (this.roomSamples.get(player.id)?.plenaryVisit) {
      publishGameplay(world,player,'plenary-visit-interrupted',{witnesses:[]});
    }
    this.roomSamples.delete(player.id);
    player.pocketing = undefined;
    this.album.leave(player.id,permanent);
    this.combat.interrupt(player);
    this.phone.leave(player,world);
    this.transport.detach(player,world);
    this.dialogues.close(player.id);
    this.stopModulator(player.id);
    if (!permanent) return;
    this.concealedUntil.delete(player.id);
    this.combat.leave(player);
    for (const item of [...this.inventory(player.id),...this.equipped(player.id)]) this.move(item,this.groundPlace(item.data,player,world.now));
    for (const [id,request] of this.requests) {
      if (request.from===player.id || request.to===player.id) this.requests.delete(id);
    }
  }

  phoneActivity(id:string) { return this.phone.activity(id); }
  callPeer(id:string) { return this.phone.callPeer(id); }
  disconnectCall(id:string,world:GameplayWorld) { this.phone.disconnectCall(id,world); }

  get photoRevision() { return this.album.revision; }
  photoView(id:string,now:number) { return this.album.view(id,now); }

  private dialogueEligibility(id:string, world:GameplayWorld) {
    return ({wallet,item,office,evidence,mission}:DialogueCondition) =>
      (wallet===undefined || (world.wallet?.(id) ?? 0)>=wallet) &&
      (item===undefined || [...this.inventory(id),...this.equipped(id)].some(({data})=>data.kind===item)) &&
      (office===undefined || world.office(id)===office) &&
      (evidence===undefined || world.hasEvidence?.(id,evidence)===true) &&
      (mission===undefined || world.hasMission?.(id,mission)===true);
  }

  view(player:Player, world:GameplayWorld):GameplayView {
    const {id} = player;
    const nearbyLocations = locations(player);
    const equipped = this.equipped(id).map(item=>item.data);
    const voiceGear = equipped.find(item=>item.kind==='voiceModulator');
    const modulator = voiceGear && this.modulator.view(voiceGear.id);
    const equipmentCooldowns:Record<number,number> = {};
    for (const item of equipped) {
      const seconds = item.kind==='megaphone' ? Math.ceil(Math.max(0,(this.megaphoneRecharge.get(item.id)?.until ?? 0)-world.now)/1000) :
        item.kind==='binoculars' ? Math.ceil(Math.max(0,(this.binocularUse.get(id)?.readyAt ?? 0)-world.now)/1000) :
        equippedWeapon([item]) ? this.combat.weaponRecharge(player,world.now) : undefined;
      if (seconds) equipmentCooldowns[item.id] = seconds;
    }
    const ground = this.visibleGround(player,world.now);
    const requests = [...this.requests.values()].flatMap(request => {
      if (request.to!==id) return [];
      const item = this.items.get(request.item);
      const from = world.players.find(other => other.id===request.from);
      return item && from ? [{id:request.id,kind:request.kind,item:request.quantity===undefined ? item.data : {...item.data,quantity:request.quantity},from:{id:from.id,name:from.nick}}] : [];
    });
    return {
      exposed:[...this.exposed.get(id) ?? []],
      ...this.officeView(player,world.now,world.players),
      equipped,equipmentCooldowns,
      stationCooldowns:this.stationCooldowns.view(world.now),
      installationProgress:this.installationProgress(id,world.now),
      forgeryRemaining:this.forgery.has(id) ? Math.max(0,this.forgery.get(id)!.end-world.now) : undefined,
      megaphoneSeconds:this.megaphoneBroadcast?.owner===id ? Math.ceil((this.megaphoneBroadcast.until-world.now)/1000) : undefined,
      binocularSeconds:Math.ceil(this.binocularRemaining(id,world.now)/1000) || undefined,
      concealmentSeconds:Math.ceil(Math.max(0,(this.concealedUntil.get(id) ?? 0)-world.now)/1000) || undefined,
      xrayVision:this.xrayVision(player,world),
      npcNearby:player.knockedOut || player.carrying ? [] : this.dialogues.nearbyNpcs(player),
      dialogue:player.knockedOut || player.carrying ? undefined : this.dialogues.view(player,this.dialogueEligibility(id,world)),
      vitality:this.combat.view(player,world.now),
      treatment:this.treatmentAvailable(player,world.now),
      modulator,
      decorations:[...this.installations.values()].filter(item=>isOfficeFurniture(item.kind) ||
        localPerception(player,item,this.vision(player.id,world.now)).visible),
      interactive:[...this.installations.values()].filter(item=>item.kind==='portrait' && !item.privateOffice
        ? canReachInstallation(player,item,'portrait') : canReachObject(player,item)),
      installable:Object.entries(installationSites).filter(([key,site])=>canReachInstallation(player,site.point,site.kind) && !installationConflict(this.installations.get(key),id)).map(([key])=>key),
      contacts:world.players.filter(other => !other.npc && other.id!==id && canReachObject(player,other)).map(other => ({id:other.id,name:other.nick})),
      inventory:this.inventory(id).map(item => item.data),
      nearby:ground.filter(item => canReachObject(player,item)),
      ground:ground.map(({id,kind,x,y,document}) => ({id,kind,x,y,title:document?.title})),
      stored:[...this.items.values()].filter(({place}) =>
        'storage' in place && nearbyLocations.some(key => key===place.storage)).map(({data})=>data),
      filed:nearbyLocations.includes('protocol') ? [...this.items.values()].filter(item=>'filed' in item.place).map(item=>item.data) : [],
      requests,
      ...this.phone.view(id,world.players),
      locations:nearbyLocations,
    };
  }

  private spyAccess(world:GameplayWorld) {
    return {
      ground:()=>this.groundItems(world.now),
      inventory:(id:string)=>this.inventory(id).map(({data})=>data),
      consume:(id:string,serial:number)=>{
        const item = this.inventory(id).find(({data})=>data.id===serial);
        if (!item) return false;
        this.remove(item);
        return true;
      },
      restore:(id:string,kind:SpyDevice)=>{
        if (!this.available(id)) return undefined;
        return this.create(kind,{holder:id});
      },
      feedback:(id:string,message:string)=>world.feedback?.(id,message),
      monitor:(player:Player,duration:number)=>{
        if (world.voice(player.id) && world.hasMission?.(player.id,'escutaAtiva')) {
          publishGameplay(world,player,'wiretap-time',{duration,witnesses:[]});
        }
      },
      event:(player:Player,kind:Parameters<typeof publishGameplay>[2],site:string,device?:{kind:SpyDevice;id:number})=>
        publishGameplay(world,player,kind,{place:site,kind:device?.kind,item:device?.id,witnesses:[]}),
    };
  }

  spyView(player:Player,world:GameplayWorld) {
    return this.surveillance.view(player,world.now,this.spyAccess(world),true);
  }

  spyVolume(listener:Player,talker:Player) { return this.surveillance.volume(listener,talker); }
  spySound(id:string,now:number) { this.surveillance.sound(id,now); }

  spyAction(player:Player,raw:unknown,world:GameplayWorld) {
    if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
    if (raw.kind==='close' || raw.kind==='cancel') return this.surveillance.act(player,raw,world.now,this.spyAccess(world));
    if (player.knockedOut || player.carried || player.carrying || this.hasOfficeChannel(player.id)) return;
    if (raw.kind!=='capture') return this.surveillance.act(player,raw,world.now,this.spyAccess(world));
    const device = this.surveillance.channel(player.id,'spyCamera');
    const frame = this.spyFrame(player,world);
    if (!device || !frame) return;
    const inBounds = (point:Motion)=>Math.abs(point.x-frame.center.x)<PHOTO_WIDTH/2 &&
      Math.abs(point.y-frame.center.y+PHOTO_LOOK_UP)<PHOTO_HEIGHT/2;
    const result = this.album.capture(player.id,world.now,id=>({
      ...frame,people:frame.people.filter(inBounds),ground:frame.ground.filter(inBounds),
      decorations:frame.decorations.filter(inBounds),id,author:{id:player.id,name:player.nick},at:Math.max(0,world.now-(world.started ?? 0)),
      location:device.room,selfie:false,source:{kind:'surveillance',channel:device.name},transfers:[],
    }));
    if (typeof result==='string') return result;
    publishGameplay(world,player,'photo',{photo:result,witnesses:[]});
    return 'Foto guardada no álbum.';
  }

  spyFrame(player:Player,world:GameplayWorld):PhotoScene|undefined {
    const device = this.surveillance.channel(player.id,'spyCamera');
    if (!device || player.knockedOut || player.carried) return;
    const camera = this.surveillance.origin(device);
    return this.cameraScene(player,camera,world,cameraSees);
  }

  confirmSpyFrame(player:Player,world:GameplayWorld) {
    const credit = this.surveillance.takeCameraFrameCredit(player.id);
    if (credit) publishGameplay(world,player,'spy-viewed',{...credit,kind:'spyCamera',witnesses:[]});
  }

  securityFrame(player:Player, camera:SecurityCamera, world:GameplayWorld) {
    return this.cameraScene(player,camera,world,(origin,point)=>securityCameraSees(camera,origin,point));
  }

  private cameraScene(player:Player, position:Motion, world:GameplayWorld,
    sees:(origin:Motion,point:Motion)=>boolean):PhotoScene {
    const barriers = player.barriers?.filter(([x,y,w,h])=>
      Math.hypot(x+w/2-position.x,y+h/2-position.y)<=spyRules.range+Math.hypot(w,h)/2);
    const camera = {x:position.x,y:position.y,barriers};
    const center = {...camera,y:camera.y+PHOTO_LOOK_UP};
    const visible = (point:Motion)=>sees(camera,point);
    return {center,camera,
      people:world.players.filter(person=>world.present?.(person.id)!==false && visible(person)).map(person=>({
        id:person.id,name:person.nick,x:person.x,y:person.y,character:person.character,
        direction:person.direction,moving:person.moving,knockedOut:person.knockedOut,carried:person.carried,
        exposed:this.visibleItems(person.id,world.now),phone:this.phoneActivity(person.id),
      })),
      ground:this.groundItems(world.now).filter(visible).map(({id,kind,x,y})=>({id,kind,x,y})),
      decorations:[...this.installations.values()].filter(visible).map(item=>({...item})),
    };
  }

  private capture(player:Player, selfie:boolean, world:GameplayWorld) {
    const {x,y} = player;
    const people:PhotoPerson[] = world.players.filter(person=>world.present?.(person.id)!==false && inPhotoFrame(player,person,true))
      .map(person=>({id:person.id,name:person.nick,x:person.x,y:person.y,
        character:person.character,direction:selfie && person.id===player.id ? 0 : person.direction,office:world.office(person.id),
        pocketing:person.pocketing,exposed:this.visibleItems(person.id,world.now),phone:this.phoneActivity(person.id),knockedOut:person.knockedOut,carried:person.carried}));
    const ids = new Set(people.map(person=>person.id));
    const stillAt = (id:string,point:Motion) => people.some(person=>person.id===id && Math.hypot(person.x-point.x,person.y-point.y)<=14);
    const result = this.album.capture(player.id,world.now,id=>({
      id,author:{id:player.id,name:player.nick},at:Math.max(0,world.now-(world.started ?? 0)),
      center:{x,y,barriers:player.barriers},breaches:this.officeBreaches(world.now).filter(point=>inPhotoFrame(player,point)),location:roomAt(player),selfie,people,
      ground:this.visibleGround(player,world.now).filter(item=>inPhotoFrame(player,item))
        .map(({id,kind,x,y,document})=>({id,kind,x,y,title:document?.title})),
      decorations:[...this.installations.values()].filter(item=>inPhotoFrame(player,item)).map(item=>({...item})),
      transfers:this.transfers.filter(event=>world.now-event.at<=2400 && ids.has(event.from) && ids.has(event.to) &&
        inPhotoFrame(player,event.point) && inPhotoFrame(player,event.destination) &&
        stillAt(event.from,event.point) && stillAt(event.to,event.destination)).map(({from,to,item,kind})=>({from,to,item,kind})),
    }));
    if (typeof result==='string') return result;
    const foreignOfficeSubject = result.people.some(person=>person.id!==player.id && world.players.some(other=>other.id===person.id && !other.npc) &&
      [...this.privateOffices.offices.values()].some(office=>office.owner && office.owner!==person.id && office.layout.name===roomAt(person)));
    this.event(world,player,'photo',undefined,undefined,{photo:result,
      place:foreignOfficeSubject ? 'foreign-office-subject' : undefined,witnesses:[...ids].filter(id=>id!==player.id)});
    if (world.hasMission?.(player.id,'visitaCortesia')) {
      const office = [...this.privateOffices.offices.values()].find(office=>this.privateOffices.isInside(player,office));
      if (office) this.recordGuestInteraction(player,office,world);
    }
    return 'Foto guardada no álbum.';
  }

  private startInstallation(player:Player,action:GameplayAction,now:number) {
    this.pendingInstallations.set(player.id,{action,origin:{x:player.x,y:player.y},
      started:now,ends:now+interactionDuration(player,decorationInstallMs)});
    return 'Instalando decoração…';
  }

  private installationProgress(id:string,now:number) {
    const pending = this.pendingInstallations.get(id);
    if (!pending) return;
    return {elapsed:Math.floor((now-pending.started)/100)*100,duration:pending.ends-pending.started};
  }

  private tickInstallations(world:GameplayWorld,exploring:boolean) {
    for (const [id,pending] of this.pendingInstallations) {
      const player = world.players.find(person=>person.id===id);
      if (!exploring || !player || player.knockedOut || player.carrying || player.carried ||
          world.present?.(id)===false || player.x!==pending.origin.x || player.y!==pending.origin.y) {
        this.pendingInstallations.delete(id);
        world.feedback?.(id,'Instalação interrompida.');
        continue;
      }
      if (world.now<pending.ends) continue;
      this.pendingInstallations.delete(id);
      const message = pending.action.kind==='office-install'
        ? this.officeAction(player,pending.action,world,true)
        : this.changeInstallation(player,pending.action,world,true);
      if (message) world.feedback?.(id,message);
    }
  }

  private changeInstallation(player:Player,action:GameplayAction,world:GameplayWorld,complete = false) {
    const siteKey = action.kind==='install' ? action.place : [...this.installations].find(([,item])=>item.id===action.item)?.[0];
    if (!siteKey || !Object.hasOwn(installationSites,siteKey)) return 'Aproxime-se do local.';
    const site = installationSites[siteKey as keyof typeof installationSites];
    if (!canReachInstallation(player,site.point,site.kind)) return 'Aproxime-se do local.';
    const placed = this.installations.get(siteKey);
    if (action.kind==='install') {
      const item = this.items.get(action.item ?? -1);
      if (!item || !('holder' in item.place) || item.place.holder!==player.id || item.data.kind!==site.kind) return 'Objeto indisponível.';
      const conflict = installationConflict(placed,player.id);
      if (conflict) return conflict;
      if (!complete && site.kind!=="pizza") return this.startInstallation(player,action,world.now);
      this.remove(item);
      const cleared = this.clearedSites.get(siteKey);
      this.clearedSites.delete(siteKey);
      const replaced = placed?.owner.id ?? (cleared?.by===player.id ? cleared.owner : undefined);
      this.installations.set(siteKey,{x:site.point.x,y:site.point.y,id:item.data.id,kind:site.kind,owner:{id:player.id,name:player.nick},
        character:player.character,slices:site.kind==='pizza' ? 6 : undefined});
      if (site.kind==='portrait') this.portraitInstalledAt.set(siteKey,world.now);
      this.event(world,player,'installed',item.data,replaced,{place:siteKey,replaced:!!replaced});
      return placed ? 'Objeto substituído.' : 'Objeto instalado.';
    }
    if (!placed) return 'Objeto indisponível.';
    const data = {id:placed.id,kind:placed.kind};
    if (action.kind==='slice') {
      if (placed.kind!=='pizza' || !placed.slices) return 'A pizza acabou.';
      let served = this.servings.get(placed.id);
      if (!served) this.servings.set(placed.id,served=new Set());
      if (served.has(player.id)) return 'Você já pegou uma fatia desta pizza.';
      served.add(player.id);
      placed.slices--;
      const host = world.players.find(person=>person.id===placed.owner.id);
      this.consumeFood(player,foodDefinition('pizza').effect);
      this.event(world,player,'used',data,placed.owner.id);
      if (host && host.id!==player.id) this.event(world,host,'slice',data,player.id);
      if (!placed.slices) {
        this.installations.delete(siteKey);
        this.servings.delete(placed.id);
      }
      return 'Fatia servida.';
    }
    if (action.kind==='mark') {
      if (placed.kind!=='portrait' || placed.marked || placed.owner.id===player.id) return 'Este retrato não pode ser rabiscado.';
      placed.marked = true;
      const installedAt = this.portraitInstalledAt.get(siteKey);
      this.event(world,player,'marked',data,placed.owner.id,{place:siteKey,
        duration:installedAt===undefined ? undefined : world.now-installedAt});
      return 'Retrato rabiscado.';
    }
    const torn = placed.kind==='portrait' && placed.owner.id!==player.id;
    if (!torn && !this.available(player.id)) return 'Inventário cheio.';
    this.installations.delete(siteKey);
    this.portraitInstalledAt.delete(siteKey);
    this.servings.delete(placed.id);
    if (!torn) this.items.set(data.id,{data,place:{holder:player.id}});
    if (placed.owner.id!==player.id) this.clearedSites.set(siteKey,{by:player.id,owner:placed.owner.id});
    this.event(world,player,'uninstalled',data,placed.owner.id,{place:siteKey});
    return torn ? 'Retrato arrancado e destruído.' : 'Objeto retirado.';
  }

  private officeBreaches(now:number) {
    return [...this.privateOffices.offices.values()].flatMap(office=>[
      ...(office.doorUntil>now ? [officeDoorPoint(office.layout)] : []),
      ...(office.cabinetUntil>now ? [office.layout.cabinet] : []),
    ]);
  }

  private officeView(player:Player, now:number, players:Player[]):Partial<GameplayView> {
    const offices = this.privateOffices.view(now,player);
    const ownOffice = this.privateOffices.ownedBy(player.id)?.id;
    const officeFurnishings = ownOffice ? decorSlots.filter(isOfficeFurniture).filter(slot=>
      this.installations.has(`office:${ownOffice}:${slot}`)) : [];
    if (player.knockedOut || player.carrying) return {offices,ownOffice,officeFurnishings};
    const officeOptions:OfficeOption[] = [];
    const channel = this.privateOffices.channels.get(player.id);
    if (channel) return {offices,ownOffice,officeFurnishings,officeOptions:[{kind:'office-cancel',label:'Cancelar'}],
      officeChannel:{kind:channel.kind,officeId:channel.office.layout.id,label:channel.kind==='office-cash' ? 'Embolsando dinheiro' : 'Arrombando',elapsed:Math.floor((now-channel.started)/100)*100,duration:channel.ends-channel.started}};

    const items = this.inventory(player.id).map(item=>item.data);
    const tools = items.filter(item=>'attack' in objects[item.kind]).sort((a,b)=>
      this.toolLevel(b)-this.toolLevel(a));
    const tool = tools[0];
    let officeStash:GameplayView['officeStash'];
    const officeDecor:NonNullable<GameplayView['officeDecor']> = [];
    for (const office of this.privateOffices.offices.values()) {
      const {layout,owner} = office;
      const own = owner===player.id;
      const add = (kind:OfficeAction,label:string,item?:number)=>officeOptions.push({kind,label,item,place:layout.id});
      const upgrade = (target:'door'|'cabinet'|'safe',level:number)=>{
        const kit = items.find(item=>item.kind===(target==='door' ? 'doorLock' : 'cabinetLock'));
        if (kit && level<officeRules.maxSecurity) add(target==='door' ? 'office-upgrade-door' : target==='safe' ? 'office-upgrade-safe' : 'office-upgrade-cabinet',`Reforçar ${target==='door' ? 'porta' : target==='safe' ? 'cofre' : 'armário'} · Nv. ${level}`,kit.id);
      };
      const breach = (target:'door'|'cabinet'|'safe')=>{
        if (!tool || target!=='door' && this.ownerInside(office,players)) return;
        const duration = this.privateOffices.breachTime(office,target,this.toolLevel(tool),now);
        if (duration) add(target==='door' ? 'office-breach-door' : target==='safe' ? 'office-breach-safe' : 'office-breach-cabinet',
          `Arrombar ${target==='door' ? 'porta' : target==='safe' ? 'cofre' : 'armário'} · ${(interactionDuration(player,duration)/1000).toLocaleString('pt-BR',{maximumFractionDigits:1})} s`,tool.id);
      };
      if (this.privateOffices.near(player,office,'door')) {
        if (office.doorUntil<=now) {
          if (office.door==='closed' || (office.door==='locked' && own)) add('office-open','Abrir porta');
          if (own && office.door==='open') add('office-close','Fechar porta');
          if (own && office.door!=='locked') add('office-lock',`Trancar porta · Nv. ${office.doorLevel}`);
          if (own && office.door==='locked') add('office-unlock',`Destrancar porta · Nv. ${office.doorLevel}`);
          if (!own && office.door==='locked') {
            if (this.privateOffices.isInside(player,office)) add('office-open','Sair do gabinete');
            else breach('door');
          }
        }
        if (own) upgrade('door',office.doorLevel);
      }
      if (this.privateOffices.near(player,office,'cabinet')) {
        if (own) upgrade('cabinet',office.cabinetLevel);
        else breach('cabinet');
        if ((own || !this.ownerInside(office,players)) && this.privateOffices.stashAccess(player,office,now)) officeStash = {
          id:layout.id,items:this.officeStash(layout.id).map(item=>item.data),level:own ? office.cabinetLevel : undefined,
        };
      }
      if (!own && this.privateOffices.near(player,office,'safe')) breach('safe');
      if (own && this.privateOffices.near(player,office,'safe')) {
        upgrade('safe',office.safeLevel);
        for (const item of items) {
          const amount = cashAmount(item);
          if (amount) add('office-cash',`Embolsar ${money(amount)} · ${objects[item.kind].name}`,item.id);
        }
      }
      for (const slot of decorSlots) {
        if ((!own && slot!=='portrait') || !this.privateOffices.near(player,office,decorPoint(layout,slot))) continue;
        if (own) officeDecor.push({id:layout.id,kind:slot});
        const decoration = this.installations.get(`office:${layout.id}:${slot}`);
        if (decoration && (!own || this.available(player.id))) add('office-remove',own ? `Retirar · ${objects[slot].name}` : 'Arrancar retrato',decoration.id);
      }
    }
    return {offices,ownOffice,officeFurnishings,officeOptions,officeStash,officeDecor};
  }

  private officeStash(id:string) {
    return [...this.items.values()].filter(({place})=>'storage' in place && place.storage===`office:${id}`);
  }

  private toolLevel(item:WorldItem) {
    const definition = objects[item.kind];
    return 'attack' in definition ? definition.attack : 0;
  }

  private installOfficeDecor(player:Player, layout:OfficeLayout, decor:OfficeDecor, data:WorldItem, world:GameplayWorld) {
    const key = `office:${layout.id}:${decor}`;
    const prior = this.installations.get(key);
    if (prior) this.items.set(prior.id,{data:{id:prior.id,kind:prior.kind},place:{holder:player.id}});
    this.installations.set(key,{
      ...decorPoint(layout,decor),id:data.id,kind:decor,privateOffice:layout.id,
      owner:{id:player.id,name:player.nick},character:player.character,
    });
    this.event(world,player,'installed',data,undefined,{place:layout.id,replaced:!!prior});
    return prior ? 'Decoração substituída.' : 'Decoração instalada.';
  }

  private officeAction(player:Player, action:GameplayAction, world:GameplayWorld, complete = false) {
    const {kind} = action;
    const {now} = world;
    const offices = this.privateOffices;
    if (kind==='office-cancel') {
      offices.channels.delete(player.id);
      player.pocketing = undefined;
      return 'Interação cancelada.';
    }
    const office = offices.offices.get(action.place ?? '');
    if (!office) return 'Gabinete indisponível.';
    const own = office.owner===player.id;
    if (kind==='office-open' || kind==='office-close' || kind==='office-lock' || kind==='office-unlock') {
      if ((kind==='office-close' || kind==='office-lock') && world.players.some(other=>blockedBy(office.layout.door,other.x,other.y))) return 'A passagem está ocupada.';
      const previousDoor = office.door;
      const result = offices.doorAction(player,office,kind,now);
      if (office.door!==previousDoor) this.recordGuestInteraction(player,office,world);
      this.syncOfficeDoors(world.players,now);
      return result;
    }
    const item = this.items.get(action.item ?? -1);
    if (kind==='office-take' || kind==='office-stash') {
      if ((!own && (world.plenary || this.ownerInside(office,world.players))) || !offices.stashAccess(player,office,now)) return 'Armário protegido.';
      if (!item) return 'Objeto indisponível.';
      if (kind==='office-take') {
        if (!('storage' in item.place) || item.place.storage!==`office:${office.layout.id}`) return 'Objeto indisponível.';
        if (!this.available(player.id) && !this.stack(player.id,item.data.kind)) return 'Inventário cheio.';
        this.addToInventory(item,player.id);
      } else {
        if (!('holder' in item.place) || item.place.holder!==player.id) return 'O objeto não está com você.';
        if (this.officeStash(office.layout.id).length>=officeRules.stashSlots) return 'Armário cheio.';
        this.move(item,{storage:`office:${office.layout.id}`});
      }
      this.event(world,player,kind==='office-take' ? 'recovered' : 'stored',item.data,own ? undefined : office.owner,{place:office.layout.id});
      this.recordGuestInteraction(player,office,world);
      return kind==='office-take' ? 'Objeto retirado do armário.' : 'Objeto guardado no armário.';
    }
    if (kind==='office-remove') {
      const slot = decorSlots.find(slot=>this.installations.get(`office:${office.layout.id}:${slot}`)?.id===action.item);
      if (!slot) return 'Decoração indisponível.';
      const torn = !own && slot==='portrait';
      if ((!own && !torn) || !offices.near(player,office,decorPoint(office.layout,slot))) return 'Use o ponto de decoração do seu gabinete.';
      if (!torn && !this.available(player.id)) return 'Inventário cheio.';
      const key = `office:${office.layout.id}:${slot}`;
      const decoration = this.installations.get(key)!;
      this.installations.delete(key);
      const data = {id:decoration.id,kind:decoration.kind};
      if (!torn) this.items.set(data.id,{data,place:{holder:player.id}});
      this.event(world,player,'uninstalled',data,torn ? decoration.owner.id : undefined,{place:office.layout.id});
      return torn ? 'Retrato arrancado e destruído.' : 'Decoração recolhida.';
    }
    if (!item || !('holder' in item.place) || item.place.holder!==player.id) return 'O objeto não está com você.';
    if (kind==='office-install') {
      const decor = decorSlots.find(slot=>slot===item.data.kind);
      if (!decor) return 'Decoração incompatível.';
      const point = decorPoint(office.layout,decor);
      if (!own || !offices.near(player,office,point)) return 'Use o ponto de decoração do seu gabinete.';
      if (!complete) return this.startInstallation(player,action,now);
      this.remove(item);
      return this.installOfficeDecor(player,office.layout,decor,item.data,world);
    }
    if (kind==='office-upgrade-door' || kind==='office-upgrade-cabinet' || kind==='office-upgrade-safe') {
      const target = kind==='office-upgrade-door' ? 'door' : kind==='office-upgrade-safe' ? 'safe' : 'cabinet';
      const level = target==='door' ? 'doorLevel' : target==='safe' ? 'safeLevel' : 'cabinetLevel';
      if (!own || !offices.near(player,office,target)) return 'Use o reforço no seu gabinete.';
      if (item.data.kind!==(target==='door' ? 'doorLock' : 'cabinetLock')) return 'Reforço incompatível.';
      if (office[level]>=officeRules.maxSecurity) return 'Segurança no nível máximo.';
      office[level]++;
      this.remove(item);
      this.event(world,player,'security-upgraded',item.data,undefined,{place:office.layout.id});
      return `Segurança nível ${office[level]}.`;
    }
    if (kind!=='office-cash' && kind!=='office-breach-door' && kind!=='office-breach-cabinet' && kind!=='office-breach-safe') return 'Ação indisponível.';
    if (offices.channels.has(player.id)) return 'Já existe uma interação em andamento.';
    const target = kind==='office-cash' || kind==='office-breach-safe' ? 'safe' : kind==='office-breach-door' ? 'door' : 'cabinet';
    if (!offices.near(player,office,target)) return 'Aproxime-se do alvo.';
    if (!own && target!=='door' && (world.plenary || this.ownerInside(office,world.players))) return 'O titular está no gabinete.';
    const level = this.toolLevel(item.data);
    const duration = kind==='office-cash' ? (own && cashAmount(item.data) ? officeRules.cashMs : undefined)
      : !own ? offices.breachTime(office,target,level,now) : undefined;
    if (!duration) return kind==='office-cash' ? 'Somente o cofre do titular aceita dinheiro.' : 'Ferramenta insuficiente ou fechadura indisponível.';
    offices.channels.set(player.id,{kind,office,item:item.data.id,origin:{x:player.x,y:player.y},started:now,ends:now+interactionDuration(player,duration),baseDuration:duration,level});
    if (kind==='office-cash') {
      player.pocketing = true;
      this.expose(player.id,item.data.id);
    }
  }

  private recordGuestInteraction(player:Player, office:Parameters<PrivateOffices['isInside']>[1], world:GameplayWorld) {
    if (office.owner && office.owner!==player.id && this.privateOffices.isInside(player,office)) {
      publishGameplay(world,player,'office-guest-interaction',{target:office.owner,place:office.layout.id,witnesses:[]});
    }
  }

  private ownerInside(office:Parameters<PrivateOffices['isInside']>[1],players:Player[]) {
    return players.some(player=>player.id===office.owner && this.privateOffices.isInside(player,office));
  }

  private tickOfficeChannels(world:GameplayWorld, exploring:boolean) {
    const offices = this.privateOffices;
    for (const [id,channel] of offices.channels) {
      const player = world.players.find(player=>player.id===id);
      const item = this.items.get(channel.item);
      const {office,kind} = channel;
      const target = kind==='office-cash' || kind==='office-breach-safe' ? 'safe' : kind==='office-breach-door' ? 'door' : 'cabinet';
      const valid = exploring && player && !player.knockedOut && !player.carrying && !player.moving &&
        world.present?.(id)!==false && player.x===channel.origin.x && player.y===channel.origin.y &&
        item && 'holder' in item.place && item.place.holder===id && offices.near(player,office,target) &&
        (kind==='office-cash' ? office.owner===id : (target==='door' || !this.ownerInside(office,world.players)) && offices.breachTime(office,target,channel.level,world.now)===channel.baseDuration);
      if (valid && world.now<channel.ends) continue;
      offices.channels.delete(id);
      if (player) player.pocketing = undefined;
      if (!valid) {
        world.feedback?.(id,'Interação interrompida.');
        continue;
      }
      if (kind==='office-breach-safe') {
        const owner = office.owner!;
        const amount = world.lootWallet?.(owner,officeRules.safeLootFraction) ?? 0;
        if (!amount) {
          world.feedback?.(id,'O cofre está vazio.');
          continue;
        }
        this.remove(item);
        const cash = this.create('briefcase',{holder:id});
        cash.cash = amount;
        this.expose(id,cash.id);
        this.event(world,player,'safe-robbed',cash,owner,{place:office.layout.id});
        world.feedback?.(id,`Maleta de ${money(amount)} retirada do cofre.`);
        world.feedback?.(owner,'Seu cofre foi saqueado.');
        continue;
      }
      this.remove(item);
      if (target==='safe') {
        world.earn(id,cashAmount(item.data)!);
        this.event(world,player,'money-pocketed',item.data,undefined,{place:office.layout.id,amount:cashAmount(item.data)});
        world.feedback?.(id,'Dinheiro embolsado.');
      } else {
        if (target==='door') office.doorUntil = world.now+officeRules.breachMs;
        else office.cabinetUntil = world.now+officeRules.breachMs;
        this.syncOfficeDoors(world.players,world.now);
        this.event(world,player,target==='door' ? 'door-breached' : 'cabinet-breached',item.data,office.owner,{place:office.layout.id,
          witnesses:world.players.filter(other=>other!==player && worldVisible(other,player)).map(other=>other.id)});
        world.feedback?.(id,target==='door' ? 'Porta arrombada.' : 'Armário arrombado.');
      }
    }
  }

  private consumeFood(player:Player, effect:FoodEffect) {
    if (effect.hp) this.combat.heal(player,effect.hp);
    const max = player.staminaMax ?? MAX_STAMINA;
    if (effect.stamina) player.stamina = Math.min(max,(player.stamina ?? max)+effect.stamina);
    if (effect.speed) player.speedModifier = {factor:effect.speed.factor,remainingMs:effect.speed.durationMs};
    if (effect.staminaRegen) player.staminaRegenModifier = {factor:effect.staminaRegen.factor,remainingMs:effect.staminaRegen.durationMs};
  }

  private tickXray(world:GameplayWorld, exploring:boolean) {
    for (const [id,scan] of this.scanning) {
      const player = world.players.find(player=>player.id===id);
      if (!exploring || scan.ends<=world.now || !player || world.present?.(id)===false ||
          player.knockedOut || player.carried || this.wearing(id,'xray')?.id!==scan.item) {
        this.scanning.delete(id);
        continue;
      }
      const safeMission = world.hasMission?.(id,'fiscalizacaoParalela');
      const npcMission = world.hasMission?.(id,'patrimonioSuspeito');
      if (!safeMission && !npcMission) continue;
      for (const target of this.xrayVision(player,world)?.targets ?? []) {
        const place = target.safe ? 'safe' : 'npc';
        const key = place+':'+target.id;
        if (!(target.safe ? safeMission : npcMission) || scan.reported.has(key)) continue;
        scan.reported.add(key);
        publishGameplay(world,player,'xray-target-revealed',{target:target.id,place,witnesses:[]});
      }
    }
  }

  private xrayVision(player:Player,world:GameplayWorld):GameplayView['xrayVision'] {
    const scan = this.scanning.get(player.id);
    if (!scan || scan.ends<=world.now || world.plenary || player.knockedOut || player.carried ||
        this.wearing(player.id,'xray')?.id!==scan.item || !world.wallet) return;
    const radius = this.vision(player.id,world.now);
    const targets:NonNullable<GameplayView['xrayVision']>['targets'] = [];
    const add = (id:string,owner:string,{x,y}:Motion,safe?:true)=>{
      let balance = scan.balances.get(id);
      if (balance===undefined) {
        balance = world.wallet!(owner);
        scan.balances.set(id,balance);
      }
      targets.push({id,x,y,safe,balance});
    };
    for (const target of world.players) {
      if (target.npc && world.present?.(target.id)!==false && worldVisible(player,target,radius)) add(target.id,target.id,target);
    }
    for (const office of this.privateOffices.offices.values()) {
      const {owner,layout} = office;
      if (owner && owner!==player.id && worldVisible(player,layout.safe,radius)) add(layout.id,owner,layout.safe,true);
    }
    return {remaining:Math.ceil((scan.ends-world.now)/1000),targets};
  }

  private useXray(player:Player,action:GameplayAction,world:GameplayWorld) {
    const item = this.wearing(player.id,'xray');
    if (!item) return 'Equipe o Raio X.';
    if (action.kind==='recharge-xray') {
      if (!canReachObject(player,npcs.vendor)) return 'Recarregue no Apoio Técnico.';
      if ((item.charges ?? 0)>=xray.capacity) return 'Raio X já está carregado.';
      if (!world.spend?.(player.id,xray.rechargePrice)) return 'Saldo insuficiente.';
      item.charges = xray.capacity;
      this.event(world,player,'xray-recharged',item,undefined,{witnesses:[]});
      return `Raio X recarregado · ${item.charges}/${xray.capacity}`;
    }
    if (action.target!==undefined || action.place!==undefined) return 'Ative o Raio X para varrer sua visão.';
    if (this.scanning.delete(player.id)) return 'Raio X desativado.';
    if (!item.charges) return 'Raio X sem cargas. Recarregue no Apoio Técnico.';
    item.charges--;
    this.scanning.set(player.id,{item:item.id,ends:world.now+xray.duration,balances:new Map(),reported:new Set()});
    this.event(world,player,'xray-scanned',item,undefined,{witnesses:[]});
    return 'Raio X ativado.';
  }

  private buyProduct(player:Player, requested:unknown, token:number|undefined, world:GameplayWorld) {
    const {id} = player;
    let confirmation = 'Compra guardada no inventário.';
    return this.dialogues.purchase(player,token,(npc,direct)=>{
      const product = marketProduct(npcs[npc].catalog,requested,world.policies,world.publicBudget);
      if (!product) {
        return marketProduct('equipment',requested) || marketProduct('food',requested) || marketProduct('furniture',requested) || isCredentialGood(requested)
          ? 'Este produto não é vendido aqui.' : 'Produto indisponível.';
      }
      const {kind,price} = product;
      const autoEquip = direct && isGear(kind) && !gearConflict(kind,this.equipped(id).map(({data})=>data));
      const layout = isOfficeFurniture(kind) ? this.privateOffices.ownedBy(id) : undefined;
      if (isOfficeFurniture(kind)) {
        if (!layout) return 'Gabinete indisponível.';
        if (this.installations.has(`office:${layout.id}:${kind}`)) return 'Você já tem este móvel instalado.';
      } else if (!autoEquip && !this.available(id) && !this.stack(id,kind)) return 'Inventário cheio.';
      if (isCredentialGood(kind) && this.inventory(id).some(item=>item.data.kind===kind)) return 'Você já carrega um desses.';
      if (isGear(kind) && this.owns(id,kind)) return 'Você já tem este equipamento.';
      const basePrice = marketProduct(npcs[npc].catalog,kind)!.price;
      const subsidy = Math.round((basePrice-price)*10)/10;
      const paid = subsidy && world.spendSubsidized ? world.spendSubsidized(id,price,subsidy) : world.spend?.(id,price);
      if (!paid) return 'Saldo insuficiente.';
      const data:WorldItem = layout ? {id:++this.serial,kind} : this.create(kind,{holder:id});
      const inventoryItem = canStackItem(kind) ? this.addToInventory(this.items.get(data.id)!,id).id : data.id;
      if (autoEquip) {
        this.changeGear(player,data.id,true,world);
        confirmation = 'Compra equipada.';
      }
      this.event(world,player,'purchased',data,undefined,{inventoryItem,amount:price});
      if (layout && isOfficeFurniture(kind)) {
        this.installOfficeDecor(player,layout,kind,data,world);
        confirmation = 'Compra instalada no seu gabinete.';
      }
    }) ?? confirmation;
  }

  applyAttribute(player:Player, attribute:Attribute) {
    const {bonus} = attributeUpgrades[attribute];
    switch (attribute) {
      case 'agility': player.interactionSpeedBonus = (player.interactionSpeedBonus ?? 0)+bonus; break;
      case 'stamina': {
        const max = player.staminaMax ?? MAX_STAMINA;
        player.staminaMax = max+bonus;
        player.stamina = Math.min(player.staminaMax,(player.stamina ?? max)+bonus);
        break;
      }
    }
  }

  private changeGear(player:Player, itemId:number|undefined, equip:boolean, world:GameplayWorld, replacement?:number) {
    const {id} = player;
    const item = itemId===undefined ? undefined : this.items.get(itemId);
    if (!item || !isGear(item.data.kind)) return 'Equipamento indisponível.';
    if (equip) {
      if (!('holder' in item.place) || item.place.holder!==id) return 'O equipamento não está com você.';
      const conflict = gearConflict(item.data.kind,this.equipped(id).map(({data})=>data));
      if (replacement!==undefined && replacement!==conflict?.id) return 'O equipamento neste espaço mudou.';
      if (conflict && replacement===undefined) return equipment[item.data.kind].slot===equipment[conflict.kind as Gear].slot
        ? 'Este espaço já está ocupado.' : 'Os dois espaços de acessórios estão ocupados.';
      this.move(item,{equipped:id});
      if (conflict) this.changeGear(player,conflict.id,false,world);
      if (item.data.kind==='runningShoes') player.runningShoes = true;
      this.event(world,player,'equipped',item.data);
      return 'Equipado.';
    }
    if (!('equipped' in item.place) || item.place.equipped!==id) return 'Equipamento indisponível.';
    if (!this.available(id)) return 'Inventário cheio.';
    this.move(item,{holder:id});
    if (item.data.kind==='binoculars') this.stopBinoculars(id);
    if (item.data.kind==='megaphone') this.stopMegaphone(id,world);
    if (item.data.kind==='voiceModulator') this.modulator.deactivate(item.data.id);
    if (item.data.kind==='runningShoes') player.runningShoes = undefined;
    this.event(world,player,'unequipped',item.data);
    return 'Guardado no inventário.';
  }

  private treatmentAvailable(player:Player, now:number) {
    if (player.knockedOut || !canReachObject(player,infirmary)) return;
    const patient = this.transport.passenger(player) ?? player;
    const {hp,max} = this.combat.view(patient,now);
    if (hp<max) return {target:patient===player ? undefined : patient.id};
  }

  private treat(player:Player, world:GameplayWorld) {
    if (!this.treatmentAvailable(player,world.now)) return 'Atendimento indisponível.';
    const patient = this.transport.passenger(player) ?? player;
    if (!world.spend?.(player.id,infirmary.price)) return 'Saldo insuficiente para o atendimento.';
    const recovering = patient.knockedOut;
    this.transport.detach(patient,world);
    this.combat.treat(patient,infirmary.healing,world.now);
    if (recovering) publishGameplay(world,patient,'character-recovered');
    publishGameplay(world,player,'treated',{target:patient.id});
    return 'Atendimento concluído.';
  }

  act(player:Player, action:GameplayAction, world:GameplayWorld) {
    const {id} = player;
    if (action.kind==='dialogue-close') return this.dialogues.close(id);
    if (player.knockedOut) return 'Você está nocauteado.';
    const officeChannel = this.privateOffices.channels.get(id);
    if (officeChannel?.kind==='office-cash' && action.kind!=='office-cancel') return 'Você já está embolsando dinheiro.';
    if (this.pendingInstallations.has(id)) return 'Você já está instalando uma decoração.';
    if (officeChannel && (action.kind==='install' || action.kind==='office-install')) return 'Já existe uma interação em andamento.';
    if (action.kind==='release') return this.transport.drop(player,world) ? 'Jogador colocado no chão.' : undefined;
    if (action.kind==='treat') return this.treat(player,world);
    if (player.carrying && !['photo','selfie','inspect-down'].includes(action.kind)) return 'Solte o jogador primeiro.';
    if (officeActions.some(kind=>kind===action.kind)) return this.officeAction(player,action,world);
    if (action.kind==='talk' || action.kind==='open-shop') {
      const error = this.dialogues.open(player,action.target,action.kind==='open-shop');
      if (!error) publishGameplay(world,player,'npc-interacted',{target:action.target});
      return error;
    }
    if (action.kind==='carry' || action.kind==='inspect-down') {
      const target = world.players.find(person=>person.id===action.target);
      if (action.kind==='carry') {
        if (!this.transport.carry(player,target,world)) return 'Esse jogador não pode ser carregado agora.';
        this.dialogues.close(id);
        this.phone.leave(player,world);
        return 'Jogador carregado.';
      }
      if (!target || !canReachDownedPlayer(player,target)) return 'Aproxime-se do jogador nocauteado.';
      return target.carried ? 'Nocauteado · em transporte.' : 'Nocauteado · pode ser socorrido ou carregado.';
    }
    if (action.kind==='dialogue-choice') return this.dialogues.choose(player,action.target,action.token,this.dialogueEligibility(id,world));
    if (action.kind==='use-binoculars') {
      if (!this.wearing(id,'binoculars')) return 'Equipe o Binóculo.';
      if ((this.binocularUse.get(id)?.readyAt ?? 0)>world.now) return 'Binóculo em recarga.';
      const activeUntil = world.now+binoculars.duration;
      this.binocularUse.set(id,{activeUntil,readyAt:activeUntil+binoculars.cooldown});
      return `Binóculo ativo por ${binoculars.duration/1000} s.`;
    }
    if (action.kind==='scan-xray' || action.kind==='recharge-xray') return this.useXray(player,action,world);
    if (action.kind==='shop-buy') return this.buyProduct(player,action.target,action.token,world);
    if (action.kind==='replace-gear' && action.token!==undefined) return this.changeGear(player,action.item,true,world,action.token);
    if (action.kind==='equip' || action.kind==='unequip') return this.changeGear(player,action.item,action.kind==='equip',world);
    if (action.kind==='toggle-megaphone') {
      if (this.megaphoneSpeaker()===id) {
        this.stopMegaphone(id,world);
        return;
      }
      const item = this.wearing(id,'megaphone');
      if (!item || !world.voice(id)) return 'Equipe o Megafone e ative a voz.';
      if (this.megaphoneBroadcast) return 'Canal de Megafone ocupado.';
      if ((this.megaphoneRecharge.get(item.id)?.until ?? 0)>world.now) return 'Megafone em recarga.';
      this.megaphoneBroadcast = {owner:id,item:item.id,until:world.now+megaphone.duration,sampledAt:world.now};
      this.event(world,player,'megaphone-started',item,undefined,{witnesses:[]});
      return 'Megafone ativo.';
    }
    if (action.kind==='toggle-modulator') {
      const item = this.wearing(id,'voiceModulator');
      if (!item) return 'Equipe o modulador de voz.';
      const before = this.modulator.view(item.id).active;
      const message = this.modulator.toggle(item.id);
      if (!before && this.modulator.view(item.id).active) this.event(world,player,'used',item);
      return message;
    }
    if (action.kind==='aid') {
      const target = world.players.find(person=>person.id===action.target);
      if (!target || !this.combat.aid(player,target,world.now)) return 'Aproxime-se de um jogador nocauteado.';
      this.transport.detach(target,world);
      publishGameplay(world,target,'character-recovered');
      this.event(world,player,'aided',undefined,target.id);
      return 'Jogador socorrido.';
    }
    if (action.kind==='attack') {
      const weapon = equippedWeapon(this.equipped(id).map(item=>item.data));
      if (!weapon) return 'Equipe uma arma.';
      const result = this.combat.attack(player,world.now,weapon);
      const sample = this.roomSamples.get(id);
      if (!result && sample?.securityPeer) {
        sample.securityPeer = undefined;
        publishGameplay(world,player,'security-watch-interrupted',{witnesses:[]});
      }
      return result;
    }
    if (action.kind==='photo' || action.kind==='selfie') return this.capture(player,action.kind==='selfie',world);
    if (action.kind.startsWith('info-') || action.kind==='photo-delete' || action.kind==='photo-publish') {
      return this.album.act(player,action,world.players,world.now,canReachObject(player,stations.press),
        (type,photo,actor,target)=>this.event(world,actor,type,undefined,target,{photo}));
    }
    if (action.kind==='conceal') {
      if (action.item===undefined || !this.exposed.get(id)?.delete(action.item)) return 'Objeto não está exposto.';
      return 'Objeto guardado.';
    }
    if (['install','uninstall','mark','slice'].includes(action.kind)) return this.changeInstallation(player,action,world);
    if (isPhoneAction(action)) return this.phone.act(player,action,world);
    const place = locations(player).find(key => key===action.place);
    const terminal = place && terminals[place];
    if (action.kind==='supply') {
      if (!terminal || !('supply' in terminal)) return 'Aproxime-se do balcão.';
      if (!this.available(id)) return 'Inventário cheio.';
      if (!(terminal.supply==='document' && action.target?.startsWith('project-')) && this.inventory(id).some(item => item.data.kind===terminal.supply)) return 'Você já está carregando um desse balcão.';
      if (terminal.supply==='coffee' && !this.stationCooldowns.take('coffee',world.now)) return stationRecharge.coffee.feedback;
      const data = this.create(terminal.supply,{holder:id});
      if (data.kind==='document') {
        const project = action.target?.startsWith('project-') ? Number(action.target.slice(8)) : undefined;
        const bill = project===undefined ? undefined : bills[project];
        if (project!==undefined && (!action.target || !/^project-[0-9]+$/.test(action.target) || !bill)) { this.remove(this.items.get(data.id)!); return 'Projeto indisponível.'; }
        const template = action.target==='queue' ? documentTemplates.queue : documentTemplates.elevator;
        const requiredOffice = !bill && 'office' in template && world.players.some(person => person.id!==id && (world.hasMandate?.(person.id) ?? world.office(person.id)===template.office)) ?
          template.office : undefined;
        data.document = {
          author:player.nick,title:bill?.name ?? template.title,project,description:bill?.description,edited:false,signatures:[],stamps:[],
          requiredSignatures:bill ? world.projectSignatures ?? Number(world.players.some(person=>person.id!==id && !person.npc)) : Math.min(template.signatures,Math.max(0,world.players.length-1)),
          requiredStamps:[...template.stamps],requiredOffice,
        };
      }
      this.event(world,player,'collected',data);
      return 'Objeto guardado no inventário.';
    }
    if (action.kind==='accept' || action.kind==='decline') return this.respond(player,action,world);
    const item = action.item===undefined ? undefined : this.items.get(action.item);
    if (!item || ('ground' in item.place && (item.place.expires ?? Infinity)<=world.now)) return 'Objeto indisponível.';
    const {data} = item;
    if (action.kind==='collect' || action.kind==='recover') {
      const accessible = action.kind==='collect' ? 'ground' in item.place && canReachObject(player,item.place.ground) :
        'storage' in item.place && locations(player).some(key => 'storage' in item.place && key===item.place.storage);
      if (!accessible || !this.available(id) && !this.stack(id,data.kind)) return 'Objeto fora de alcance ou inventário cheio.';
      this.addToInventory(item,id);
      if (cashAmount(data)) this.expose(id,data.id);
      this.event(world,player,action.kind==='collect' ? 'collected' : 'recovered',data);
      return 'Objeto recolhido.';
    }
    if (!('holder' in item.place) || item.place.holder!==id) return 'O objeto não está com você.';
    const definition = objects[data.kind];
    const quantity = action.quantity ?? itemQuantity(data);
    if ((action.kind==='offer' || action.kind==='drop') &&
      (!Number.isSafeInteger(quantity) || quantity<1 || quantity>itemQuantity(data))) return 'Quantidade indisponível.';
    switch (action.kind) {
      case 'expose':
        if (!('exposable' in definition)) return 'Este objeto fica guardado.';
        if (this.exposed.get(id)?.has(data.id)) return 'Objeto já exposto.';
        this.expose(id,data.id);
        this.event(world,player,'exposed',data);
        return 'Objeto exposto.';
      case 'offer':
      case 'sign-request': {
        const target = world.players.find(person => !person.npc && person.id===action.target && person.id!==id && canReachObject(player,person));
        if (!target) return 'Aproxime-se do destinatário.';
        if (action.kind==='sign-request' && (!data.document || data.document.signatures.some(person => person.id===target.id))) {
          return 'Este jogador não pode assinar o documento.';
        }
        if (action.kind==='sign-request' && data.document?.project!==undefined && world.canSignProject?.(target.id)===false) {
          return 'A assinatura precisa ser de outro jogador com mandato.';
        }
        this.clearRequests(data.id);
        const key = ++this.serial;
        this.requests.set(key,{id:key,kind:action.kind==='offer' ? 'offer' : 'signature',
          item:data.id,from:id,to:target.id,expires:world.now+25_000,quantity:action.kind==='offer' && canStackItem(data.kind) ? quantity : undefined});
        return 'Pedido enviado.';
      }
      case 'drop': {
        if (this.groundItems(world.now).length>=maxGroundItems) return 'Há objetos demais no chão.';
        const dropped = this.takeUnits(item,quantity);
        this.move(dropped,this.groundPlace(dropped.data,player,world.now));
        this.event(world,player,'dropped',dropped.data);
        return 'Objeto largado.';
      }
      case 'store':
        if (!place || !terminal || !('storage' in terminal)) return 'Aproxime-se de um armário.';
        if ([...this.items.values()].filter(({place:location})=>'storage' in location && location.storage===place).length>=12) {
          return 'O armário está cheio.';
        }
        this.move(item,{storage:place});
        this.event(world,player,'stored',data);
        return 'Objeto armazenado.';
      case 'deliver': {
        const total = cashAmount(data);
        const partial = action.target==='partial';
        const amount = partial ? treasuryPartialAmount(total ?? 0) : total;
        if (place!=='treasury' || !terminal || !amount || !world.deposit?.(id,amount)) return 'Leve a maleta à Tesouraria.';
        if (partial) {
          data.cash = Math.round((total!-amount)*10)/10;
          this.clearRequests(data.id);
          this.event(world,player,'cash-part-deposited',data,undefined,{place,amount,witnesses:[]});
        } else {
          this.remove(item);
        }
        this.event(world,player,'delivered',data,undefined,{place,amount});
        return `${money(amount)} entregues à Tesouraria.`;
      }
      case 'use':
        if (cashAmount(data)) return 'Leve o dinheiro ao cofre do seu gabinete.';
        if (!('use' in definition)) return 'Este objeto não pode ser usado dessa forma.';
        if (data.kind==='mensalUnderwear') {
          if ((this.concealedUntil.get(id) ?? 0)>world.now) return 'Você já está ocultando dinheiro.';
          this.remove(item);
          this.concealedUntil.set(id,world.now+concealment.duration);
          this.event(world,player,'concealment-started',data,undefined,{witnesses:[],amount:Number(this.hasVisibleCash(id,world.now,id))});
          return `Dinheiro oculto por ${concealment.duration/1000} s.`;
        }
        if (data.kind==='firstAidKit') {
          if (this.healthFraction(player,world.now)>=1) return 'Seus PV já estão cheios.';
          this.combat.heal(player,firstAidKit.healing);
        }
        const consumed = this.takeUnits(item,1);
        this.remove(consumed);
        if (isFood(data.kind)) this.consumeFood(player,foodDefinition(data.kind).effect);
        const consumptionRoom = roomAt(player);
        const ownOffice = this.privateOffices.ownedBy(id)?.name===consumptionRoom;
        this.event(world,player,'used',consumed.data,ownOffice ? id : undefined,{place:consumptionRoom});
        return data.kind==='firstAidKit' ? 'Primeiros socorros aplicados.' : 'Objeto utilizado.';
      case 'destroy':
        if (!('destructible' in definition)) return 'Este objeto não pode ser destruído.';
        this.remove(item);
        this.event(world,player,'destroyed',data);
        return 'Objeto destruído.';
      case 'edit': {
        if (!data.document || data.document.project===undefined) return 'Selecione um documento de projeto.';
        const project = Number(action.target);
        if (!action.target || !/^[0-9]+$/.test(action.target) || !Number.isInteger(project) || !bills[project] || project===data.document.project) return 'Escolha outro projeto.';
        if (!canReachObject(player,terminals.reprography.point,{handsFree:true})) return 'Aproxime-se da estação de Reprografia.';
        if (this.forgery.has(id)) return 'Adulteração em andamento.';
        this.forgery.set(id,{item:data.id,project,end:world.now+documentRules.forgeryMs});
        return 'Adulteração iniciada.';
      }
      case 'stamp':
        if (!data.document || !terminal || !('stamp' in terminal)) return 'Aproxime-se de um balcão com carimbo.';
        if (data.document.stamps.includes(terminal.stamp)) return 'Este carimbo já consta no documento.';
        data.document.stamps.push(terminal.stamp);
        this.event(world,player,'stamped',data);
        return 'Documento carimbado.';
      case 'verify-document':
        if (!data.document || !terminal || !canVerifyDocumentAt(place)) return 'Leve o documento à Secretaria ou ao Protocolo.';
        return this.documentRequirements(data) ?? 'Documento atende aos requisitos formais.';
      case 'file': {
        if (world.hasMandate?.(id)===false) return 'Somente parlamentares com mandato podem protocolar.';
        if (!data.document || !terminal || !('file' in terminal)) return 'Leve o documento ao Protocolo.';
        const error = this.documentRequirements(data);
        if (error) return error;
        if (data.document.project!==undefined) {
          if (data.document.requiredSignatures && !data.document.signatures.some(signer=>
            signer.id!==id && (world.canSignProject?.(signer.id) ?? world.players.some(person=>person.id===signer.id && !person.npc)))) {
            return 'A assinatura precisa ser de outro jogador com mandato.';
          }
          const reason = world.projectFilingError?.(id,data.document.project);
          if (reason) return reason;
        }
        const filed = [...this.items.values()].filter(item=>'filed' in item.place);
        if (filed.length>=24) this.remove(filed[0]);
        this.move(item,{filed:true});
        this.event(world,player,'filed',data,undefined,{project:data.document.project});
        return 'Documento protocolado.';
      }
    }
  }

  private respond(player:Player, action:GameplayAction, world:GameplayWorld) {
    const request = this.requests.get(action.item ?? -1);
    if (!request || request.to!==player.id || request.expires<=world.now) return 'Pedido indisponível.';
    if (action.kind==='decline') {
      this.requests.delete(request.id);
      return 'Pedido recusado.';
    }
    const owner = world.players.find(person => person.id===request.from);
    const item = this.items.get(request.item);
    if (!owner || !item || !('holder' in item.place) || item.place.holder!==owner.id || !canReachObject(player,owner)) {
      return 'O portador ou objeto está fora de alcance.';
    }
    if (request.kind==='offer') {
      if (!this.available(player.id) && !this.stack(player.id,item.data.kind)) return 'Inventário cheio.';
      const quantity = request.quantity ?? itemQuantity(item.data);
      if (quantity>itemQuantity(item.data)) return 'Quantidade indisponível.';
      const transferred = this.takeUnits(item,quantity);
      if (this.exposed.get(owner.id)?.has(item.data.id)) {
        this.transfers.push({from:owner.id,to:player.id,item:item.data.id,kind:item.data.kind,at:world.now,point:{x:owner.x,y:owner.y},destination:{x:player.x,y:player.y}});
        if (this.transfers.length>16) this.transfers.shift();
      }
      this.addToInventory(transferred,player.id);
      if (cashAmount(transferred.data)) this.expose(player.id,transferred.data.id);
      this.event(world,owner,'transferred',transferred.data,player.id);
      const amount = cashAmount(transferred.data);
      if (!amount && !owner.npc && !player.npc && world.hasMission?.(player.id,'amizadeInstitucional')) {
        this.event(world,player,'item-received',transferred.data,owner.id,{witnesses:[]});
      }
      if (amount && !owner.npc && !player.npc) {
        this.event(world,owner,'cash-handed-over',transferred.data,player.id,{amount,witnesses:[]});
        this.event(world,player,'cash-received',transferred.data,owner.id,{amount,witnesses:[]});
      }
      return 'Objeto recebido.';
    }
    const doc = item.data.document;
    if (!doc || doc.signatures.some(person => person.id===player.id) ||
      (doc.project!==undefined && (player.npc || world.canSignProject?.(player.id)===false)) ||
      (doc.requiredOffice && !(world.hasMandate?.(player.id) ?? world.office(player.id)===doc.requiredOffice))) return 'Assinatura inválida.';
    this.requests.delete(request.id);
    doc.signatures.push({id:player.id,name:player.nick});
    this.signProject(item.data,player,world.now);
    this.event(world,player,'signed',item.data,owner.id);
    return 'Documento assinado.';
  }
}
