import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {npcs} from '../src/npcs';
class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet();
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      for (const state of Reflect.get(this,'players').values()) {
        if (positioned.has(state)) continue;
        positioned.add(state);
        Object.assign(state.player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
      }
    },100);
  }
}
await defineServer({transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)}}).listen(2605,'127.0.0.1');
