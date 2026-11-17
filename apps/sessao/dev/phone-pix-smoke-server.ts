import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {stations} from '../src/plenary';
class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet();
    const voice:Set<string> = Reflect.get(this,'voice');
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      for (const state of Reflect.get(this,'players').values()) {
        if (positioned.has(state)) continue;
        positioned.add(state);
        // Permit the call UI to exercise signaling without capturing audio.
        voice.add(state.player.id);
        Object.assign(state.player,stations.coffee);
      }
    },100);
  }
}
await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2607),'127.0.0.1');
