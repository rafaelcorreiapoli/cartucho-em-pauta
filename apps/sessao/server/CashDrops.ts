import { canPocket, cashItems, type CashDrop } from '../src/cash-drops';
import { canStand, HEIGHT, localPerception, WIDTH, type Motion } from '../src/map';
import { findRoute } from '../src/navigation';

const kinds = Object.keys(cashItems) as CashDrop['kind'][];
const mapEntrance = {x:140,y:146};

export class CashDrops {
  private drops = new Map<number,{drop:CashDrop; expires:number}>();
  private random = Math.random;
  private nextSpawn = Infinity;
  private serial = 0;

  reset(now:number, random:()=>number) {
    this.drops.clear();
    this.random = random;
    this.nextSpawn = now+4000+random()*8000;
  }

  advance(now:number) {
    for (const [id,{expires}] of this.drops) {
      if (expires<=now) this.drops.delete(id);
    }
    if (now<this.nextSpawn) return;
    this.nextSpawn = now+8000+this.random()*10000;
    if (this.drops.size>=8) return;

    for (let attempt=0;attempt<16;attempt++) {
      const x = 24+Math.floor(this.random()*(WIDTH-48));
      const y = 24+Math.floor(this.random()*(HEIGHT-48));
      if (!canStand(x,y) || !canStand(x-8,y+6) || !canStand(x+8,y+6) ||
        [...this.drops.values()].some(({drop}) => Math.hypot(x-drop.x,y-drop.y)<36)) continue;
      const last = findRoute(mapEntrance,{x,y}).at(-1);
      if (last?.x!==x || last.y!==y) continue;
      const kind = kinds[Math.floor(this.random()*kinds.length)];
      const drop = {id:++this.serial,kind,x,y};
      this.drops.set(drop.id,{drop,expires:now+55000});
      break;
    }
  }

  visibleTo(player:Motion, now:number) {
    return [...this.drops.values()].filter(({drop,expires}) => expires>now && localPerception(player,drop).visible)
      .map(({drop}) => drop);
  }

  take(id:number, player:Motion, now:number) {
    const item = this.drops.get(id);
    if (!item || item.expires<=now || !canPocket(player,item.drop)) return;
    this.drops.delete(id);
    return item.drop;
  }

  pocket(id:number, player:Motion, now:number) {
    const drop = this.take(id,player,now);
    return drop && cashItems[drop.kind].amount;
  }
}
