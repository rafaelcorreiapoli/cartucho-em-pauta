import { weapons, type WeaponKind } from '../src/weapons';
import { characterStats } from '../src/character-stats';
import { canReachObject } from '../src/gameplay';
import { aidRadius } from '../src/medical';
import { type Player } from '../src/map';

const recoveryTime = 8_000;
const recoveryShield = 4_000;
type Combatant = Pick<Player,'id'|'character'|'x'|'y'|'hit'|'knockedOut'|'carrying'|'swing'>;

type Vitality = {hp:number; recoverAt:number; protectedUntil:number; attackAt:number};

export class Combat {
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

  private max(player:Combatant) { return characterStats[player.character].hp; }

  private state(player:Combatant) {
    let state = this.vitality.get(player.id);
    if (!state) this.vitality.set(player.id,state={hp:this.max(player),recoverAt:0,protectedUntil:0,attackAt:0});
    return state;
  }

  private recover(player:Combatant, state:Vitality, now:number) {
    state.hp = Math.ceil(this.max(player)*.45);
    state.protectedUntil = now+recoveryShield;
    state.recoverAt = 0;
    player.knockedOut = undefined;
  }

  tick<T extends Combatant>(players:T[], now:number, exploring:boolean, recovered?:(player:T)=>void) {
    for (const player of players) {
      if (player.swing && (!exploring || now>=player.swing.startedAt+weapons[player.swing.weapon].swingMs)) player.swing = undefined;
      if (player.hit!==undefined && player.hit<=now) player.hit = undefined;
      const state = this.vitality.get(player.id);
      if (state?.recoverAt && (!exploring || state.recoverAt<=now)) {
        this.recover(player,state,now);
        recovered?.(player);
      }
    }
  }

  attack(attacker:Combatant, target:Combatant|undefined, armor:boolean, now:number, weapon:WeaponKind = 'baton') {
    const profile = weapons[weapon];
    if (!target || target===attacker || !canReachObject(attacker,target,{radius:profile.reach,clearFloor:true,handsFree:true})) return {error:'Aproxime-se do alvo.'};
    const source = this.state(attacker);
    const victim = this.state(target);
    if (source.recoverAt || victim.recoverAt || victim.protectedUntil>now) return {error:'Alvo indisponível.'};
    if (source.attackAt>now) return {error:'O porrete está em recarga.'};
    source.attackAt = now+profile.cooldown;
    attacker.swing = {weapon,startedAt:now,angle:Math.atan2(target.y-attacker.y,target.x-attacker.x)};
    const base = characterStats[attacker.character].attack;
    const damage = Math.round((profile.damage+base*profile.strengthScale)*(armor ? .65 : 1));
    victim.hp = Math.max(0,victim.hp-damage);
    target.hit = now+250;
    if (!victim.hp) {
      victim.recoverAt = now+recoveryTime;
      target.knockedOut = true;
      target.swing = undefined;
    }
    return {damage};
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
