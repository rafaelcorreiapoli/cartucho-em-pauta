import { characterStats } from '../src/character-stats';
import { canReachObject } from '../src/gameplay';
import { aidRadius } from '../src/medical';
import { obstacleBetween, type Player } from '../src/map';

const recoveryTime = 8_000;
const recoveryShield = 4_000;
const attackCooldown = 1_250;


type Vitality = {hp:number; recoverAt:number; protectedUntil:number; attackAt:number};

export class Combat {
  private vitality = new Map<string,Vitality>();

  reset(players:Player[]) {
    this.vitality.clear();
    for (const player of players) {
      player.knockedOut = undefined;
      player.hit = undefined;
    }
  }

  leave(player:Player) {
    this.vitality.delete(player.id);
    player.knockedOut = undefined;
    player.hit = undefined;
  }

  private max(player:Player) { return characterStats[player.character].hp; }

  private state(player:Player) {
    let state = this.vitality.get(player.id);
    if (!state) this.vitality.set(player.id,state={hp:this.max(player),recoverAt:0,protectedUntil:0,attackAt:0});
    return state;
  }

  private recover(player:Player, state:Vitality, now:number) {
    state.hp = Math.ceil(this.max(player)*.45);
    state.protectedUntil = now+recoveryShield;
    state.recoverAt = 0;
    player.knockedOut = undefined;
  }

  tick(players:Player[], now:number, exploring:boolean, recovered?:(player:Player)=>void) {
    for (const player of players) {
      if (player.hit!==undefined && player.hit<=now) player.hit = undefined;
      const state = this.vitality.get(player.id);
      if (state?.recoverAt && (!exploring || state.recoverAt<=now)) {
        this.recover(player,state,now);
        recovered?.(player);
      }
    }
  }

  attack(attacker:Player, target:Player|undefined, armor:boolean, now:number) {
    if (!target || target===attacker || (!canReachObject(attacker,target) || obstacleBetween(attacker,target))) return {error:'Aproxime-se do alvo.'};
    const source = this.state(attacker);
    const victim = this.state(target);
    if (source.recoverAt || victim.recoverAt || victim.protectedUntil>now) return {error:'Alvo indisponível.'};
    if (source.attackAt>now) return {error:'O porrete está em recarga.'};
    source.attackAt = now+attackCooldown;
    const base = characterStats[attacker.character].attack;
    const damage = Math.round((12+base*.28)*(armor ? .65 : 1));
    victim.hp = Math.max(0,victim.hp-damage);
    target.hit = now+250;
    if (!victim.hp) {
      victim.recoverAt = now+recoveryTime;
      target.knockedOut = true;
    }
    return {damage};
  }

  aid(actor:Player, target:Player|undefined, now:number) {
    if (!target || target===actor || actor.knockedOut || Math.hypot(actor.x-target.x,actor.y-target.y)>aidRadius ||
        !canReachObject(actor,target) || obstacleBetween(actor,target) || !target.knockedOut) return false;
    this.recover(target,this.state(target),now);
    return true;
  }

  treat(player:Player, amount:number, now:number) {
    const state = this.state(player);
    if (state.recoverAt) this.recover(player,state,now);
    state.hp = Math.min(this.max(player),state.hp+amount);
  }

  view(player:Player, now:number) {
    const state = this.vitality.get(player.id);
    return {hp:state?.hp ?? this.max(player),max:this.max(player),
      recovery:Math.max(0,Math.ceil(((state?.recoverAt ?? 0)-now)/1000))};
  }
}
