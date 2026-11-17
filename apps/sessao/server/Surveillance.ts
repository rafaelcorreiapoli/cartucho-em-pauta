import { canReachObject, type WorldItem } from '../src/gameplay';
import { localPerception, type Motion, type Player, type Rect } from '../src/map';
import { cameraSees, hideouts, spyRules, type Hideout, type SpyChannel, type SpyDevice, type SpyView } from '../src/surveillance';

type Hardware = {id:number; discoveredBy:Set<string>};
type Device = SpyChannel & {owner:string; hardware:Hardware; site:Hideout; until:number; alertAt:number; installedAt:number};
type Job = {kind:'install'|'inspect'|'remove'|'recover'; site:Hideout; item?:number; target?:number; x:number;y:number; ends:number};
type Access = {inventory:(id:string)=>WorldItem[]; consume:(id:string,item:number)=>boolean; feedback:(id:string,text:string)=>void;
  restore?:(id:string,kind:SpyDevice)=>WorldItem|undefined;
  ground?:()=>readonly (WorldItem & {x:number;y:number})[];
  monitor?:(player:Player,duration:number)=>void;
  event?:(player:Player,kind:'spy-viewed'|'spy-installed'|'spy-discovered'|'spy-removed'|'spy-install-failed'|'spy-activity',site:string,device?:{kind:SpyDevice;id:number})=>void};

export class Surveillance {
  countInstalled(id:string,kind:SpyDevice) {
    return [...this.occupied.values()].filter(device=>device.owner===id && device.kind===kind).length;
  }

  canInstall(id:string,kind:SpyDevice) {
    return this.countInstalled(id,kind)<spyRules.limit &&
      hideouts.some(site=>(site.accepts as readonly SpyDevice[]).includes(kind) && !this.occupied.has(site.id));
  }

  cameraAvailability(id:string,inventoryIds:readonly number[],credited:ReadonlySet<string>) {
    const installed = [...this.occupied.values()].filter(device=>device.owner===id && device.kind==='spyCamera');
    const uncredited = installed.filter(device=>!credited.has(String(device.hardware.id))).length;
    const empty = hideouts.filter(site=>(site.accepts as readonly SpyDevice[]).includes('spyCamera') &&
      !this.occupied.has(site.id)).length;
    const slots = Math.min(spyRules.limit-uncredited,empty+installed.length-uncredited);
    const portable = inventoryIds.filter(item=>!credited.has(String(this.recoveredHardware.get(item)?.id ?? item))).length;
    return {installed:installed.length, uncredited, slots, portable};
  }

  private devices = new Map<number,Device>();
  private recoveredHardware = new Map<number,Hardware>();
  private occupied = new Map<string,Device>();
  private jobs = new Map<string,Job>();
  private discoveries = new Map<string,Map<string,number>>();
  private selected = new Map<string,number>();
  private deliveredCameraFrames = new Set<string>();
  private listening = new Map<string,{channel:number;sampledAt:number}>();
  private muted = new Set<string>();
  private lastSound = new Map<string,number>();
  private motion = new Map<number,string>();
  private serial = 0;
  private sampleAt = 0;

  reset() {
    this.devices.clear(); this.recoveredHardware.clear(); this.occupied.clear(); this.jobs.clear(); this.discoveries.clear();
    this.selected.clear(); this.deliveredCameraFrames.clear(); this.listening.clear(); this.muted.clear(); this.lastSound.clear(); this.motion.clear(); this.sampleAt = 0;
  }

  leave(id:string, permanent=false) {
    this.jobs.delete(id); this.selected.delete(id); this.deliveredCameraFrames.delete(id); this.listening.delete(id); this.muted.delete(id); this.lastSound.delete(id);
    if (permanent) this.discoveries.delete(id);
  }

  sound(id:string,now:number) { this.lastSound.set(id,now+550); }

  private near(player:Player,site:Hideout) {
    return canReachObject(player,site,{radius:spyRules.reach,handsFree:true});
  }

  private known(id:string,device:Device) {
    return device.owner===id || this.discoveries.get(id)?.get(device.site.id)===device.id;
  }

  hasKnownForeignDevice(id:string) {
    for (const deviceId of this.discoveries.get(id)?.values() ?? []) {
      const device = this.devices.get(deviceId);
      if (device && !device.removed && device.owner!==id) return true;
    }
    return false;
  }

  channel(id:string, kind:SpyDevice) {
    const channel = kind==='wiretap' ? this.listening.get(id)?.channel : this.selected.get(id);
    const device = this.devices.get(channel ?? -1);
    return device?.owner===id && !device.removed && device.kind===kind ? device : undefined;
  }

  takeCameraFrameCredit(id:string) {
    if (this.deliveredCameraFrames.has(id)) return;
    const device = this.channel(id,'spyCamera');
    if (!device) return;
    this.deliveredCameraFrames.add(id);
    return {item:device.hardware.id,place:device.site.id};
  }

  origin({site:{x,y}}:Device,barriers?:readonly Rect[]):Motion { return {x,y,barriers}; }

  volume(listener:Player,talker:Player) {
    const device = this.channel(listener.id,'wiretap');
    if (!device || this.muted.has(listener.id)) return 0;
    return this.hearing(device,talker,listener.barriers);
  }

  private hearing(device:Device,talker:Player,barriers?:readonly Rect[]) {
    return Math.hypot(device.site.x-talker.x,device.site.y-talker.y)<=spyRules.range ?
      localPerception(this.origin(device,barriers),talker).volume : 0;
  }

  view(player:Player,now:number,access:Access,exploring:boolean):SpyView {
    const id = player.id;
    const channels = [...this.devices.values()].filter(device=>device.owner===id)
      .map(({id,name,room,kind,removed,alerts,until})=>({id,name,room,kind,removed,alerts,active:!removed && until>now}));
    const options:SpyView['options'] = [];
    const job = this.jobs.get(id);
    if (job) options.push({label:'Cancelar',kind:'cancel'});
    else if (exploring) for (const site of hideouts) {
      if (!this.near(player,site)) continue;
      const device = this.occupied.get(site.id);
      const known = device && this.known(id,device);
      if (known) {
        options.push({label:`Remover dispositivo · ${site.name}`,kind:'remove',site:site.id});
        if (device.owner===id) options.push({label:`Recuperar dispositivo · ${site.name}`,kind:'recover',site:site.id});
        else options.push({label:'Deixar instalado',kind:'keep',site:site.id});
      }
      for (const item of access.inventory(id)) {
        if (item.kind==='bugDetector') options.push({label:`Inspecionar · ${site.name}`,kind:'inspect',site:site.id,item:item.id});
        if ((item.kind==='wiretap' || item.kind==='spyCamera') && (site.accepts as readonly SpyDevice[]).includes(item.kind)) options.push({
          label:`Instalar ${item.kind==='wiretap' ? 'grampo' : 'câmera'} · ${site.name}`,kind:'install',site:site.id,item:item.id,
        });
      }
    }
    return {channels,options,selected:this.selected.get(id),audio:this.listening.get(id)?.channel,muted:this.muted.has(id),
      progress:job ? Math.max(0,1-(job.ends-now)/spyRules[job.kind]) : undefined};
  }

  act(player:Player,raw:unknown,now:number,access:Access) {
    if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
    const id = player.id;
    if (raw.kind==='close') { this.selected.delete(id); this.deliveredCameraFrames.delete(id); this.listening.delete(id); this.muted.delete(id); return; }
    if (raw.kind==='cancel') { this.jobs.delete(id); return; }
    if ('channel' in raw && typeof raw.channel==='number') {
      const device = this.devices.get(raw.channel);
      if (!device || device.owner!==id || device.removed) return;
      if (raw.kind==='open') {
        this.selected.delete(id);
        this.deliveredCameraFrames.delete(id);
        this.listening.delete(id);
        this.muted.delete(id);
        if (device.kind==='wiretap') {
          this.listening.set(id,{channel:device.id,sampledAt:now});
          access.event?.(player,'spy-viewed',device.site.id,{kind:device.kind,id:device.hardware.id});
        } else this.selected.set(id,device.id);
      }
      const listener = this.listening.get(id);
      if (raw.kind==='close-channel') {
        if (listener?.channel===device.id) this.listening.delete(id);
        if (this.selected.get(id)===device.id) this.selected.delete(id);
      }
      if (raw.kind==='mute' && listener?.channel===device.id) {
        if (this.muted.delete(id)) listener.sampledAt = now;
        else this.muted.add(id);
      }
      if (raw.kind==='alerts') device.alerts = !device.alerts;
      if (raw.kind==='rename' && 'name' in raw && typeof raw.name==='string') device.name = raw.name.trim().slice(0,32) || device.name;
      return;
    }
    if (raw.kind==='keep' && 'site' in raw && typeof raw.site==='string') {
      this.discoveries.get(id)?.delete(raw.site);
      return;
    }
    if (raw.kind!=='recover' && raw.kind!=='install' && raw.kind!=='inspect' && raw.kind!=='remove' || this.jobs.has(id)) return;
    const site = 'site' in raw ? hideouts.find(site=>site.id===raw.site) : undefined;
    if (!site || !this.near(player,site)) return;
    const item = 'item' in raw ? access.inventory(id).find(item=>item.id===raw.item) : undefined;
    const device = this.occupied.get(site.id);
    if (raw.kind==='install') {
      if (device?.owner===id) return 'Você já possui um dispositivo instalado aqui.';
      if (item?.kind!=='wiretap' && item?.kind!=='spyCamera' || !(site.accepts as readonly SpyDevice[]).includes(item.kind)) return;
    } else if (raw.kind==='inspect') {
      if (item?.kind!=='bugDetector') return;
    } else if (!device || !this.known(id,device) || raw.kind==='recover' && device.owner!==id) return;
    this.jobs.set(id,{kind:raw.kind,site,item:item?.id,target:raw.kind==='remove' || raw.kind==='recover' ? device?.id : undefined,
      x:player.x,y:player.y,ends:now+spyRules[raw.kind]});
  }

  tick(players:Player[],now:number,access:Access,exploring:boolean,present:(id:string)=>boolean) {
    const barriers = players[0]?.barriers;
    if (!exploring) { this.jobs.clear(); this.selected.clear(); this.deliveredCameraFrames.clear(); this.listening.clear(); this.muted.clear(); return; }
    for (const [id,job] of this.jobs) {
      const player = players.find(player=>player.id===id);
      if (!player || !present(id) || !this.near(player,job.site) || player.x!==job.x || player.y!==job.y) {
        this.jobs.delete(id); access.feedback(id,'Interação interrompida.'); continue;
      }
      if (now<job.ends) continue;
      this.jobs.delete(id);
      this.finish(player,job,now,access);
    }
    for (const [id,listener] of this.listening) {
      const elapsed = Math.min(100,now-listener.sampledAt);
      listener.sampledAt = now;
      const player = players.find(player=>player.id===id);
      if (elapsed>0 && player && present(id) && !player.knockedOut && !this.muted.has(id) && this.channel(id,'wiretap')) {
        access.monitor?.(player,elapsed);
      }
    }
    if (now<this.sampleAt) return;
    this.sampleAt = now+spyRules.sample;
    const ground = access.ground?.() ?? [];
    for (const device of this.occupied.values()) {
      const wasActive = device.until>now;
      if (device.kind==='wiretap') {
        if (players.some(player=>player.id!==device.owner && present(player.id) &&
            (this.lastSound.get(player.id) ?? 0)>now && this.hearing(device,player,barriers)>0)) device.until = now+spyRules.hold;
      } else {
        const origin = this.origin(device,barriers);
        const subjects = players.filter(player=>present(player.id) && cameraSees(origin,player));
        const objects = ground.filter(item=>cameraSees(origin,item));
        const key = JSON.stringify([subjects.map(player=>player.id),objects.map(({id,x,y})=>[id,x,y])]);
        const previous = this.motion.get(device.id);
        if (subjects.some(player=>player.moving) || previous!==key && (subjects.length>0 || objects.length>0 || previous!==undefined)) {
          device.until = now+spyRules.hold;
        }
        this.motion.set(device.id,key);
      }
      const owner = players.find(player=>player.id===device.owner);
      if (!wasActive && device.until>now && owner) access.event?.(owner,'spy-activity',device.site.id);
      if (!wasActive && device.until>now && device.alerts && now>=device.alertAt) {
        device.alertAt = now+12_000;
        access.feedback(device.owner,`${device.kind==='wiretap' ? 'Voz' : 'Movimento'} detectado · ${device.name}`);
      }
    }
  }

  private finish(player:Player,job:Job,now:number,access:Access) {
    const id = player.id;
    const item = access.inventory(id).find(item=>item.id===job.item);
    const device = this.occupied.get(job.site.id);
    if (job.kind==='install') {
      if (!device && (item?.kind==='wiretap' || item?.kind==='spyCamera') &&
          [...this.occupied.values()].filter(device=>device.owner===id && device.kind===item.kind).length<spyRules.limit &&
          access.consume(id,item.id)) {
        const channel = ++this.serial;
        const name = `${item.kind==='wiretap' ? 'Grampo' : 'Câmera'} ${channel}`;
        const installed:Device = {id:channel,kind:item.kind,name,room:job.site.room,site:job.site,owner:id,
          hardware:this.recoveredHardware.get(item.id) ?? {id:item.id,discoveredBy:new Set()},
          active:false,removed:false,alerts:true,until:now,alertAt:now,installedAt:now};
        this.recoveredHardware.delete(item.id);
        this.devices.set(channel,installed);
        this.occupied.set(job.site.id,installed);
        access.event?.(player,'spy-installed',job.site.id,installed);
        access.feedback(id,'Dispositivo instalado.');
      } else {
        access.event?.(player,'spy-install-failed',job.site.id);
        access.feedback(id,'Não foi possível instalar o dispositivo.');
      }
    } else if (job.kind==='inspect') {
      if (item?.kind!=='bugDetector') return;
      if (device) {
        let known = this.discoveries.get(id);
        if (!known) this.discoveries.set(id,known=new Map());
        known.set(job.site.id,device.id);
        if (device.owner!==id && !device.hardware.discoveredBy.has(id)) {
          device.hardware.discoveredBy.add(id);
          access.event?.(player,'spy-discovered',job.site.id,device);
        }
      }
      access.feedback(id,device ? device.kind==='wiretap' ? 'Grampo encontrado.' : 'Câmera escondida encontrada.' : 'Nenhum dispositivo encontrado.');
    } else if (device && device.id===job.target && this.known(id,device)) {
      if (job.kind==='recover') {
        const recovered = access.restore?.(id,device.kind);
        if (!recovered) {
          access.feedback(id,'Inventário cheio.');
          return;
        }
        this.recoveredHardware.set(recovered.id,device.hardware);
      }
      device.removed = true;
      this.occupied.delete(job.site.id);
      this.motion.delete(device.id);
      if (this.selected.get(device.owner)===device.id) this.selected.delete(device.owner);
      if (this.listening.get(device.owner)?.channel===device.id) this.listening.delete(device.owner);
      access.event?.(player,'spy-removed',job.site.id,id!==device.owner ? device : undefined);
      access.feedback(id,job.kind==='recover' ? 'Dispositivo recuperado.' : 'Dispositivo removido.');
      if (id!==device.owner) access.feedback(device.owner,'Dispositivo desconectado.');
    }
  }
}
