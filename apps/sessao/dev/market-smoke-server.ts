import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {npcs} from '../src/npcs';
class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet();
    this.clock.setInterval(()=>{
      const match = Reflect.get(this,'match');
      if (match.phase!=='negotiation') return;
      for (const state of Reflect.get(this,'players').values()) {
        if (positioned.has(state)) continue;
        positioned.add(state);
        // Fund a third accessory so the replacement prompt can be exercised.
        Reflect.get(match,'economy').earn(state.player.id,2);
        const position = state.player.nick==='Observador distante' ? {x:140,y:146} : {x:npcs.vendor.x,y:npcs.vendor.y+11};
        Object.assign(state.player,position);
      }
    },100);
  }
}
await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2605),'127.0.0.1');
