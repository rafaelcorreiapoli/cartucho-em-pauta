import { canReachObject } from '../src/gameplay';
import { canStand, type Player } from '../src/map';
import { clearSegment } from '../src/navigation';
import { aidRadius } from '../src/medical';
import { publishGameplay, type GameplayWorld } from './gameplay-world';

type Pair = {carrier:Player; passenger:Player};

export class Transport {
  private pairs = new Map<string,Pair>();

  passenger(carrier:Player) { return this.pairs.get(carrier.id)?.passenger; }

  carry(carrier:Player, passenger:Player|undefined, world:GameplayWorld) {
    if (!passenger || passenger===carrier || carrier.carrying || carrier.knockedOut ||
        !passenger.knockedOut || passenger.carried || world.present?.(passenger.id)===false ||
        !canReachObject(carrier,passenger,{radius:aidRadius,clearFloor:true,handsFree:true}) || !canStand(carrier.x,carrier.y)) return false;
    const pair = {carrier,passenger};
    this.pairs.set(carrier.id,pair);
    carrier.carrying = true;
    carrier.sprinting = undefined;
    passenger.carried = true;
    this.follow(pair);
    publishGameplay(world,carrier,'character-carried',{target:passenger.id});
    return true;
  }

  drop(carrier:Player, world:GameplayWorld) {
    const pair = this.pairs.get(carrier.id);
    if (!pair) return false;
    this.release(pair,world);
    return true;
  }

  detach(player:Player, world:GameplayWorld) {
    if (this.drop(player,world)) return;
    const pair = [...this.pairs.values()].find(({passenger})=>passenger===player);
    if (pair) this.release(pair,world);
  }

  reset() {
    for (const {carrier,passenger} of this.pairs.values()) {
      carrier.carrying = undefined;
      passenger.carried = undefined;
    }
    this.pairs.clear();
  }

  tick(world:GameplayWorld, exploring:boolean) {
    for (const pair of this.pairs.values()) {
      if (!exploring || pair.carrier.knockedOut || !pair.passenger.knockedOut) this.release(pair,world);
      else this.follow(pair);
    }
  }

  private follow({carrier,passenger}:Pair) {
    passenger.x = carrier.x;
    passenger.y = carrier.y;
    passenger.direction = carrier.direction;
    passenger.moving = false;
    passenger.sprinting = undefined;
  }

  private release({carrier,passenger}:Pair, world:GameplayWorld) {
    this.pairs.delete(carrier.id);
    carrier.carrying = undefined;
    passenger.carried = undefined;
    // The last synchronized position is walkable. Try adjacent floor for clear separation.
    const around = [[0,10],[10,0],[-10,0],[0,-10]];
    const point = around.map(([x,y])=>({x:passenger.x+x,y:passenger.y+y}))
      .find(candidate=>clearSegment(passenger,candidate,canStand));
    if (point) Object.assign(passenger,point);
    publishGameplay(world,carrier,'character-dropped',{target:passenger.id});
  }
}
