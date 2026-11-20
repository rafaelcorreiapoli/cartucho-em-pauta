import {hasInventorySpace,occupiesInventorySlot,type GameplayAction,type GameplayView} from '../src/gameplay';
import {obstacleBetween,type Motion,type Player} from '../src/map';
import {marketProduct} from '../src/market-catalog';
import {npcs} from '../src/npcs';
import type {GameplayWorld} from './gameplay-world';

export class BotAggression {
  private next:number;
  private plan?:{kind:'buy';until:number}|{kind:'attack';until:number;target:string;lastSeen:Motion};
  constructor(private random:()=>number,now:number) { this.next = now+30_000+random()*30_000; }
  tick(player:Player,game:GameplayView,visible:Player[],world:GameplayWorld,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void) {
    const {now} = world;
    const baton = [...game.inventory,...(game.equipped ?? [])].find(item=>item.kind==='baton');
    const price = marketProduct('equipment','baton',world.policies,world.publicBudget)?.price;
    const canBuy = price!==undefined && (world.wallet?.(player.id) ?? 0)>=price && hasInventorySpace(game.inventory.filter(occupiesInventorySlot).length);
    const eligible = (peer:Player)=>peer.id!==player.id && !peer.npc && !peer.knockedOut && !peer.carried && !peer.recoveryProtected && world.present?.(peer.id)!==false && world.hasMandate?.(peer.id)!==false;
    if (this.plan && now>=this.plan.until) { this.finish(now); rest(); return false; }
    if (!this.plan) {
      if (now<this.next) return false;
      this.next = now+30_000+this.random()*30_000;
      if (this.random()>=.35) return false;
      if (!baton) {
        if (!canBuy) return false;
        this.plan = {kind:'buy',until:now+30_000};
      } else {
        const nearby = visible.filter(peer=>eligible(peer) && Math.hypot(peer.x-player.x,peer.y-player.y)<=80);
        if (!nearby.length) return false;
        const target = nearby[Math.floor(this.random()*nearby.length)];
        this.plan = {kind:'attack',until:now+30_000,target:target.id,lastSeen:{x:target.x,y:target.y}};
      }
    }
    if (this.plan.kind==='buy') {
      if (baton || !canBuy) { this.finish(now); rest(); return false; }
      if (game.dialogue?.npc==='vendor' && game.dialogue.shop) { rest(); act({kind:'shop-buy',target:'baton',token:game.dialogue.token}); }
      else if (game.npcNearby?.includes('vendor')) { rest(); act({kind:'open-shop',target:'vendor'}); }
      else go({x:npcs.vendor.x,y:npcs.vendor.y+11});
      return true;
    }
    const targetId = this.plan.target;
    const target = world.players.find(peer=>peer.id===targetId);
    if (!baton || !target || !eligible(target)) { this.finish(now); rest(); return false; }
    if (game.dialogue) { rest(); act({kind:'dialogue-close'}); }
    else if (!game.equipped?.some(item=>item.id===baton.id)) { rest(); act({kind:'equip',item:baton.id}); }
    else if (!visible.some(peer=>peer.id===targetId)) {
      // Search the last visible position without tracking through walls or darkness.
      if (Math.hypot(player.x-this.plan.lastSeen.x,player.y-this.plan.lastSeen.y)>3) go(this.plan.lastSeen);
      else rest();
    }
    else if (Math.hypot(target.x-player.x,target.y-player.y)>24 || obstacleBetween(player,target)) {
      this.plan.lastSeen = {x:target.x,y:target.y};
      go(this.plan.lastSeen);
    }
    else {
      rest();
      const dx = target.x-player.x,dy = target.y-player.y;
      player.direction = Math.abs(dx)>Math.abs(dy) ? dx>0 ? 1 : 3 : dy>0 ? 0 : 2;
      act({kind:'attack'});
    }
    return true;
  }
  private finish(now:number) {
    this.plan = undefined;
    this.next = now+45_000+this.random()*45_000;
  }
}
