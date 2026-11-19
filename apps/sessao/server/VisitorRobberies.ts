import { canReachObject } from '../src/gameplay';
import type { Player } from '../src/map';
import { npcRules } from '../src/visitors';
import type { GameplayWorld } from './gameplay-world';
import type { Gameplay } from './Gameplay';
import type { Visitors } from './Visitors';

export class VisitorRobberies {
  private robberies = new Map<string,{target:string;until:number;x:number;y:number}>();

  constructor(private members:Visitors,private gameplay:Gameplay) {}

  reset() { this.robberies.clear(); }
  leave(id:string) { this.robberies.delete(id); }
  private target(id:string) { return this.members.players.find(player=>player.id===id); }

  nearby(player:Player) {
    return this.members.players.filter(npc=>canReachObject(player,npc,{radius:npcRules.robberyRange,handsFree:true,clearFloor:true}))
      .map(npc=>({id:npc.id,name:npc.nick,down:!!npc.knockedOut}));
  }

  private available(player:Player,npc:Player|undefined,down:boolean) {
    return npc && !!npc.knockedOut===down && this.nearby(player).some(entry=>entry.id===npc.id);
  }

  act(player:Player,raw:unknown,world:GameplayWorld) {
    if (!raw || typeof raw!=='object' || !('kind' in raw)) return;
    if (raw.kind==='cancel-robbery') {
      if (this.robberies.delete(player.id)) return 'Roubo interrompido.';
      return;
    }
    if (raw.kind!=='rob') return 'Visitantes não negociam votos ou assinaturas.';
    if (this.robberies.has(player.id)) return 'Roubo em andamento.';
    const target = 'target' in raw && typeof raw.target==='string' ? this.target(raw.target) : undefined;
    if (!target) return 'Visitante indisponível.';
    if (raw.kind==='rob') {
      if (!this.available(player,target,true)) return 'Aproxime-se do visitante nocauteado.';
      this.robberies.set(player.id,{target:target.id,until:world.now+npcRules.robberyMs,x:player.x,y:player.y});
      return;
    }
  }

  tick(world:GameplayWorld,exploring:boolean) {
    if (!exploring) { this.reset(); return; }
    for (const [id,robbery] of this.robberies) {
      const player = world.players.find(actor=>actor.id===id);
      const target = this.target(robbery.target);
      if (!player || !target || player.x!==robbery.x || player.y!==robbery.y || !this.available(player,target,true)) {
        this.robberies.delete(id);
        world.feedback?.(id,'Roubo interrompido.');
      } else if (world.now>=robbery.until) {
        this.robberies.delete(id);
        const result = this.gameplay.robNpc(player,target,world);
        if (result.startsWith('Maleta roubada')) this.members.departWhenRecovered(target.id);
        world.feedback?.(id,result);
      }
    }
  }

  robberyTarget(id:string) {
    const robbery = this.robberies.get(id);
    const target = robbery && this.target(robbery.target);
    return target ? {x:target.x,y:target.y,direction:target.direction} : undefined;
  }

  robberyProgress(id:string,now:number) {
    const robbery = this.robberies.get(id);
    return robbery ? Math.max(0,npcRules.robberyMs-(robbery.until-now)) : undefined;
  }
}
