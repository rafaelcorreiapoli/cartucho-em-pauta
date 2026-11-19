import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './classic-room-fixture';
import type {Player} from '../src/map';
import type {Gameplay} from '../server/Gameplay';
import type {PlenaryMatch} from '../server/PlenaryMatch';
import type {GameplayWorld} from '../server/gameplay-world';
import {MIN_PLAYERS} from '../src/plenary';

let active:VisitorsRoom|undefined;
class VisitorsRoom extends SessionRoom {
  onCreate() {
    super.onCreate(); active = this;
    Reflect.set(Reflect.get(this,'match'),'minimumPlayers',MIN_PLAYERS);
    // Keep the browser combat scenario deterministic; the bot behavior has its own tests.
    Reflect.get(this,'bots').tick = ()=>{};
    let prepared = false;
    this.clock.setInterval(()=>{
      const match:PlenaryMatch = Reflect.get(this,'match');
      if (prepared || match.phase!=='negotiation') return;
      const world:GameplayWorld = Reflect.get(this,'gameplayWorld').call(this);
      const host = world.players.find(player=>!player.npc && !player.bot);
      if (!host) return;
      Object.assign(host,{x:140,y:146,direction:1});
      let index = 0;
      for (const player of world.players) {
        if (player.bot) Object.assign(player,{x:260+index++*20,y:146});
        if (player.npc) Object.assign(player,{x:420+index++*20,y:146,speed:0});
      }
      const nestor = world.players.find(player=>player.visitor==='nestor-cervero')!;
      Object.assign(nestor,{x:152,y:146,direction:3});
      const hang = world.players.find(player=>player.visitor==='luciano-hang')!;
      Object.assign(hang,{x:110,y:146,direction:0});
      const game:Gameplay = Reflect.get(this,'gameplay');
      const baton = Reflect.get(game,'create').call(game,'baton',{holder:host.id});
      game.act(host,{kind:'equip',item:baton.id},world);
      prepared = true;
    },50);
  }
  snapshot() {
    const world:GameplayWorld = Reflect.get(this,'gameplayWorld').call(this);
    const host = world.players.find(player=>!player.npc && !player.bot);
    const game:Gameplay = Reflect.get(this,'gameplay');
    const match:PlenaryMatch = Reflect.get(this,'match');
    return {people:world.players.map((player:Player)=>({...player,wallet:world.wallet?.(player.id),office:world.office(player.id)})),
      inventory:host && game.view(host,world).inventory,economy:match.economySummary(game.physicalCash())};
  }
}
await defineServer({transport:new BunWebSockets(),rooms:{plenary:defineRoom(VisitorsRoom)},express:app=>{
  app.get('/health',(_request,response)=>response.sendStatus(200));
  app.get('/qa/visitors',(_request,response)=>active ? response.json(active.snapshot()) : response.sendStatus(404));
}}).listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
