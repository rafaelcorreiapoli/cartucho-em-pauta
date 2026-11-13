import { attributeUpgrades, type Attribute } from '../src/progression';
import { PrivateOffices } from './PrivateOffices';
import { decorPoint, decorSlots, isOfficeFurniture, isOfficeGood, officeActions, officeDoorPoint, officeGoods, officeRules, type OfficeAction, type OfficeDecor, type OfficeLayout, type OfficeOption } from '../src/private-offices';
import { money } from '../src/politics';
import { foods, isFood, type FoodEffect } from '../src/food';
import { MAX_STAMINA } from '../src/movement';
import { npcs, type DialogueCondition } from '../src/npcs';
import { canReachObject, isPhoneAction, cashAmount, documentTemplates, INVENTORY_SLOTS, objects, terminals, type Terminal, type GameplayAction, type GameplayEvent, type GameplayView, type ObjectKind, type WorldItem } from '../src/gameplay';
import { blockedBy, canStand, HEIGHT, localPerception, roomAt, worldVisible, VISION_RADIUS, WIDTH, type Motion, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import { PHOTO_HEIGHT, PHOTO_LOOK_UP, PHOTO_WIDTH, inPhotoFrame, type Decoration, type Photo, type PhotoPerson, type PhotoScene } from '../src/photography';
import { installationSites, shop } from '../src/installations';
import { stations } from '../src/plenary';
import { PhotoAlbum } from './PhotoAlbum';
import { NpcDialogues } from './NpcDialogues';
import { Combat } from './Combat';
import { Transport } from './Transport';
import { aidRadius, infirmary } from '../src/medical';
import { VoiceEquipment } from './VoiceEquipment';
import { binocularBonus, equippedWeapon, equipment, isGear, type Gear } from '../src/equipment';
import { PhoneSession } from './PhoneSession';
import { publishGameplay, type GameplayWorld } from './gameplay-world';

import { Surveillance } from "./Surveillance";
import { cameraSees, isSpyProduct, spyProducts, spyRules, type SpyDevice } from "../src/surveillance";

type GroundPlace = {ground:Motion; expires?:number};
type Place = {holder:string} | {equipped:string} | GroundPlace | {storage:string} | {filed:true};
type Item = {data:WorldItem; place:Place};
type Request = {id:number; kind:'offer'|'signature'; item:number; from:string; to:string; expires:number};
const cashKinds = ['briefcase','underwear','bundle'] as const;
const mapEntrance = {x:140,y:146};
const maxGroundItems = 36;
const cashLifetime = 55_000;
const terminalKeys = Object.keys(terminals) as Terminal[];
const locations = (player:Player) => terminalKeys.filter(key => canReachObject(player,terminals[key].point));

export class Gameplay {
  private surveillance = new Surveillance();
  private roomSamples = new Map<string,{room:string; at:number}>();
  private privateOffices = new PrivateOffices();
  private items = new Map<number,Item>();
  private requests = new Map<number,Request>();
  private phone = new PhoneSession();
  private dialogues = new NpcDialogues();
  private combat = new Combat();
  private transport = new Transport();
  private modulator = new VoiceEquipment();
  private serial = 0;
  private exposed = new Map<string,Set<number>>();
  private album = new PhotoAlbum();
  private installations = new Map<string,Decoration>();
  private servings = new Map<number,Set<string>>();
  private clearedSites = new Map<string,{by:string;owner:string}>();
  private transfers: (Photo['transfers'][number] & {at:number; point:Motion; destination:Motion})[] = [];

  private random = Math.random;
  private nextCashSpawn = Infinity;

  reset(now:number,random = Math.random,players:Player[] = [], officeRandom = Math.random) {
    this.items.clear();
    this.surveillance.reset();
    this.roomSamples.clear();
    this.privateOffices.reset(players,officeRandom);
    this.syncOfficeDoors(players,now);
    this.album.reset();
    this.exposed.clear();
    this.installations.clear();
    this.servings.clear();
    this.clearedSites.clear();
    this.transfers = [];
    this.requests.clear();
    this.phone.reset();
    this.dialogues.reset();
    this.combat.reset(players);
    this.transport.reset();
    this.modulator.reset();
    for (const player of players) {
      player.pocketing = undefined;
      player.hpBonus = player.attackBonus = player.defenseBonus = undefined;
      player.staminaMax = player.canSprint = player.sprinting = undefined;
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

  private wearing(id:string, kind:Gear) {
    return this.equipped(id).find(({data})=>data.kind===kind)?.data;
  }

  healthFraction(player:Player, now:number) {
    const {hp,max} = this.combat.view(player,now);
    return hp/max;
  }

  vision(id:string) { return VISION_RADIUS+(this.wearing(id,'binoculars') ? binocularBonus : 0); }

  officeSpawn(id:string) { return this.privateOffices.spawnFor(id); }

  private syncOfficeDoors(players:Player[],now:number) {
    const doors = this.privateOffices.doors(now);
    for (const player of players) player.barriers = doors;
  }

  private available(id:string) { return this.inventory(id).length<INVENTORY_SLOTS; }

  private move(item:Item, place:Place) {
    this.hide(item);
    item.place = place;
    this.clearRequests(item.data.id);
  }

  private clearRequests(id:number) {
    for (const [key,request] of this.requests) if (request.item===id) this.requests.delete(key);
  }

  private remove(item:Item) {
    this.hide(item);
    this.items.delete(item.data.id);
    if (item.data.kind==='voiceModulator') this.modulator.remove(item.data.id);
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

  visibleItems(id:string) {
    return [...this.exposed.get(id) ?? []].flatMap(itemId=>{
      const item = this.items.get(itemId);
      return item && 'holder' in item.place && item.place.holder===id ? [{id:itemId,kind:item.data.kind}] : [];
    });
  }

  private create(kind:ObjectKind, place:Place) {
    const data:WorldItem = {id:++this.serial,kind};
    this.items.set(data.id,{data,place});
    return data;
  }

  hasOfficeChannel(id:string) { return this.privateOffices.channels.has(id); }

  physicalCash() { return [...this.items.values()].reduce((sum,item)=>sum+(cashAmount(item.data) ?? 0),0); }

  signableDocuments(player:Player,npc:Player,world:GameplayWorld) {
    return this.inventory(player.id).flatMap(({data})=>{
      const doc = data.document;
      return doc && !doc.signatures.some(person=>person.id===npc.id) &&
        (!doc.requiredOffice || world.office(npc.id)===doc.requiredOffice)
        ? [{id:data.id,title:doc.title}] : [];
    });
  }

  signWithNpc(player:Player,npc:Player,itemId:number,price:number,world:GameplayWorld) {
    if (!this.signableDocuments(player,npc,world).some(document=>document.id===itemId)) return 'Documento indisponível.';
    if (price && !world.payNpc?.(player.id,npc.id,price)) return 'Pagamento indisponível.';
    const item = this.items.get(itemId)!;
    item.data.document!.signatures.push({id:npc.id,name:npc.nick});
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
    publishGameplay(world,player,'npc-robbed',{target:npc.id,item:cash.id,kind:cash.kind});
    console.info(JSON.stringify({event:'npc-robbery',from:npc.id,to:player.id,amount,item:cash.id}));
    return 'Maleta roubada. Leve-a ao seu cofre.';
  }

  private event(world:GameplayWorld, actor:Player, type:GameplayEvent['type'], item?:WorldItem, target?:string,
    facts?:Partial<Pick<GameplayEvent,'photo'|'place'|'replaced'|'witnesses'>>) {
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
    return this.groundItems(now).filter(item=>worldVisible(player,item,this.vision(player.id)));
  }

  private spawnCash(now:number) {
    if (now<this.nextCashSpawn) return;
    this.nextCashSpawn = now+8000+this.random()*10000;
    const ground = this.groundItems(now);
    const barriers = this.privateOffices.doors(now);
    if (ground.length>=maxGroundItems || ground.filter(item=>cashAmount(item)).length>=8) return;
    for (let attempt=0;attempt<16;attempt++) {
      const x = 24+Math.floor(this.random()*(WIDTH-48));
      const y = 24+Math.floor(this.random()*(HEIGHT-48));
      if (barriers.some(rect=>blockedBy(rect,x,y)) || !canStand(x,y) || !canStand(x-8,y+6) || !canStand(x+8,y+6) ||
        ground.some(item=>Math.hypot(x-item.x,y-item.y)<36)) continue;
      const last = findRoute({...mapEntrance,barriers},{x,y}).at(-1);
      if (last?.x!==x || last.y!==y) continue;
      const kind = cashKinds[Math.floor(this.random()*cashKinds.length)];
      this.create(kind,this.groundPlace(kind,{x,y},now));
      console.info(JSON.stringify({event:'money-issued',source:'cash-spawn',amount:cashAmount(kind)}));
      return;
    }
  }

  tick(world:GameplayWorld, exploring:boolean) {
    this.album.tick(world.now);
    this.transfers = this.transfers.filter(event=>world.now-event.at<=2400);
    for (const item of this.items.values()) {
      if ('ground' in item.place && (item.place.expires ?? Infinity)<=world.now) this.remove(item);
    }
    this.privateOffices.expireDoors(world.players,world.now);
    this.syncOfficeDoors(world.players,world.now);
    this.surveillance.tick(world.players,world.now,this.spyAccess(world),exploring,id=>world.present?.(id)!==false);
    if (exploring) this.spawnCash(world.now);
    for (const [id,request] of this.requests) if (request.expires<=world.now) this.requests.delete(id);
    this.phone.tick(world,exploring);
    this.recordRoomVisits(world,exploring);
    this.transport.tick(world,exploring);
    this.combat.tick(world.players,world.now,exploring,{
      recovered:player=>{
        this.transport.detach(player,world);
        publishGameplay(world,player,'character-recovered');
      },
      canHit:player=>world.present?.(player.id)!==false,
      armored:player=>!!this.wearing(player.id,'vest'),
      hit:(attacker,target,damage)=>{
        publishGameplay(world,attacker,'hit',{target:target.id,damage});
        if (!target.knockedOut) return;
        this.transport.detach(target,world);
        publishGameplay(world,attacker,'character-knocked-out',{target:target.id});
        this.dialogues.close(target.id);
        this.stopModulator(target.id,world.now);
        this.phone.leave(target,world);
      },
    });
    this.tickOfficeChannels(world,exploring);
    if (!exploring) this.dialogues.reset();
    for (const player of world.players) {
      if (!exploring || player.knockedOut || !world.voice(player.id)) this.stopModulator(player.id,world.now);
    }
  }

  private stopModulator(id:string, now:number) {
    const item = this.wearing(id,'voiceModulator');
    if (item) this.modulator.deactivate(item.id,now);
  }

  private recordRoomVisits(world:GameplayWorld, exploring:boolean) {
    for (const player of world.players) {
      const room = roomAt(player);
      const previous = this.roomSamples.get(player.id);
      this.roomSamples.set(player.id,{room,at:world.now});
      if (!exploring || !previous || world.present?.(player.id)===false || player.knockedOut || player.carried) continue;
      if (previous.room!==room && room!=='Corredor') {
        const office = [...this.privateOffices.offices.values()].find(entry=>entry.layout.name===room &&
          world.players.some(other=>other.id===entry.owner));
        const carryingBriefcase = office?.owner===player.id && this.inventory(player.id).some(item=>item.data.kind==='briefcase');
        publishGameplay(world,player,'room-entered',{place:room,target:office?.owner,kind:carryingBriefcase ? 'briefcase' : undefined});
      } else if (previous.room===room && room==='Cafezinho' && world.hasMission?.(player.id,'pausaCafe')) {
        const duration = Math.min(100,world.now-previous.at);
        if (duration>0) publishGameplay(world,player,'room-time',{place:room,duration});
      }
    }
  }

  leave(player:Player, world:GameplayWorld, permanent:boolean) {
    this.surveillance.leave(player.id,permanent);
    this.privateOffices.channels.delete(player.id);
    this.roomSamples.delete(player.id);
    player.pocketing = undefined;
    this.album.leave(player.id,permanent);
    this.combat.interrupt(player);
    this.phone.leave(player,world);
    this.transport.detach(player,world);
    this.dialogues.close(player.id);
    this.stopModulator(player.id,world.now);
    if (!permanent) return;
    this.combat.leave(player);
    for (const item of [...this.inventory(player.id),...this.equipped(player.id)]) this.move(item,this.groundPlace(item.data,player,world.now));
    for (const [id,request] of this.requests) {
      if (request.from===player.id || request.to===player.id) this.requests.delete(id);
    }
  }

  phoneActivity(id:string) { return this.phone.activity(id); }
  callPeer(id:string) { return this.phone.callPeer(id); }

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
    const modulator = voiceGear && this.modulator.view(voiceGear.id,world.now);
    const equipmentCooldowns:Record<number,number> = {};
    for (const item of equipped) {
      const seconds = item.kind==='voiceModulator' ? modulator?.recharge :
        equippedWeapon([item]) ? this.combat.weaponRecharge(player,world.now) : undefined;
      if (seconds) equipmentCooldowns[item.id] = seconds;
    }
    const ground = this.visibleGround(player,world.now);
    const requests = [...this.requests.values()].flatMap(request => {
      if (request.to!==id) return [];
      const item = this.items.get(request.item);
      const from = world.players.find(other => other.id===request.from);
      return item && from ? [{id:request.id,kind:request.kind,item:item.data,from:{id:from.id,name:from.nick}}] : [];
    });
    return {
      exposed:[...this.exposed.get(id) ?? []],
      ...this.officeView(player,world.now),
      equipped,equipmentCooldowns,
      npcNearby:player.knockedOut || player.carrying ? [] : this.dialogues.nearbyNpcs(player),
      dialogue:player.knockedOut || player.carrying ? undefined : this.dialogues.view(player,this.dialogueEligibility(id,world)),
      vitality:this.combat.view(player,world.now),
      treatment:this.treatmentAvailable(player,world.now),
      modulator,
      decorations:[...this.installations.values()].filter(item=>localPerception(player,item,this.vision(player.id)).visible),
      interactive:[...this.installations.values()].filter(item=>canReachObject(player,item)),
      installable:Object.entries(installationSites).filter(([,site])=>canReachObject(player,site.point)).map(([key])=>key),
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
        if (!this.available(id)) return false;
        this.create(kind,{holder:id});
        return true;
      },
      feedback:(id:string,message:string)=>world.feedback?.(id,message),
      event:(player:Player,kind:Parameters<typeof publishGameplay>[2],site:string)=>
        publishGameplay(world,player,kind,{place:site,witnesses:[]}),
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
    const barriers = player.barriers?.filter(([x,y,w,h])=>
      Math.hypot(x+w/2-device.site.x,y+h/2-device.site.y)<=spyRules.range+Math.hypot(w,h)/2);
    const camera = this.surveillance.origin(device,barriers);
    const center = {...camera,y:camera.y+PHOTO_LOOK_UP};
    const visible = (point:Motion)=>cameraSees(camera,point);
    return {center,camera,
      people:world.players.filter(person=>world.present?.(person.id)!==false && visible(person)).map(person=>({
        id:person.id,name:person.nick,x:person.x,y:person.y,character:person.character,
        direction:person.direction,moving:person.moving,knockedOut:person.knockedOut,carried:person.carried,
        exposed:this.visibleItems(person.id),phone:this.phoneActivity(person.id),
      })),
      ground:this.groundItems(world.now).filter(visible).map(({id,kind,x,y})=>({id,kind,x,y})),
      decorations:[...this.installations.values()].filter(visible).map(item=>({...item})),
    };
  }

  private capture(player:Player, selfie:boolean, world:GameplayWorld) {
    const {x,y} = player;
    const people:PhotoPerson[] = world.players.filter(person=>inPhotoFrame(player,person,true))
      .map(person=>({id:person.id,name:person.nick,x:person.x,y:person.y,
        character:person.character,direction:selfie && person.id===player.id ? 0 : person.direction,office:world.office(person.id),
        pocketing:person.pocketing,exposed:this.visibleItems(person.id),phone:this.phoneActivity(person.id),knockedOut:person.knockedOut,carried:person.carried}));
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
    this.event(world,player,'photo',undefined,undefined,{photo:result,witnesses:[...ids].filter(id=>id!==player.id)});
    return 'Foto guardada no álbum.';
  }

  private changeInstallation(player:Player,action:GameplayAction,world:GameplayWorld) {
    const siteKey = action.kind==='install' ? action.place : [...this.installations].find(([,item])=>item.id===action.item)?.[0];
    if (!siteKey || !Object.hasOwn(installationSites,siteKey)) return 'Aproxime-se do local.';
    const site = installationSites[siteKey as keyof typeof installationSites];
    if (!canReachObject(player,site.point)) return 'Aproxime-se do local.';
    const placed = this.installations.get(siteKey);
    if (action.kind==='install') {
      const item = this.items.get(action.item ?? -1);
      if (!item || !('holder' in item.place) || item.place.holder!==player.id || item.data.kind!==site.kind) return 'Objeto indisponível.';
      if (placed?.kind==='pizza') return 'Já tem pizza na mesa.';
      if (placed && placed.owner.id===player.id) return 'Você já ocupou este lugar.';
      this.remove(item);
      const cleared = this.clearedSites.get(siteKey);
      this.clearedSites.delete(siteKey);
      const replaced = placed?.owner.id ?? (cleared?.by===player.id ? cleared.owner : undefined);
      this.installations.set(siteKey,{x:site.point.x,y:site.point.y,id:item.data.id,kind:site.kind,owner:{id:player.id,name:player.nick},
        character:player.character,slices:site.kind==='pizza' ? 6 : undefined});
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
      this.consumeFood(player,foods.pizza.effect);
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
      this.event(world,player,'marked',data,placed.owner.id,{place:siteKey});
      return 'Retrato rabiscado.';
    }
    if (!this.available(player.id)) return 'Inventário cheio.';
    this.installations.delete(siteKey);
    this.servings.delete(placed.id);
    this.items.set(data.id,{data,place:{holder:player.id}});
    if (placed.owner.id!==player.id) this.clearedSites.set(siteKey,{by:player.id,owner:placed.owner.id});
    this.event(world,player,'uninstalled',data,placed.owner.id,{place:siteKey});
    return 'Objeto retirado.';
  }

  private officeBreaches(now:number) {
    return [...this.privateOffices.offices.values()].flatMap(office=>[
      ...(office.doorUntil>now ? [officeDoorPoint(office.layout)] : []),
      ...(office.cabinetUntil>now ? [office.layout.cabinet] : []),
    ]);
  }

  private officeView(player:Player, now:number):Partial<GameplayView> {
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
      const upgrade = (target:'door'|'cabinet',level:number)=>{
        const kit = items.find(item=>item.kind===(target==='door' ? 'doorLock' : 'cabinetLock'));
        if (kit && level<officeRules.maxSecurity) add(target==='door' ? 'office-upgrade-door' : 'office-upgrade-cabinet',`Reforçar ${target==='door' ? 'porta' : 'armário'} · Nv. ${level}`,kit.id);
      };
      const breach = (target:'door'|'cabinet')=>{
        if (!tool) return;
        const duration = this.privateOffices.breachTime(office,target,this.toolLevel(tool),now);
        if (duration) add(target==='door' ? 'office-breach-door' : 'office-breach-cabinet',
          `Arrombar ${target==='door' ? 'porta' : 'armário'} · ${duration/1000} s`,tool.id);
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
        if (this.privateOffices.stashAccess(player,office,now)) officeStash = {
          id:layout.id,items:this.officeStash(layout.id).map(item=>item.data),level:own ? office.cabinetLevel : undefined,
        };
      }
      if (own && this.privateOffices.near(player,office,'safe')) {
        for (const item of items) {
          const amount = cashAmount(item);
          if (amount) add('office-cash',`Embolsar ${money(amount)} · ${objects[item.kind].name}`,item.id);
        }
      }
      if (own) for (const slot of decorSlots) {
        if (!this.privateOffices.near(player,office,decorPoint(layout,slot))) continue;
        officeDecor.push({id:layout.id,kind:slot});
        const decoration = this.installations.get(`office:${layout.id}:${slot}`);
        if (decoration) add('office-remove',`Retirar · ${objects[slot].name}`,decoration.id);
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

  private officeAction(player:Player, action:GameplayAction, world:GameplayWorld) {
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
      const result = offices.doorAction(player,office,kind,now);
      this.syncOfficeDoors(world.players,now);
      return result;
    }
    const item = this.items.get(action.item ?? -1);
    if (kind==='office-take' || kind==='office-stash') {
      if (!offices.stashAccess(player,office,now)) return 'Armário protegido.';
      if (!item) return 'Objeto indisponível.';
      if (kind==='office-take') {
        if (!('storage' in item.place) || item.place.storage!==`office:${office.layout.id}`) return 'Objeto indisponível.';
        if (!this.available(player.id)) return 'Inventário cheio.';
        this.move(item,{holder:player.id});
      } else {
        if (!('holder' in item.place) || item.place.holder!==player.id) return 'O objeto não está com você.';
        if (this.officeStash(office.layout.id).length>=officeRules.stashSlots) return 'Armário cheio.';
        this.move(item,{storage:`office:${office.layout.id}`});
      }
      this.event(world,player,kind==='office-take' ? 'recovered' : 'stored',item.data,own ? undefined : office.owner,{place:office.layout.id});
      return kind==='office-take' ? 'Objeto retirado do armário.' : 'Objeto guardado no armário.';
    }
    if (kind==='office-remove') {
      const slot = decorSlots.find(slot=>this.installations.get(`office:${office.layout.id}:${slot}`)?.id===action.item);
      if (!slot) return 'Decoração indisponível.';
      if (!own || !offices.near(player,office,decorPoint(office.layout,slot))) return 'Use o ponto de decoração do seu gabinete.';
      if (!this.available(player.id)) return 'Inventário cheio.';
      const key = `office:${office.layout.id}:${slot}`;
      const decoration = this.installations.get(key)!;
      this.installations.delete(key);
      const data = {id:decoration.id,kind:decoration.kind};
      this.items.set(data.id,{data,place:{holder:player.id}});
      this.event(world,player,'uninstalled',data,undefined,{place:office.layout.id});
      return 'Decoração recolhida.';
    }
    if (!item || !('holder' in item.place) || item.place.holder!==player.id) return 'O objeto não está com você.';
    if (kind==='office-install') {
      const decor = decorSlots.find(slot=>slot===item.data.kind);
      if (!decor) return 'Decoração incompatível.';
      const point = decorPoint(office.layout,decor);
      if (!own || !offices.near(player,office,point)) return 'Use o ponto de decoração do seu gabinete.';
      this.remove(item);
      return this.installOfficeDecor(player,office.layout,decor,item.data,world);
    }
    if (kind==='office-upgrade-door' || kind==='office-upgrade-cabinet') {
      const target = kind==='office-upgrade-door' ? 'door' : 'cabinet';
      const level = target==='door' ? 'doorLevel' : 'cabinetLevel';
      if (!own || !offices.near(player,office,target)) return 'Use o reforço no seu gabinete.';
      if (item.data.kind!==(target==='door' ? 'doorLock' : 'cabinetLock')) return 'Reforço incompatível.';
      if (office[level]>=officeRules.maxSecurity) return 'Segurança no nível máximo.';
      office[level]++;
      this.remove(item);
      this.event(world,player,'security-upgraded',item.data,undefined,{place:office.layout.id});
      return `Segurança nível ${office[level]}.`;
    }
    if (kind!=='office-cash' && kind!=='office-breach-door' && kind!=='office-breach-cabinet') return 'Ação indisponível.';
    if (offices.channels.has(player.id)) return 'Já existe uma interação em andamento.';
    const target = kind==='office-cash' ? 'safe' : kind==='office-breach-door' ? 'door' : 'cabinet';
    if (!offices.near(player,office,target)) return 'Aproxime-se do alvo.';
    const level = this.toolLevel(item.data);
    const duration = target==='safe' ? (own && cashAmount(item.data) ? officeRules.cashMs : undefined)
      : !own ? offices.breachTime(office,target,level,now) : undefined;
    if (!duration) return target==='safe' ? 'Somente o cofre do titular aceita dinheiro.' : 'Ferramenta insuficiente ou fechadura indisponível.';
    offices.channels.set(player.id,{kind,office,item:item.data.id,origin:{x:player.x,y:player.y},started:now,ends:now+duration,level});
    if (kind==='office-cash') {
      player.pocketing = true;
      this.expose(player.id,item.data.id);
    }
  }

  private tickOfficeChannels(world:GameplayWorld, exploring:boolean) {
    const offices = this.privateOffices;
    for (const [id,channel] of offices.channels) {
      const player = world.players.find(player=>player.id===id);
      const item = this.items.get(channel.item);
      const {office,kind} = channel;
      const target = kind==='office-cash' ? 'safe' : kind==='office-breach-door' ? 'door' : 'cabinet';
      const valid = exploring && player && !player.knockedOut && !player.carrying && !player.moving &&
        world.present?.(id)!==false && player.x===channel.origin.x && player.y===channel.origin.y &&
        item && 'holder' in item.place && item.place.holder===id && offices.near(player,office,target) &&
        (target==='safe' ? office.owner===id : offices.breachTime(office,target,channel.level,world.now)===channel.ends-channel.started);
      if (valid && world.now<channel.ends) continue;
      offices.channels.delete(id);
      if (player) player.pocketing = undefined;
      if (!valid) {
        world.feedback?.(id,'Interação interrompida.');
        continue;
      }
      this.remove(item);
      if (target==='safe') {
        world.earn(id,cashAmount(item.data)!);
        this.event(world,player,'money-pocketed',item.data,undefined,{place:office.layout.id});
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

  private buyProduct(player:Player, kind:unknown, token:number|undefined, world:GameplayWorld) {
    const {id} = player;
    let confirmation = 'Compra guardada no inventário.';
    return this.dialogues.purchase(player,token,npc=>{
      const gear = isGear(kind);
      const officeGood = isOfficeGood(kind);
      if (!gear && !isFood(kind) && !officeGood && !isSpyProduct(kind)) return 'Produto indisponível.';
      if (npcs[npc].catalog!==(isFood(kind) ? 'food' : 'equipment')) return 'Este produto não é vendido aqui.';
      const layout = isOfficeFurniture(kind) ? this.privateOffices.ownedBy(id) : undefined;
      if (isOfficeFurniture(kind)) {
        if (!layout) return 'Gabinete indisponível.';
        if (this.installations.has(`office:${layout.id}:${kind}`)) return 'Você já tem este móvel instalado.';
      } else if (!this.available(id)) return 'Inventário cheio.';
      if (gear && [...this.inventory(id),...this.equipped(id)].some(item=>item.data.kind===kind)) return 'Você já tem este equipamento.';
      if (!world.spend?.(id,gear ? equipment[kind].price : officeGood ? officeGoods[kind].price : isSpyProduct(kind) ? spyProducts[kind].price : foods[kind].price)) return 'Saldo insuficiente.';
      const data = layout ? {id:++this.serial,kind} : this.create(kind,{holder:id});
      this.event(world,player,'purchased',data);
      if (layout && isOfficeFurniture(kind)) {
        this.installOfficeDecor(player,layout,kind,data,world);
        confirmation = 'Compra instalada no seu gabinete.';
      }
    }) ?? confirmation;
  }

  applyAttribute(player:Player, attribute:Attribute) {
    const {bonus} = attributeUpgrades[attribute];
    switch (attribute) {
      case 'hp': this.combat.increaseMaxHp(player,bonus); break;
      case 'stamina': {
        const max = player.staminaMax ?? MAX_STAMINA;
        player.staminaMax = max+bonus;
        player.stamina = Math.min(player.staminaMax,(player.stamina ?? max)+bonus);
        break;
      }
      case 'attack': player.attackBonus = (player.attackBonus ?? 0)+bonus; break;
      case 'defense': player.defenseBonus = (player.defenseBonus ?? 0)+bonus; break;
    }
  }

  private changeGear(player:Player, itemId:number|undefined, equip:boolean, world:GameplayWorld) {
    const {id} = player;
    const item = itemId===undefined ? undefined : this.items.get(itemId);
    if (!item || !isGear(item.data.kind)) return 'Equipamento indisponível.';
    if (equip) {
      if (!('holder' in item.place) || item.place.holder!==id) return 'O equipamento não está com você.';
      const slot = equipment[item.data.kind].slot;
      if (this.equipped(id).some(({data})=>isGear(data.kind) && equipment[data.kind].slot===slot)) return 'Este espaço já está ocupado.';
      this.move(item,{equipped:id});
      if (item.data.kind==='runningShoes') player.canSprint = true;
      this.event(world,player,'equipped',item.data);
      return 'Equipado.';
    }
    if (!('equipped' in item.place) || item.place.equipped!==id) return 'Equipamento indisponível.';
    if (!this.available(id)) return 'Inventário cheio.';
    this.move(item,{holder:id});
    if (item.data.kind==='voiceModulator') this.modulator.deactivate(item.data.id,world.now);
    if (item.data.kind==='runningShoes') player.canSprint = player.sprinting = undefined;
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
    if (this.privateOffices.channels.get(id)?.kind==='office-cash' && action.kind!=='office-cancel') {
      return 'Você já está embolsando dinheiro.';
    }
    if (action.kind==='release') return this.transport.drop(player,world) ? 'Jogador colocado no chão.' : undefined;
    if (action.kind==='treat') return this.treat(player,world);
    if (player.carrying && !['photo','selfie','inspect-down'].includes(action.kind)) return 'Solte o jogador primeiro.';
    if (officeActions.some(kind=>kind===action.kind)) return this.officeAction(player,action,world);
    if (action.kind==='talk') {
      const error = this.dialogues.open(player,action.target);
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
      if (!target?.knockedOut || !canReachObject(player,target,{radius:aidRadius,clearFloor:true})) return 'Aproxime-se do jogador nocauteado.';
      return target.carried ? 'Nocauteado · em transporte.' : 'Nocauteado · pode ser socorrido ou carregado.';
    }
    if (action.kind==='dialogue-choice') return this.dialogues.choose(player,action.target,action.token,this.dialogueEligibility(id,world));
    if (action.kind==='shop-buy') return this.buyProduct(player,action.target,action.token,world);
    if (action.kind==='equip' || action.kind==='unequip') return this.changeGear(player,action.item,action.kind==='equip',world);
    if (action.kind==='toggle-modulator') {
      const item = this.wearing(id,'voiceModulator');
      if (!item || !world.voice(id)) return 'Equipe o modulador e ative a voz.';
      const before = this.modulator.view(item.id,world.now).active;
      const message = this.modulator.toggle(item.id,world.now);
      if (!before && this.modulator.view(item.id,world.now).active) this.event(world,player,'used',item);
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
      return this.combat.attack(player,world.now,weapon);
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
    if (action.kind==='buy') {
      const kind = action.target;
      if ((kind!=='portrait' && kind!=='vip') || !canReachObject(player,stations.credentials)) return 'Aproxime-se do balcão.';
      if (!this.available(id)) return 'Inventário cheio.';
      if (this.inventory(id).some(item=>item.data.kind===kind)) return 'Você já carrega um desses.';
      if (!world.spend?.(id,shop[kind])) return 'Saldo insuficiente.';
      const item = this.create(kind,{holder:id});
      this.event(world,player,'collected',item);
      return 'Compra guardada no inventário.';
    }
    if (['install','uninstall','mark','slice'].includes(action.kind)) return this.changeInstallation(player,action,world);
    if (isPhoneAction(action)) return this.phone.act(player,action,world);
    const place = locations(player).find(key => key===action.place);
    const terminal = place && terminals[place];
    if (action.kind==='supply') {
      if (!terminal || !('supply' in terminal)) return 'Aproxime-se do balcão.';
      if (!this.available(id)) return 'Inventário cheio.';
      if (this.inventory(id).some(item => item.data.kind===terminal.supply)) return 'Você já está carregando um desse balcão.';
      const data = this.create(terminal.supply,{holder:id});
      if (data.kind==='document') {
        const template = action.target==='queue' ? documentTemplates.queue : documentTemplates.elevator;
        const requiredOffice = 'office' in template && world.players.some(person => person.id!==id && world.office(person.id)===template.office) ?
          template.office : undefined;
        data.document = {
          author:player.nick,title:template.title,edited:false,signatures:[],stamps:[],
          requiredSignatures:Math.min(template.signatures,Math.max(0,world.players.length-1)),
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
      if (!accessible || !this.available(id)) return 'Objeto fora de alcance ou inventário cheio.';
      this.move(item,{holder:id});
      if (cashAmount(data)) this.expose(id,data.id);
      this.event(world,player,action.kind==='collect' ? 'collected' : 'recovered',data);
      return 'Objeto recolhido.';
    }
    if (!('holder' in item.place) || item.place.holder!==id) return 'O objeto não está com você.';
    const definition = objects[data.kind];
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
        this.clearRequests(data.id);
        const key = ++this.serial;
        this.requests.set(key,{id:key,kind:action.kind==='offer' ? 'offer' : 'signature',
          item:data.id,from:id,to:target.id,expires:world.now+25_000});
        return 'Pedido enviado.';
      }
      case 'drop':
        if (this.groundItems(world.now).length>=maxGroundItems) return 'Há objetos demais no chão.';
        this.move(item,this.groundPlace(item.data,player,world.now));
        this.event(world,player,'dropped',data);
        return 'Objeto largado.';
      case 'store':
        if (!place || !terminal || !('storage' in terminal)) return 'Aproxime-se de um armário.';
        if ([...this.items.values()].filter(({place:location})=>'storage' in location && location.storage===place).length>=12) {
          return 'O armário está cheio.';
        }
        this.move(item,{storage:place});
        this.event(world,player,'stored',data);
        return 'Objeto armazenado.';
      case 'deliver':
        return 'Leve o dinheiro ao cofre do seu gabinete.';
      case 'use':
        if (cashAmount(data)) return 'Leve o dinheiro ao cofre do seu gabinete.';
        if (!('use' in definition)) return 'Este objeto não pode ser usado dessa forma.';
        this.remove(item);
        if (isFood(data.kind)) this.consumeFood(player,foods[data.kind].effect);
        this.event(world,player,'used',data);
        return 'Objeto utilizado.';
      case 'destroy':
        if (!('destructible' in definition)) return 'Este objeto não pode ser destruído.';
        this.remove(item);
        this.event(world,player,'destroyed',data);
        return 'Objeto destruído.';
      case 'edit':
        if (!data.document) return 'Selecione um documento.';
        if (data.document.edited) return 'Este documento já foi adulterado.';
        data.document.edited = true;
        data.document.title += ' · versão retificada';
        data.document.signatures = [];
        data.document.stamps = [];
        this.clearRequests(data.id);
        this.event(world,player,'edited',data);
        return 'Documento adulterado. Assinaturas e carimbos precisam ser refeitos.';
      case 'stamp':
        if (!data.document || !terminal || !('stamp' in terminal)) return 'Aproxime-se de um balcão com carimbo.';
        if (data.document.stamps.includes(terminal.stamp)) return 'Este carimbo já consta no documento.';
        data.document.stamps.push(terminal.stamp);
        this.event(world,player,'stamped',data);
        return 'Documento carimbado.';
      case 'file': {
        if (!data.document || !terminal || !('file' in terminal)) return 'Leve o documento ao Protocolo.';
        const missing = data.document.requiredStamps.filter(stamp => !data.document!.stamps.includes(stamp));
        const signatures = data.document.requiredSignatures-data.document.signatures.length;
        if (missing.length || signatures>0) return `Falta: ${[...missing,...(signatures>0 ? [`${signatures} assinatura(s)`] : [])].join(', ')}.`;
        const filed = [...this.items.values()].filter(item=>'filed' in item.place);
        if (filed.length>=24) this.remove(filed[0]);
        this.move(item,{filed:true});
        this.event(world,player,'filed',data);
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
      if (!this.available(player.id)) return 'Inventário cheio.';
      if (this.exposed.get(owner.id)?.has(item.data.id)) {
        this.transfers.push({from:owner.id,to:player.id,item:item.data.id,kind:item.data.kind,at:world.now,point:{x:owner.x,y:owner.y},destination:{x:player.x,y:player.y}});
        if (this.transfers.length>16) this.transfers.shift();
      }
      this.move(item,{holder:player.id});
      if (cashAmount(item.data)) this.expose(player.id,item.data.id);
      this.event(world,owner,'transferred',item.data,player.id);
      return 'Objeto recebido.';
    }
    const doc = item.data.document;
    if (!doc || doc.signatures.some(person => person.id===player.id) ||
      (doc.requiredOffice && world.office(player.id)!==doc.requiredOffice)) return 'Assinatura inválida.';
    this.requests.delete(request.id);
    doc.signatures.push({id:player.id,name:player.nick});
    this.event(world,player,'signed',item.data,owner.id);
    return 'Documento assinado.';
  }
}
