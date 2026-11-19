import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './classic-room-fixture';
import {levelThresholds,type Progression} from '../src/progression';

class AttributesSmokeRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const match = Reflect.get(this,'match');
    const accounts = Reflect.get(Reflect.get(match,'economy'),'accounts') as Map<string,{
      progression:{earn:(amount:number)=>void; view:()=>Progression};
    }>;
    const lastViews:Map<string,string> = Reflect.get(this,'lastMatchView');
    const seeded = new WeakSet<object>();
    let countdown = false;
    this.clock.setInterval(()=>{
      if (match.phase!=='negotiation') return;
      for (const [player,account] of accounts) {
        const snapshot = lastViews.get(player);
        if (!seeded.has(account) && snapshot && JSON.parse(snapshot).phase==='negotiation') {
          account.progression.earn(levelThresholds[2]);
          seeded.add(account);
        }
        if (!countdown && account.progression.view().revision===1) {
          countdown = true;
          Reflect.set(match,'proposal',{project:0,proposer:player,voteAt:this.clock.currentTime+5_000});
        }
      }
    },50);
  }
}

await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(AttributesSmokeRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2609),'127.0.0.1');
