import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {publishProjectFiling} from '../server/project-test-fixture';
import {stations} from '../src/plenary';

class LegislativeModalsRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new Set<string>();
    let filed = false;
    this.clock.setInterval(()=>{
      const match:import('../server/PlenaryMatch').PlenaryMatch = Reflect.get(this,'match');
      if (match.phase!=='negotiation') return;
      const players:Map<string,{player:import('../src/map').Player}> = Reflect.get(this,'players');
      const hearingTest = players.size === 2;
      for (const {player} of players.values()) {
        if (!positioned.has(player.id)) {
          positioned.add(player.id);
          Object.assign(player,hearingTest ? stations.panel : player.nick==='Projetos QA' ? stations.secretary : stations.cabinet);
          if (hearingTest) Reflect.get(match,'economy').changePopularity(player.id,20);
        }
        const now = this.clock.currentTime;
        if (filed || !match.view(player.id,[player.id],now).politics?.grantUsed) continue;
        publishProjectFiling(match,player,0,now);
        const proposal = Reflect.get(match,'proposal');
        if (proposal) {
          proposal.voteAt = now+8_000;
          filed = true;
        }
      }
    },100);
  }
}

await defineServer({
  transport:new BunWebSockets(),
  rooms:{plenary:defineRoom(LegislativeModalsRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
