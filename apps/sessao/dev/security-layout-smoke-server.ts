import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {securityRoom,type Player} from '../src/map';

class SecurityLayoutRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet<Player>();
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      const states:Map<string,{player:Player}> = Reflect.get(this,'players');
      for (const {player} of states.values()) {
        if (positioned.has(player)) continue;
        positioned.add(player);
        Object.assign(player,{x:securityRoom.terminal.x,y:securityRoom.terminal.y+15});
      }
    },100);
  }
}

await defineServer({transport:new BunWebSockets(),rooms:{plenary:defineRoom(SecurityLayoutRoom)}})
  .listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
