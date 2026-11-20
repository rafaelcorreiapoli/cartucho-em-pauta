import { equipment } from '../src/equipment';
import { canSwingWeapon, weaponImpactSegment, weapons, type WeaponKind, type WeaponSwing } from '../src/weapons';
import { characterStats } from '../src/character-stats';
import { MAX_STAMINA } from '../src/movement';
import { canReachDownedPlayer } from '../src/interactions';
import { recoveryRules } from '../src/medical';
import { obstacleBetween, segmentIntersects, type Player } from '../src/map';

type Combatant = {direction?:number} & Pick<Player,'id'|'character'|'x'|'y'|'hit'|'recoveryProtected'|'knockedOut'|'carrying'|'swing'|'stamina'|'staminaMax'>;

type Vitality = {hp:number; recoverAt:number; protectedUntil:number; attackAt:number; pending:boolean; knockedOutBy?:string};

export class Combat {
  private static readonly facingAngles = [Math.PI/2,0,-Math.PI/2,Math.PI];
  private vitality = new Map<string,Vitality>();

  reset(players:Combatant[]) {
    this.vitality.clear();
    for (const player of players) {
      player.knockedOut = undefined;
      player.hit = undefined;
      player.recoveryProtected = undefined;
      player.swing = undefined;
    }
  }

  leave(player:Combatant) {
    this.vitality.delete(player.id);
    player.recoveryProtected = undefined;
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
    state.hp = Math.ceil(this.max(player)*recoveryRules.healthFraction);
    state.protectedUntil = now+recoveryRules.protectionMs;
    player.recoveryProtected = true;
    state.recoverAt = 0;
    state.knockedOutBy = undefined;
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
      if (player.recoveryProtected && (state?.protectedUntil ?? 0)<=now) player.recoveryProtected = undefined;
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
        const target = callbacks.canHit?.(player)===false ? undefined : this.findTarget(player,swing,players,now,callbacks.canHit);
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
    const stamina = attacker.stamina ?? attacker.staminaMax ?? MAX_STAMINA;
    if (!canSwingWeapon(stamina,weapon)) return 'Stamina insuficiente para atacar.';
    attacker.stamina = stamina-weapons[weapon].staminaCost;
    state.attackAt = now+weapons[weapon].swingMs;
    state.pending = true;
    attacker.swing = {weapon,startedAt:now,angle:Combat.facingAngles[attacker.direction ?? 0]};
  }

  private findTarget<T extends Combatant>(attacker:T, swing:WeaponSwing, players:T[], now:number, canHit?:(player:T)=>boolean) {
    if (attacker.knockedOut || attacker.carrying) return;
    const {hitRadius} = weapons[swing.weapon];
    const {handle,tip} = weaponImpactSegment(swing);
    const facingX = Math.cos(swing.angle);
    const facingY = Math.sin(swing.angle);
    let nearest: T | undefined;
    let nearestDistance = Infinity;
    for (const candidate of players) {
      if (candidate===attacker || candidate.knockedOut || canHit?.(candidate)===false) continue;
      const x = candidate.x-attacker.x;
      const y = candidate.y-attacker.y;
      const distance = Math.hypot(x,y);
      if (distance>=nearestDistance || x*facingX+y*facingY<0 ||
          (this.vitality.get(candidate.id)?.protectedUntil ?? 0)>now) continue;

      // Player positions are at their feet. The weapon crosses the visible torso above them.
      if (!segmentIntersects(handle,tip,[x-7-hitRadius,y-30-hitRadius,14+hitRadius*2,27+hitRadius*2]) ||
          obstacleBetween(attacker,candidate)) continue;
      nearest = candidate;
      nearestDistance = distance;
    }
    return nearest;
  }

  private damage(attacker:Combatant, target:Combatant, armor:boolean, now:number, weapon:WeaponKind) {
    const profile = weapons[weapon];
    const base = characterStats[attacker.character].attack;
    const strike = (profile.damage+base*profile.strengthScale)*(armor ? 1-equipment.vest.damageReduction : 1);
    const damage = Math.max(1,Math.round(strike));
    const victim = this.state(target);
    victim.hp = Math.max(0,victim.hp-damage);
    target.hit = now+recoveryRules.hitStunMs;
    if (!victim.hp) this.knockOut(target,now,attacker.id);
    return damage;
  }

  knockOut(target:Combatant,now:number,by?:string) {
    const victim = this.state(target);
    victim.hp = 0;
    victim.knockedOutBy = by;
    victim.protectedUntil = 0;
    victim.recoverAt = now+recoveryRules.knockoutMs;
    target.recoveryProtected = undefined;
    target.knockedOut = true;
    target.hit = now+recoveryRules.hitStunMs;
    this.interrupt(target);
  }

  knockedOutBy(target:Combatant) { return this.vitality.get(target.id)?.knockedOutBy; }

  aid(actor:Combatant, target:Combatant|undefined, now:number) {
    if (!target || !canReachDownedPlayer(actor,target)) return false;
    this.recover(target,this.state(target),now);
    return true;
  }

  treat(player:Combatant, now:number) {
    const state = this.state(player);
    if (state.recoverAt) this.recover(player,state,now);
    this.heal(player,'full');
  }

  heal(player:Combatant, amount:number|'full') {
    const state = this.state(player);
    state.hp = amount==='full' ? this.max(player) : Math.min(this.max(player),state.hp+amount);
  }

  weaponRecharge(player:Combatant, now:number) {
    const readyAt = this.vitality.get(player.id)?.attackAt ?? now;
    return Math.max(0,Math.ceil((readyAt-now)/100)/10);
  }

  view(player:Combatant, now:number) {
    const state = this.vitality.get(player.id);
    return {hp:state?.hp ?? this.max(player),max:this.max(player),
      recovery:Math.max(0,Math.ceil(((state?.recoverAt ?? 0)-now)/1000))};
  }
}
