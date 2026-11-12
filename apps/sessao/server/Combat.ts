import { weapons, type WeaponKind } from '../src/weapons';
import { characterStats } from '../src/character-stats';
import { canReachObject } from '../src/gameplay';
import { aidRadius } from '../src/medical';
import { type Player } from '../src/map';

const recoveryTime = 8_000;
const recoveryShield = 4_000;
type Combatant = {direction?:number} & Pick<Player,'id'|'character'|'x'|'y'|'hit'|'knockedOut'|'carrying'|'swing'>;

type Vitality = {hp:number; recoverAt:number; protectedUntil:number; attackAt:number; pending:boolean};

export class Combat {
  private static readonly facingAngles = [Math.PI/2,0,-Math.PI/2,Math.PI];
  private vitality = new Map<string,Vitality>();

  reset(players:Combatant[]) {
    this.vitality.clear();
    for (const player of players) {
      player.knockedOut = undefined;
      player.hit = undefined;
      player.swing = undefined;
    }
  }

  leave(player:Combatant) {
    this.vitality.delete(player.id);
    player.knockedOut = undefined;
    player.hit = undefined;
    player.swing = undefined;
  }

  interrupt(player:Combatant) {
    const state = this.vitality.get(player.id);
    if (state) state.pending = false;
    player.swing = undefined;
  }

  private max(player:Combatant) { return characterStats[player.character].hp; }

  private state(player:Combatant) {
    let state = this.vitality.get(player.id);
    if (!state) this.vitality.set(player.id,state={hp:this.max(player),recoverAt:0,protectedUntil:0,attackAt:0,pending:false});
    return state;
  }

  private recover(player:Combatant, state:Vitality, now:number) {
    state.hp = Math.ceil(this.max(player)*.45);
    state.protectedUntil = now+recoveryShield;
    state.recoverAt = 0;
    player.knockedOut = undefined;
  }

  tick<T extends Combatant>(players:T[], now:number, exploring:boolean, callbacks:{
    recovered?:(player:T)=>void;
    canHit?:(player:T)=>boolean;
    armored?:(player:T)=>boolean;
    hit?:(attacker:T,target:T,damage:number)=>void;
  } = {}) {
    for (const player of players) {
      if (player.hit!==undefined && player.hit<=now) player.hit = undefined;
      const state = this.vitality.get(player.id);
      if (state?.recoverAt && (!exploring || state.recoverAt<=now)) {
        this.recover(player,state,now);
        callbacks.recovered?.(player);
      }
    }
    for (const player of players) {
      const swing = player.swing;
      if (!swing) continue;
      const state = this.state(player);
      const profile = weapons[swing.weapon];
      const elapsed = now-swing.startedAt;
      if (exploring && state.pending && elapsed>=profile.impactMs) {
        state.pending = false;
        const target = callbacks.canHit?.(player)===false ? undefined : this.findTarget(player,players,now,callbacks.canHit);
        if (target) {
          const damage = this.damage(player,target,callbacks.armored?.(target) ?? false,now,swing.weapon);
          callbacks.hit?.(player,target,damage);
        }
      }
      if (!exploring || elapsed>=profile.swingMs) {
        player.swing = undefined;
        state.pending = false;
      }
    }
  }

  attack(attacker:Combatant, now:number, weapon:WeaponKind = 'baton') {
    const state = this.state(attacker);
    if (attacker.knockedOut || attacker.carrying) return 'Ataque indisponível.';
    if (state.attackAt>now) return 'A arma está em recarga.';
    state.attackAt = now+weapons[weapon].cooldown;
    state.pending = true;
    attacker.swing = {weapon,startedAt:now,angle:Combat.facingAngles[attacker.direction ?? 0]};
  }

  private findTarget<T extends Combatant>(attacker:T, players:T[], now:number, canHit?:(player:T)=>boolean) {
    const {weapon,angle} = attacker.swing!;
    const {reach,arc} = weapons[weapon];
    const facingX = Math.cos(angle);
    const facingY = Math.sin(angle);
    const minimumDot = Math.cos(arc/2);
    let nearest: T | undefined;
    let nearestDistance = Infinity;
    for (const candidate of players) {
      if (candidate===attacker || candidate.knockedOut || canHit?.(candidate)===false) continue;
      const x = candidate.x-attacker.x;
      const y = candidate.y-attacker.y;
      const distance = Math.hypot(x,y);
      if (distance>=nearestDistance || x*facingX+y*facingY<distance*minimumDot ||
          !canReachObject(attacker,candidate,{radius:reach,clearFloor:true,handsFree:true}) ||
          (this.vitality.get(candidate.id)?.protectedUntil ?? 0)>now) continue;
      nearest = candidate;
      nearestDistance = distance;
    }
    return nearest;
  }

  private damage(attacker:Combatant, target:Combatant, armor:boolean, now:number, weapon:WeaponKind) {
    const profile = weapons[weapon];
    const base = characterStats[attacker.character].attack;
    const damage = Math.round((profile.damage+base*profile.strengthScale)*(armor ? .65 : 1));
    const victim = this.state(target);
    victim.hp = Math.max(0,victim.hp-damage);
    target.hit = now+250;
    if (!victim.hp) {
      victim.recoverAt = now+recoveryTime;
      target.knockedOut = true;
      this.interrupt(target);
    }
    return damage;
  }

  aid(actor:Combatant, target:Combatant|undefined, now:number) {
    if (!target || target===actor || !canReachObject(actor,target,{radius:aidRadius,clearFloor:true,handsFree:true}) || !target.knockedOut) return false;
    this.recover(target,this.state(target),now);
    return true;
  }

  treat(player:Combatant, amount:number, now:number) {
    const state = this.state(player);
    if (state.recoverAt) this.recover(player,state,now);
    state.hp = Math.min(this.max(player),state.hp+amount);
  }

  view(player:Combatant, now:number) {
    const state = this.vitality.get(player.id);
    return {hp:state?.hp ?? this.max(player),max:this.max(player),
      recovery:Math.max(0,Math.ceil(((state?.recoverAt ?? 0)-now)/1000))};
  }
}
