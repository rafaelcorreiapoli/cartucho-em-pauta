import {candyWidth,swapCandy} from '../src/candy';
import {cashAmount,hasInventorySpace,occupiesInventorySlot,terminals,type GameplayAction,type GameplayView} from '../src/gameplay';
import {canStand,roomAt,type Motion,type Player} from '../src/map';
import type {Agenda} from '../src/politics';
import {npcs} from '../src/npcs';
import {marketProduct} from '../src/market-catalog';
import {privateOffices} from '../src/private-offices';
import {canReachStation,stations,type PlenaryView} from '../src/plenary';
import type {Gameplay} from './Gameplay';
import type {GameplayWorld} from './gameplay-world';

const publicStops = [
  stations.coffee, stations.archive, stations.library, stations.press,
  terminals.protocol.point, npcs.snackVendor.interaction, stations.audit,
];

export class BotAgenda {
  private visited = new Set<string>();
  private stop?:Motion;
  private leaveAt = 0;
  private cashPlan?:{item:number; pocket:boolean; readyAt:number};
  private attemptedPhotoAt = -Infinity;
  private studiedRound?:number;
  private coffeeAt:number;
  private insuranceAt:number;
  private buyingInsurance = false;

  constructor(private readonly random:()=>number,now:number) {
    this.coffeeAt = now+15_000+Math.floor(random()*60_000);
    this.insuranceAt = now+45_000+Math.floor(random()*45_000);
  }

  tick(player:Player,view:PlenaryView,game:GameplayView,gameplay:Gameplay,world:GameplayWorld,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void,study:()=>void) {
    const {now} = world;
    const has = (...kinds: Agenda[])=>view.politics?.missions.active.some(mission=>kinds.includes(mission.kind)) ?? false;
    this.visited.add(roomAt(player));
    if (this.protectSafe(player,view,game,gameplay,world,go,rest,act)) return;
    if (this.handleCash(player,game,now,has,go,rest,act)) return;

    if (has('visitaArquivo') && roomAt(player)!=='Arquivo') {
      go(stations.archive);
      return;
    }
    if (has('cafe','fiscalCafe') && now>=this.coffeeAt && !game.stationCooldowns?.coffee) {
      if (canReachStation(player,'coffee')) {
        rest();
        gameplay.drinkStationCoffee(player,world);
        this.coffeeAt = now+15_000+Math.floor(this.random()*30_000);
      } else go(stations.coffee);
      return;
    }
    if (has('pizza') && (view.politics?.wallet ?? 0)>=2) {
      const pizza = game.inventory.find(item=>item.kind==='pizza');
      if (pizza) act({kind:'use',item:pizza.id});
      else if (game.dialogue?.npc==='snackVendor' && game.dialogue.shop) {
        act({kind:'shop-buy',target:'pizza',token:game.dialogue.token});
      } else if (game.npcNearby?.includes('snackVendor')) act({kind:'open-shop',target:'snackVendor'});
      else {
        go(npcs.snackVendor.interaction);
        return;
      }
      rest();
      return;
    }
    if (has('selfieSolo','tresSelfies') && now-this.attemptedPhotoAt>=8_000 &&
        (!has('tresSelfies') || this.stop && roomAt(this.stop)===roomAt(player))) {
      this.attemptedPhotoAt = now;
      act({kind:'selfie'});
      return;
    }
    if (has('leitura') && view.project!==undefined && view.mandate && this.studiedRound!==view.round) {
      if (canReachStation(player,'library')) {
        this.studiedRound = view.round;
        study();
      } else go(stations.library);
      return;
    }

    const wantsGame = has('jogar','produtividade');
    if (wantsGame && has('produtividade')) {
      const office = gameplay.officeSpawn(player.id);
      if (office && roomAt(office)!==roomAt(player)) {
        go(office);
        return;
      }
    }
    if (wantsGame) {
      rest();
      act({kind:'phone-open'});
      const candy = game.candy;
      if (candy) {
        for (let from=0;from<candy.board.length;from++) {
          const neighbors = [from+candyWidth];
          if (from%candyWidth<candyWidth-1) neighbors.push(from+1);
          const to = neighbors.find(to=>to<candy.board.length && swapCandy(candy.board,from,to)?.matches.size);
          if (to!==undefined) {
            act({kind:'candy-swap',cells:[from,to],token:candy.id});
            return;
          }
        }
      }
      act({kind:'candy-start'});
      return;
    }
    const phone = gameplay.phoneActivity(player.id);
    if (phone==='open' || phone==='game') act({kind:'phone-close'});

    if (!this.stop || now>=this.leaveAt) {
      const stops = publicStops.filter(point=>roomAt(point)!==roomAt(player) && canStand(point.x,point.y));
      const unvisited = stops.filter(point=>!this.visited.has(roomAt(point)));
      const choices = has('passeio','tresSelfies') && unvisited.length ? unvisited : stops;
      this.stop = choices[Math.floor(this.random()*choices.length)];
      this.leaveAt = now+10_000+Math.floor(this.random()*13_000);
    }
    if (this.stop && Math.hypot(player.x-this.stop.x,player.y-this.stop.y)>8) go(this.stop);
    else rest();
  }

  private protectSafe(player:Player,view:PlenaryView,game:GameplayView,gameplay:Gameplay,world:GameplayWorld,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void) {
    const office = privateOffices.find(layout=>layout.id===game.ownOffice);
    if (!office || gameplay.hasSafeInsurance(player.id)) { this.buyingInsurance = false; return false; }
    const trap = game.inventory.find(item=>item.kind==='safeTrap');
    if (!trap) {
      if (game.inventory.some(item=>cashAmount(item))) return false;
      const price = marketProduct('equipment','safeTrap',world.policies,world.publicBudget)?.price;
      if (price===undefined || (view.politics?.wallet ?? 0)<price || !hasInventorySpace(game.inventory.filter(occupiesInventorySlot).length)) {
        this.buyingInsurance = false;
        return false;
      }
      if (!this.buyingInsurance) {
        if (world.now<this.insuranceAt) return false;
        this.insuranceAt = world.now+45_000+Math.floor(this.random()*45_000);
        if (this.random()>=.4) return false;
        this.buyingInsurance = true;
      }
    }
    const phone = gameplay.phoneActivity(player.id);
    if (phone==='open' || phone==='game') { rest(); act({kind:'phone-close'}); return true; }
    if (trap) {
      this.buyingInsurance = false;
      if (game.dialogue) { rest(); act({kind:'dialogue-close'}); return true; }
      const install = game.officeOptions?.find(option=>option.kind==='office-trap-safe' && option.item===trap.id);
      const openDoor = game.officeOptions?.find(option=>option.place===office.id && option.kind==='office-open');
      if (install || openDoor) { rest(); act((install ?? openDoor)!); }
      else go(office.safe);
    } else if (game.dialogue?.npc==='vendor' && game.dialogue.shop) {
      rest();
      act({kind:'shop-buy',target:'safeTrap',token:game.dialogue.token});
    } else if (game.npcNearby?.includes('vendor')) {
      rest();
      act({kind:'open-shop',target:'vendor'});
    } else go({x:npcs.vendor.x,y:npcs.vendor.y+11});
    return true;
  }

  private handleCash(player:Player,game:GameplayView,now:number,has:(...kinds:Agenda[])=>boolean,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void) {
    const cash = game.inventory.find(item=>cashAmount(item));
    if (!cash) {
      this.cashPlan = undefined;
      const space = hasInventorySpace(game.inventory.filter(occupiesInventorySlot).length);
      const distance = (point:Motion)=>Math.hypot(point.x-player.x,point.y-player.y);
      const closest = game.ground.filter(item=>cashAmount(item.kind) && (space || !occupiesInventorySlot(item))).sort((a,b)=>distance(a)-distance(b))[0];
      if (!closest) return false;
      if (game.nearby.some(item=>item.id===closest.id)) {
        rest();
        act({kind:'collect',item:closest.id});
      } else go(closest);
      return true;
    }

    const office = privateOffices.find(layout=>layout.id===game.ownOffice);
    if (this.cashPlan?.item!==cash.id) {
      const pocketChance = has('embolso','reservaCofre') ? .8 : has('contribuinte','contasTesouraria') ? .2 : .5;
      this.cashPlan = {item:cash.id,pocket:this.random()<pocketChance,readyAt:now+6_000+this.random()*6_000};
    }
    if (office && (this.cashPlan.pocket || has('transporte') && roomAt(player)!==office.name)) {
      const kind = game.officeOptions?.find(option=>option.place===office.id &&
        (option.kind==='office-open' || option.kind==='office-cash' && option.item===cash.id));
      if (kind?.kind==='office-open') {
        rest();
        act(kind);
        return true;
      }
      if (this.cashPlan.pocket) {
        if (kind) {
          rest();
          if (now>=this.cashPlan.readyAt) act(kind);
        } else go(office.safe);
        return true;
      }
      go(office.spawn);
      return true;
    }
    if (game.locations.includes('treasury')) {
      rest();
      if (now>=this.cashPlan.readyAt) act({kind:'deliver',place:'treasury',item:cash.id});
    } else go(terminals.treasury.point);
    return true;
  }

}
