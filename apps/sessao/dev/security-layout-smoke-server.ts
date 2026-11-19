import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './classic-room-fixture';
import {securityRoom,type Player} from '../src/map';
import {hideouts} from '../src/surveillance';

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
        const surveillance = Reflect.get(Reflect.get(this,'gameplay'),'surveillance');
        const sites = hideouts.filter(site=>site.id==='coffee' || site.id==='library');
        for (const [index,site] of sites.entries()) {
          const id = index+1;
          const device = {id,kind:'spyCamera' as const,name:'Câmera '+site.room,room:site.room,site,owner:player.id,
            hardware:{id,discoveredBy:new Set<string>()},active:false,removed:false,alerts:true,until:0,alertAt:0,installedAt:0};
          Reflect.get(surveillance,'devices').set(id,device);
          Reflect.get(surveillance,'occupied').set(site.id,device);
        }
      }
    },100);
  }
}

await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(SecurityLayoutRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
})
  .listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
