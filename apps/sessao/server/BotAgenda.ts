import {candyWidth,swapCandy} from '../src/candy';
import {cashAmount,hasInventorySpace,terminals,type GameplayAction,type GameplayView} from '../src/gameplay';
import {canStand,roomAt,type Motion,type Player} from '../src/map';
import type {Agenda} from '../src/politics';
import {npcs} from '../src/npcs';
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
  private cashSince?:number;
  private attemptedPhotoAt = -Infinity;
  private studiedRound?:number;
  private coffeeAt:number;
  private phoneOpen = false;

  constructor(private readonly random:()=>number,now:number) {
    this.coffeeAt = now+15_000+Math.floor(random()*60_000);
  }

  tick(player:Player,view:PlenaryView,game:GameplayView,gameplay:Gameplay,world:GameplayWorld,
    go:(point:Motion)=>void,rest:()=>void,act:(action:GameplayAction)=>void,study:()=>void) {
    const {now} = world;
    const has = (...kinds: Agenda[])=>view.politics?.missions.active.some(mission=>kinds.includes(mission.kind));
    this.visited.add(roomAt(player));
    const cash = game.inventory.find(item=>cashAmount(item));
    if (cash) this.cashSince ??= now;
    else this.cashSince = undefined;

    if (cash && has('transporte')) {
      const office = gameplay.officeSpawn(player.id);
      if (office && roomAt(office)!==roomAt(player)) {
        go(office);
        return;
      }
    }
    if (cash && now-(this.cashSince ?? now)>=15_000) {
      if (game.locations.includes('treasury')) act({kind:'deliver',place:'treasury',item:cash.id});
      else go(terminals.treasury.point);
      return;
    }
    const visibleCash = !cash && hasInventorySpace(game.inventory.length+ (game.equipped?.length ?? 0)) && game.ground.find(item=>cashAmount(item.kind));
    if (visibleCash && (has('transporte','contribuinte','contasTesouraria') || this.leaveAt<=now)) {
      if (game.nearby.some(item=>item.id===visibleCash.id)) act({kind:'collect',item:visibleCash.id});
      else go(visibleCash);
      return;
    }

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
      this.phoneOpen = true;
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
    if (this.phoneOpen) {
      act({kind:'phone-close'});
      this.phoneOpen = false;
    }

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
}
