import { canReachObject } from '../src/gameplay';
import { blockedBy, canStand, localPerception, type Motion, type Player } from '../src/map';
import { officeDoorPoint, officeRules, privateOffices, type OfficeAction, type OfficeLayout, type OfficeView } from '../src/private-offices';

type Target = 'door'|'cabinet'|'safe';
type OfficeState = {layout:OfficeLayout; owner?:string; nick?:string; door:'open'|'closed'|'locked'; doorLevel:number; cabinetLevel:number; safeLevel:number;
  doorUntil:number; cabinetUntil:number; safeTrap?:number; doorBreachedBy?:string; cabinetBreachedBy?:string};
export type Channel = {kind:'office-cash'|'office-breach-safe'|'office-breach-door'|'office-breach-cabinet'|'office-upgrade-door'|'office-upgrade-cabinet'|'office-upgrade-safe'; office:OfficeState; item:number;
  started:number; ends:number; baseDuration:number; origin:Motion; level:number};

export class PrivateOffices {
  readonly offices = new Map<string,OfficeState>();
  readonly channels = new Map<string,Channel>();

  reset(players:Player[], random:()=>number) {
    this.offices.clear();
    this.channels.clear();
    const available = [...privateOffices];
    for (const layout of privateOffices) this.offices.set(layout.id,{layout,door:'open',doorLevel:1,cabinetLevel:1,safeLevel:1,doorUntil:0,cabinetUntil:0});
    for (const player of players) {
      const [layout] = available.splice(Math.floor(random()*available.length),1);
      if (!layout) break;
      Object.assign(this.offices.get(layout.id)!,{owner:player.id,nick:player.nick});
    }
  }

  ownedBy(id:string) {
    return [...this.offices.values()].find(office=>office.owner===id)?.layout;
  }

  spawnFor(id:string) {
    const layout = this.ownedBy(id);
    if (layout) {
      const {x,y} = layout.inside;
      const direction = x===1 ? 3 : x===-1 ? 1 : y===1 ? 2 : 0;
      return {...layout.spawn,direction};
    }
  }

  doors(now:number) {
    return [...this.offices.values()].filter(office=>office.door!=='open' && office.doorUntil<=now).map(office=>office.layout.door);
  }

  view(now:number,player:Player,visible=(point:Motion)=>localPerception(player,point).visible):OfficeView[] {
    return [...this.offices.values()].map(({layout,nick,door,doorUntil,cabinetUntil})=>({
      id:layout.id,owner:nick,door:doorUntil>now ? 'breached' : door,cabinetBreached:cabinetUntil>now && visible(layout.cabinet) ? true : undefined,
    }));
  }

  near(player:Player, office:OfficeState, target:'door'|'cabinet'|'safe'|Motion) {
    if (typeof target==='object') return this.inside(player,office.layout) && canReachObject(player,target,{radius:19});
    if (target!=='door') return this.inside(player,office.layout) && canReachObject(player,office.layout[target],{radius:17});
    const point = officeDoorPoint(office.layout);
    return canReachObject({...player,barriers:player.barriers?.filter(rect=>rect!==office.layout.door)},point,{radius:22});
  }

  private inside({x,y}:Motion,{bounds:[left,top,width,height]}:OfficeLayout) {
    return x>=left && x<=left+width && y>=top && y<=top+height;
  }

  stashAccess(player:Player, office:OfficeState, now:number) {
    return this.near(player,office,'cabinet') && (office.owner===player.id || office.cabinetUntil>now);
  }

  doorAction(player:Player, office:OfficeState, kind:OfficeAction, now:number, reject = (message:string)=>message) {
    if (!this.near(player,office,'door')) return reject('Aproxime-se da porta.');
    const inside = this.inside(player,office.layout);
    if (office.doorUntil>now) return reject('A porta está arrombada.');
    if (kind==='office-open' && office.door==='locked' && player.id!==office.owner) {
      if (!inside) return reject('Porta trancada.');
      const exit = officeDoorPoint(office.layout,-15);
      if (!canStand(exit.x,exit.y)) return reject('Saída obstruída.');
      Object.assign(player,exit,{moving:false});
      return 'Você saiu do gabinete.';
    }
    if (kind==='office-open') {
      office.door = 'open';
      return 'Porta aberta.';
    }
    if (office.owner!==player.id) return reject('Somente o titular pode controlar a porta.');
    if (kind==='office-close') office.door = 'closed';
    if (kind==='office-lock') office.door = 'locked';
    if (kind==='office-unlock') office.door = 'closed';
    return {open:'Porta aberta.',closed:'Porta fechada e destrancada.',locked:'Porta trancada.'}[office.door];
  }

  breachTime(office:OfficeState,target:Target,attack:number,now:number) {
    if (!office.owner || (target==='door' ? office.door!=='locked' || office.doorUntil>now : target==='cabinet' && office.cabinetUntil>now)) return;
    const difference = attack-(target==='door' ? office.doorLevel : target==='cabinet' ? office.cabinetLevel : office.safeLevel);
    if (difference>=0) return officeRules.breachTimes[Math.min(2,difference)];
  }

  breachDoor(id:string,now:number,actor:string) {
    const office = this.offices.get(id);
    if (!office) return;
    office.doorUntil = now+officeRules.breachMs;
    office.doorBreachedBy = actor;
  }

  expireDoors(players:Player[],now:number) {
    for (const office of this.offices.values()) {
      if (!office.doorUntil || office.doorUntil>now) continue;
      office.doorUntil = 0;
      for (const player of players) {
        if (blockedBy(office.layout.door,player.x,player.y)) {
          Object.assign(player,officeDoorPoint(office.layout,15),{moving:false});
        }
      }
    }
  }

  isInside(player:Player,office:OfficeState) { return this.inside(player,office.layout); }
}
