import { canReachObject, cashAmount, documentTemplates, INVENTORY_SLOTS, objects, PHONE_PREVIEW_MS, terminals, type Terminal, type GameplayAction, type GameplayEvent, type GameplayView, type ObjectKind, type WorldItem } from '../src/gameplay';
import { canStand, HEIGHT, localPerception, roomAt, WIDTH, type Motion, type Player } from '../src/map';
import { findRoute } from '../src/navigation';
import type { Office } from '../src/elections';
import { inPhotoFrame, type Decoration, type Photo, type PhotoPerson } from '../src/photography';
import { installationSites, shop, type Installable } from '../src/installations';
import { stations } from '../src/plenary';
import { PhotoAlbum } from './PhotoAlbum';

type GroundPlace = {ground:Motion; expires?:number};
type Place = {holder:string} | GroundPlace | {storage:string} | {filed:true};
type Item = {data:WorldItem; place:Place};
type Request = {id:number; kind:'offer'|'signature'; item:number; from:string; to:string; expires:number};
type Call = {from:string; to:string; connected:boolean; expires:number};
type Puzzle = {tiles:number[]; progress:number; start:number; last:number; witnesses:Set<string>};
export type GameplayWorld = {
  players:Player[]; now:number; office:(id:string)=>Office|undefined;
  started?:number; spend?:(id:string,amount:number)=>boolean; voice:(id:string)=>boolean; earn:(id:string,amount:number)=>void; publish:(event:GameplayEvent)=>void;
};
const cashKinds = ['briefcase','underwear','bundle'] as const;
const mapEntrance = {x:140,y:146};
const maxGroundItems = 36;
const cashLifetime = 55_000;
const terminalKeys = Object.keys(terminals) as Terminal[];
const locations = (player:Player) => terminalKeys.filter(key => canReachObject(player,terminals[key].point));

export class Gameplay {
  private items = new Map<number,Item>();
  private requests = new Map<number,Request>();
  private calls = new Map<string,Call>();
  private puzzles = new Map<string,Puzzle>();
  private serial = 0;
  private exposed = new Map<string,number>();
  private album = new PhotoAlbum();
  private installations = new Map<string,Decoration>();
  private servings = new Map<number,Set<string>>();
  private clearedSites = new Map<string,{by:string;owner:string}>();
  private transfers: (Photo['transfers'][number] & {at:number; point:Motion; destination:Motion})[] = [];

  private random = Math.random;
  private nextCashSpawn = Infinity;

  reset(now:number,random = Math.random) {
    this.items.clear();
    this.album.reset();
    this.exposed.clear();
    this.installations.clear();
    this.servings.clear();
    this.clearedSites.clear();
    this.transfers = [];
    this.requests.clear();
    this.calls.clear();
    this.puzzles.clear();
    this.random = random;
    this.nextCashSpawn = now+4000+random()*8000;
  }

  private inventory(id:string) {
    return [...this.items.values()].filter(({place}) => 'holder' in place && place.holder===id);
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
    this.clearRequests(item.data.id);
  }

  private hide(item:Item) {
    if ('holder' in item.place && this.exposed.get(item.place.holder)===item.data.id) this.exposed.delete(item.place.holder);
  }

  visibleItem(id:string) {
    const item = this.items.get(this.exposed.get(id) ?? -1);
    return item && {id:item.data.id,kind:item.data.kind};
  }

  private create(kind:ObjectKind, place:Place) {
    const data:WorldItem = {id:++this.serial,kind};
    this.items.set(data.id,{data,place});
    return data;
  }

  private event(world:GameplayWorld, actor:Player, type:GameplayEvent['type'], item?:WorldItem, target?:string, duration?:number, observed?:Set<string>, facts?:Pick<GameplayEvent,'photo'|'place'|'replaced'>) {
    world.publish({
      type,actor:actor.id,target,item:item?.id,kind:item?.kind,at:world.now,position:{x:actor.x,y:actor.y},duration,
      witnesses:[...(observed ?? new Set(this.observers(world,actor,target)))],...facts,
    });
  }

  private observers(world:GameplayWorld, actor:Player, target?:string) {
    return world.players.filter(other => other.id!==actor.id && other.id!==target && localPerception(other,actor).visible)
      .map(other => other.id);
  }

  private groundPlace(kind:ObjectKind, {x,y}:Motion, now:number):GroundPlace {
    return {ground:{x,y},expires:cashAmount(kind) ? now+cashLifetime : undefined};
  }

  private groundItems(now:number) {
    return [...this.items.values()].flatMap(({data,place}) =>
      'ground' in place && (place.expires ?? Infinity)>now ? [{...data,...place.ground}] : []);
  }

  private visibleGround(player:Motion,now:number) {
    return this.groundItems(now).filter(item=>localPerception(player,item).visible);
  }

  private spawnCash(now:number) {
    if (now<this.nextCashSpawn) return;
    this.nextCashSpawn = now+8000+this.random()*10000;
    const ground = this.groundItems(now);
    if (ground.length>=maxGroundItems || ground.filter(item=>cashAmount(item.kind)).length>=8) return;
    for (let attempt=0;attempt<16;attempt++) {
      const x = 24+Math.floor(this.random()*(WIDTH-48));
      const y = 24+Math.floor(this.random()*(HEIGHT-48));
      if (!canStand(x,y) || !canStand(x-8,y+6) || !canStand(x+8,y+6) ||
        ground.some(item=>Math.hypot(x-item.x,y-item.y)<36)) continue;
      const last = findRoute(mapEntrance,{x,y}).at(-1);
      if (last?.x!==x || last.y!==y) continue;
      const kind = cashKinds[Math.floor(this.random()*cashKinds.length)];
      this.create(kind,this.groundPlace(kind,{x,y},now));
      return;
    }
  }

  tick(world:GameplayWorld, exploring:boolean) {
    this.album.tick(world.now);
    this.transfers = this.transfers.filter(event=>world.now-event.at<=2400);
    for (const item of this.items.values()) {
      if ('ground' in item.place && (item.place.expires ?? Infinity)<=world.now) this.remove(item);
    }
    if (exploring) this.spawnCash(world.now);
    for (const [id,request] of this.requests) if (request.expires<=world.now) this.requests.delete(id);
    for (const call of new Set(this.calls.values())) {
      if (!exploring || !world.voice(call.from) || !world.voice(call.to) || (!call.connected && call.expires<=world.now)) {
        this.endCall(call,world);
      }
    }
    for (const [id,puzzle] of this.puzzles) {
      const player = world.players.find(person => person.id===id);
      if (player) for (const witness of this.observers(world,player)) puzzle.witnesses.add(witness);
      if (exploring && world.now-puzzle.start<60_000) continue;
      this.puzzles.delete(id);
      if (player) this.event(world,player,'game-stopped',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
    }
  }

  leave(player:Player, world:GameplayWorld, permanent:boolean) {
    this.album.leave(player.id,permanent);
    const call = this.calls.get(player.id);
    if (call) this.endCall(call,world);
    const puzzle = this.puzzles.get(player.id);
    if (puzzle) {
      this.puzzles.delete(player.id);
      this.event(world,player,'game-stopped',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
    }
    if (!permanent) return;
    for (const item of this.inventory(player.id)) this.move(item,this.groundPlace(item.data.kind,player,world.now));
    for (const [id,request] of this.requests) {
      if (request.from===player.id || request.to===player.id) this.requests.delete(id);
    }
  }

  inCall(id:string) { return !!this.calls.get(id)?.connected; }
  phoneActivity(id:string) { return this.puzzles.has(id) ? 'game' : this.inCall(id) ? 'call' : undefined; }

  callPeer(id:string) {
    const call = this.calls.get(id);
    if (call?.connected) return call.from===id ? call.to : call.from;
  }

  get photoRevision() { return this.album.revision; }
  photoView(id:string,now:number) { return this.album.view(id,now); }

  view(player:Player, world:GameplayWorld):GameplayView {
    const {id} = player;
    const nearbyLocations = locations(player);
    const ground = this.visibleGround(player,world.now);
    const requests = [...this.requests.values()].flatMap(request => {
      if (request.to!==id) return [];
      const item = this.items.get(request.item);
      const from = world.players.find(other => other.id===request.from);
      return item && from ? [{id:request.id,kind:request.kind,item:item.data,from:{id:from.id,name:from.nick}}] : [];
    });
    const call = this.calls.get(id);
    const peer = call && world.players.find(other => other.id===(call.from===id ? call.to : call.from));
    const game = this.puzzles.get(id);
    return {
      exposed:this.exposed.get(id),
      decorations:[...this.installations.values()].filter(item=>localPerception(player,item).visible),
      interactive:[...this.installations.values()].filter(item=>canReachObject(player,item)),
      installable:Object.entries(installationSites).filter(([,site])=>canReachObject(player,site.point)).map(([key])=>key),
      contacts:world.players.filter(other => other.id!==id && canReachObject(player,other)).map(other => ({id:other.id,name:other.nick})),
      inventory:this.inventory(id).map(item => item.data),
      nearby:ground.filter(item => canReachObject(player,item)),
      ground:ground.map(({id,kind,x,y,document}) => ({id,kind,x,y,title:document?.title})),
      stored:[...this.items.values()].filter(({place}) =>
        'storage' in place && nearbyLocations.some(key => key===place.storage)).map(({data})=>data),
      filed:nearbyLocations.includes('protocol') ? [...this.items.values()].filter(item=>'filed' in item.place).map(item=>item.data) : [],
      requests,
      call:call && peer ? {peer:{id:peer.id,name:peer.nick},state:call.connected ? 'connected' : call.from===id ? 'outgoing' : 'incoming'} : undefined,
      game:game && {tiles:world.now-game.start<PHONE_PREVIEW_MS ? game.tiles : undefined,total:game.tiles.length,progress:game.progress,elapsed:Math.floor((world.now-game.start)/1000)},
      locations:nearbyLocations,
    };
  }

  private endCall(call:Call, world:GameplayWorld, actor?:Player) {
    this.calls.delete(call.from);
    this.calls.delete(call.to);
    const player = actor ?? world.players.find(person => person.id===call.from);
    if (player && call.connected) this.event(world,player,'hung-up',undefined,player.id===call.from ? call.to : call.from);
  }

  private phone(player:Player, action:GameplayAction, world:GameplayWorld) {
    const id = player.id;
    const call = this.calls.get(id);
    switch (action.kind) {
      case 'call': {
        const target = world.players.find(person => person.id===action.target && person.id!==id);
        if (!target || !world.voice(id) || !world.voice(target.id)) return 'Os dois jogadores precisam ativar a voz.';
        if (call || this.calls.has(target.id)) return 'Linha ocupada.';
        const next = {from:id,to:target.id,connected:false,expires:world.now+20_000};
        this.calls.set(id,next);
        this.calls.set(target.id,next);
        return 'Chamando…';
      }
      case 'answer':
        if (!call || call.to!==id || call.connected || call.expires<=world.now ||
          !world.voice(id) || !world.voice(call.from)) return 'Chamada indisponível.';
        call.connected = true;
        this.event(world,player,'called',undefined,call.from);
        return 'Ligação atendida.';
      case 'hangup':
        if (call) this.endCall(call,world,player);
        return 'Ligação encerrada.';
      case 'game-start':
        if (this.puzzles.has(id)) return;
        this.puzzles.set(id,{tiles:Array.from({length:5},()=>Math.floor(Math.random()*4)),progress:0,start:world.now,last:world.now,witnesses:new Set(this.observers(world,player))});
        this.event(world,player,'game-started');
        return;
      case 'game-stop':
      case 'game-tile': {
        const puzzle = this.puzzles.get(id);
        if (!puzzle) return;
        if (action.kind==='game-stop') {
          this.puzzles.delete(id);
          this.event(world,player,'game-stopped',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
          return;
        }
        if (world.now-puzzle.start<PHONE_PREVIEW_MS || world.now-puzzle.last<120 || action.tile===undefined) return;
        puzzle.last = world.now;
        puzzle.progress = action.tile===puzzle.tiles[puzzle.progress] ? puzzle.progress+1 : 0;
        if (puzzle.progress<puzzle.tiles.length) return;
        this.puzzles.delete(id);
        for (const witness of this.observers(world,player)) puzzle.witnesses.add(witness);
        this.event(world,player,'game-won',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
        return 'Rodada concluída!';
      }

    }
  }

  private capture(player:Player, selfie:boolean, world:GameplayWorld) {
    const {x,y} = player;
    const people:PhotoPerson[] = world.players.filter(person=>inPhotoFrame(player,person,true))
      .map(person=>({id:person.id,name:person.nick,x:person.x,y:person.y,
        character:person.character,direction:selfie && person.id===player.id ? 0 : person.direction,office:world.office(person.id),
        exposed:this.visibleItem(person.id),phone:this.phoneActivity(person.id)}));
    const ids = new Set(people.map(person=>person.id));
    const stillAt = (id:string,point:Motion) => people.some(person=>person.id===id && Math.hypot(person.x-point.x,person.y-point.y)<=14);
    const result = this.album.capture(player.id,world.now,id=>({
      id,author:{id:player.id,name:player.nick},at:Math.max(0,world.now-(world.started ?? 0)),
      center:{x,y},location:roomAt(player),selfie,people,
      ground:this.visibleGround(player,world.now).filter(item=>inPhotoFrame(player,item))
        .map(({id,kind,x,y,document})=>({id,kind,x,y,title:document?.title})),
      decorations:[...this.installations.values()].filter(item=>inPhotoFrame(player,item)).map(item=>({...item})),
      transfers:this.transfers.filter(event=>world.now-event.at<=2400 && ids.has(event.from) && ids.has(event.to) &&
        inPhotoFrame(player,event.point) && inPhotoFrame(player,event.destination) &&
        stillAt(event.from,event.point) && stillAt(event.to,event.destination)).map(({from,to,item,kind})=>({from,to,item,kind})),
    }));
    if (typeof result==='string') return result;
    this.event(world,player,'photo',undefined,undefined,undefined,new Set([...ids].filter(id=>id!==player.id)),{photo:result});
    return 'Foto guardada no álbum.';
  }

  private changeInstallation(player:Player,action:GameplayAction,world:GameplayWorld) {
    const siteKey = action.kind==='install' ? action.place : [...this.installations].find(([,item])=>item.id===action.item)?.[0];
    const site = installationSites[siteKey as keyof typeof installationSites];
    if (!siteKey || !site || !canReachObject(player,site.point)) return 'Aproxime-se do local.';
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
      this.event(world,player,'installed',item.data,replaced,undefined,undefined,{place:siteKey,replaced:!!replaced});
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
      this.event(world,player,'marked',data,placed.owner.id,undefined,undefined,{place:siteKey});
      return 'Retrato rabiscado.';
    }
    if (!this.available(player.id)) return 'Inventário cheio.';
    this.installations.delete(siteKey);
    this.servings.delete(placed.id);
    this.items.set(data.id,{data,place:{holder:player.id}});
    if (placed.owner.id!==player.id) this.clearedSites.set(siteKey,{by:player.id,owner:placed.owner.id});
    this.event(world,player,'uninstalled',data,placed.owner.id,undefined,undefined,{place:siteKey});
    return 'Objeto retirado.';
  }

  act(player:Player, action:GameplayAction, world:GameplayWorld) {
    const {id} = player;
    if (action.kind==='photo' || action.kind==='selfie') return this.capture(player,action.kind==='selfie',world);
    if (action.kind.startsWith('info-') || action.kind==='photo-delete' || action.kind==='photo-publish') {
      return this.album.act(player,action,world.players,world.now,canReachObject(player,stations.press),
        (type,photo,actor,target)=>this.event(world,actor,type,undefined,target,undefined,undefined,{photo}));
    }
    if (action.kind==='conceal') {
      this.exposed.delete(id);
      return 'Objeto guardado.';
    }
    if (action.kind==='buy') {
      const kind = action.target as Installable;
      const station = kind==='pizza' ? stations.coffee : stations.credentials;
      if (!Object.hasOwn(shop,kind) || !canReachObject(player,station)) return 'Aproxime-se do balcão.';
      if (!this.available(id)) return 'Inventário cheio.';
      if (this.inventory(id).some(item=>item.data.kind===kind)) return 'Você já carrega um desses.';
      if (!world.spend?.(id,shop[kind])) return 'Saldo insuficiente.';
      const item = this.create(kind,{holder:id});
      this.event(world,player,'collected',item);
      return 'Compra guardada no inventário.';
    }
    if (['install','uninstall','mark','slice'].includes(action.kind)) return this.changeInstallation(player,action,world);
    if (['call','answer','hangup','game-start','game-stop','game-tile'].includes(action.kind)) {
      return this.phone(player,action,world);
    }
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
      this.event(world,player,action.kind==='collect' ? 'collected' : 'recovered',data);
      return 'Objeto recolhido.';
    }
    const pocketing = action.kind==='use' && cashAmount(data.kind)!==undefined &&
      'ground' in item.place && canReachObject(player,item.place.ground);
    if (!pocketing && (!('holder' in item.place) || item.place.holder!==id)) return 'O objeto não está com você.';
    const definition = objects[data.kind];
    switch (action.kind) {
      case 'expose':
        if (!('exposable' in definition)) return 'Este objeto fica guardado.';
        if (this.exposed.get(id)===data.id) return 'Objeto já exposto.';
        this.exposed.set(id,data.id);
        this.event(world,player,'exposed',data);
        return 'Objeto exposto.';
      case 'offer':
      case 'sign-request': {
        const target = world.players.find(person => person.id===action.target && person.id!==id && canReachObject(player,person));
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
        this.move(item,this.groundPlace(item.data.kind,player,world.now));
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
        if (!terminal || !('delivery' in terminal) || !terminal.delivery.some(kind=>kind===data.kind) || !('amount' in definition)) {
          return 'Leve o dinheiro à Tesouraria.';
        }
        this.remove(item);
        world.earn(id,definition.amount);
        this.event(world,player,'delivered',data);
        return 'Dinheiro depositado.';
      case 'use':
        if (!('use' in definition)) return 'Este objeto não pode ser usado dessa forma.';
        this.remove(item);
        if ('amount' in definition) world.earn(id,definition.amount);
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
      if (this.visibleItem(owner.id)?.id===item.data.id) {
        this.transfers.push({from:owner.id,to:player.id,item:item.data.id,kind:item.data.kind,at:world.now,point:{x:owner.x,y:owner.y},destination:{x:player.x,y:player.y}});
        if (this.transfers.length>16) this.transfers.shift();
      }
      this.move(item,{holder:player.id});
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
