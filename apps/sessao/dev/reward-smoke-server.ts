import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {stations,type PlenaryView} from '../src/plenary';
import type {Player} from '../src/map';

class RewardSmokeRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const visited = new Map<string,'coffee'|'cabinet'>();
    const match = Reflect.get(this,'match') as {
      phase:string;
      view:(id:string,ids:string[],now:number)=>PlenaryView;
    };
    const players = Reflect.get(this,'players') as Map<string,{player:Player}>;
    this.clock.setInterval(()=>{
      if (match.phase!=='negotiation') return;
      for (const [id,{player}] of players) {
        const station = visited.get(id);
        if (!station) {
          Object.assign(player,stations.coffee);
          visited.set(id,'coffee');
        } else if (station==='coffee' &&
            match.view(id,[id],this.clock.currentTime).politics?.missions.completed.some(mission=>mission.kind==='cafe')) {
          Object.assign(player,stations.cabinet);
          visited.set(id,'cabinet');
        }
      }
    },100);
  }
}

await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(RewardSmokeRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2607),'127.0.0.1');
