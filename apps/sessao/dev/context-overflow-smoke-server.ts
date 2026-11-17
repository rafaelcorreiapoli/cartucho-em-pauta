import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {stations} from '../src/plenary';

class ContextOverflowRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new Set<string>();
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      for (const {player} of Reflect.get(this,'players').values()) {
        if (positioned.has(player.id)) continue;
        positioned.add(player.id);
        Object.assign(player,stations.coffee);
      }
      for (const player of Reflect.get(this,'parliamentarians').players) {
        Object.assign(player,{x:stations.coffee.x+8,y:stations.coffee.y});
      }
    },50);
  }
}

await defineServer({
  transport:new BunWebSockets(),
  rooms:{plenary:defineRoom(ContextOverflowRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
