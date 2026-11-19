import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './classic-room-fixture';
import type {Player} from '../src/map';
import {stations} from '../src/plenary';

class CampaignSmokeRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet<Player>();
    const match = Reflect.get(this,'match') as {phase:string};
    const players = Reflect.get(this,'players') as Map<string,{player:Player}>;
    this.clock.setInterval(()=>{
      if (match.phase!=='negotiation') return;
      for (const {player} of players.values()) {
        if (positioned.has(player)) continue;
        Object.assign(player,stations.press);
        positioned.add(player);
      }
    },100);
  }
}

await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(CampaignSmokeRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2608),'127.0.0.1');
