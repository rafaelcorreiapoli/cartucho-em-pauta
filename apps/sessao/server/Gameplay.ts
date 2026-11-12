import { documentTemplates, objects, PHONE_PREVIEW_MS, terminals, type Terminal, type GameplayAction, type GameplayEvent, type GameplayView, type ObjectKind, type WorldItem } from '../src/gameplay';
import { localPerception, type Motion, type Player } from '../src/map';
import type { Office } from '../src/elections';

type Place = {holder:string} | {ground:Motion} | {storage:string} | {filed:true};
type Item = {data:WorldItem; place:Place};
type Request = {id:number; kind:'offer'|'signature'; item:number; from:string; to:string; expires:number};
type Call = {from:string; to:string; connected:boolean; expires:number};
type Puzzle = {tiles:number[]; progress:number; start:number; last:number; witnesses:Set<string>};
export type GameplayWorld = {
  players:Player[]; now:number; cashVisible:(player:Player)=>ObjectKind[]; office:(id:string)=>Office|undefined;
  voice:(id:string)=>boolean; earn:(id:string,amount:number)=>void; publish:(event:GameplayEvent)=>void;
};
const MAX_ITEMS = 6;
const within = (a:Motion,b:Motion) => Math.hypot(a.x-b.x,a.y-b.y)<=24 && localPerception(a,b).visible;
const terminalKeys = Object.keys(terminals) as Terminal[];
const locations = (player:Player) => terminalKeys.filter(key => within(player,terminals[key].point));

export class Gameplay {
  private items = new Map<number,Item>();
  private requests = new Map<number,Request>();
  private calls = new Map<string,Call>();
  private puzzles = new Map<string,Puzzle>();
  private serial = 0;

  reset() {
    this.items.clear();
    this.requests.clear();
    this.calls.clear();
    this.puzzles.clear();
  }

  private inventory(id:string) {
    return [...this.items.values()].filter(({place}) => 'holder' in place && place.holder===id);
  }

  private available(id:string) { return this.inventory(id).length<MAX_ITEMS; }

  private move(item:Item, place:Place) {
    item.place = place;
    this.clearRequests(item.data.id);
  }

  private clearRequests(id:number) {
    for (const [key,request] of this.requests) if (request.item===id) this.requests.delete(key);
  }

  private remove(item:Item) {
    this.items.delete(item.data.id);
    this.clearRequests(item.data.id);
  }

  private create(kind:ObjectKind, player:Player) {
    const data:WorldItem = {id:++this.serial,kind};
    this.items.set(data.id,{data,place:{holder:player.id}});
    return data;
  }

  private event(world:GameplayWorld, actor:Player, type:GameplayEvent['type'], item?:WorldItem, target?:string, duration?:number, observed?:Set<string>) {
    world.publish({
      type,actor:actor.id,target,item:item?.id,kind:item?.kind,at:world.now,position:{x:actor.x,y:actor.y},duration,
      witnesses:[...(observed ?? new Set(this.observers(world,actor,target)))],
    });
  }

  private observers(world:GameplayWorld, actor:Player, target?:string) {
    return world.players.filter(other => other.id!==actor.id && other.id!==target && localPerception(other,actor).visible)
      .map(other => other.id);
  }

  collectCash(player:Player, take:()=>('briefcase'|'underwear'|'bundle'|undefined), world:GameplayWorld) {
    if (!this.available(player.id)) return 'Inventário cheio.';
    const kind = take();
    if (!kind) return 'Aproxime-se do objeto.';
    this.event(world,player,'collected',this.create(kind,player));
    return 'Objeto coletado.';
  }

  tick(world:GameplayWorld, allowCalls:boolean) {
    for (const [id,request] of this.requests) if (request.expires<=world.now) this.requests.delete(id);
    for (const call of new Set(this.calls.values())) {
      if (!allowCalls || !world.voice(call.from) || !world.voice(call.to) || (!call.connected && call.expires<=world.now)) {
        this.endCall(call,world);
      }
    }
    for (const [id,puzzle] of this.puzzles) {
      const player = world.players.find(person => person.id===id);
      if (player) for (const witness of this.observers(world,player)) puzzle.witnesses.add(witness);
      if (allowCalls && world.now-puzzle.start<60_000) continue;
      this.puzzles.delete(id);
      if (player) this.event(world,player,'game-stopped',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
    }
  }

  leave(player:Player, world:GameplayWorld, permanent:boolean) {
    const call = this.calls.get(player.id);
    if (call) this.endCall(call,world);
    const puzzle = this.puzzles.get(player.id);
    if (puzzle) {
      this.puzzles.delete(player.id);
      this.event(world,player,'game-stopped',undefined,undefined,world.now-puzzle.start,puzzle.witnesses);
    }
    if (!permanent) return;
    for (const item of this.inventory(player.id)) this.move(item,{ground:{x:player.x,y:player.y}});
    for (const [id,request] of this.requests) {
      if (request.from===player.id || request.to===player.id) this.requests.delete(id);
    }
  }

  inCall(id:string) { return !!this.calls.get(id)?.connected; }
  phoneActive(id:string) { return this.inCall(id) || this.puzzles.has(id); }

  callPeer(id:string) {
    const call = this.calls.get(id);
    if (call?.connected) return call.from===id ? call.to : call.from;
  }

  view(player:Player, world:GameplayWorld):GameplayView {
    const {id} = player;
    const nearbyLocations = locations(player);
    const ground = [...this.items.values()].flatMap(({data,place}) =>
      'ground' in place && localPerception(player,place.ground).visible ? [{...data,...place.ground}] : []);
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
      contacts:world.players.filter(other => other.id!==id && within(player,other)).map(other => ({id:other.id,name:other.nick})),
      inventory:this.inventory(id).map(item => item.data),
      nearby:ground.filter(item => within(player,item)),
      ground:ground.map(({id:objectId,kind,x,y}) => ({id:objectId,kind,x,y})),
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
      case 'photo': {
        if (!this.available(id)) return 'Inventário cheio.';
        const data = this.create('photo',player);
        const [place] = locations(player);
        data.photo = {
          at:world.now,location:place ? terminals[place].title : `Mapa (${Math.round(player.x)}, ${Math.round(player.y)})`,
          people:world.players.filter(person => localPerception(player,person).visible)
            .map(person => ({id:person.id,name:person.nick,character:person.character})),
          objects:[
            ...world.cashVisible(player).map(kind=>objects[kind].name),
            ...[...this.items.values()].flatMap(({data,place}) =>
              'ground' in place && localPerception(player,place.ground).visible ? [objects[data.kind].name] : []),
          ],
        };
        this.event(world,player,'photo',data);
        return 'Foto guardada no inventário.';
      }
    }
  }

  act(player:Player, action:GameplayAction, world:GameplayWorld) {
    const {id} = player;
    if (['call','answer','hangup','game-start','game-stop','game-tile','photo'].includes(action.kind)) {
      return this.phone(player,action,world);
    }
    const place = locations(player).find(key => key===action.place);
    const terminal = place && terminals[place];
    if (action.kind==='supply') {
      if (!terminal || !('supply' in terminal)) return 'Aproxime-se do balcão.';
      if (!this.available(id)) return 'Inventário cheio.';
      if (this.inventory(id).some(item => item.data.kind===terminal.supply)) return 'Você já está carregando um desse balcão.';
      const data = this.create(terminal.supply,player);
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
    if (!item) return 'Objeto indisponível.';
    const {data} = item;
    if (action.kind==='collect' || action.kind==='recover') {
      const accessible = action.kind==='collect' ? 'ground' in item.place && within(player,item.place.ground) :
        'storage' in item.place && locations(player).some(key => 'storage' in item.place && key===item.place.storage);
      if (!accessible || !this.available(id)) return 'Objeto fora de alcance ou inventário cheio.';
      this.move(item,{holder:id});
      this.event(world,player,action.kind==='collect' ? 'collected' : 'recovered',data);
      return 'Objeto recolhido.';
    }
    if (!('holder' in item.place) || item.place.holder!==id) return 'O objeto não está com você.';
    const definition = objects[data.kind];
    switch (action.kind) {
      case 'offer':
      case 'sign-request': {
        const target = world.players.find(person => person.id===action.target && person.id!==id && within(player,person));
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
        if ([...this.items.values()].filter(({place})=>'ground' in place).length>=36) return 'Há objetos demais no chão.';
        this.move(item,{ground:{x:player.x,y:player.y}});
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
    if (!owner || !item || !('holder' in item.place) || item.place.holder!==owner.id || !within(player,owner)) {
      return 'O portador ou objeto está fora de alcance.';
    }
    if (request.kind==='offer') {
      if (!this.available(player.id)) return 'Inventário cheio.';
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
