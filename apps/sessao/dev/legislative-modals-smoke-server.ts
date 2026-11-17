import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {publishProjectFiling} from '../server/project-test-fixture';
import {stations} from '../src/plenary';
import {ELECTION_RULES} from '../src/elections';
import type {Parliamentarians} from '../server/Parliamentarians';

class LegislativeModalsRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new Set<string>();
    let filed = false;
    let shortenedCassation = false;
    let shortenedCassationBallot = false;
    this.clock.setInterval(()=>{
      const match:import('../server/PlenaryMatch').PlenaryMatch = Reflect.get(this,'match');
      if (shortenedCassation && !shortenedCassationBallot && Reflect.get(match,'cassationVotes').size>0) {
        shortenedCassationBallot = true;
        Reflect.set(match,'ends',this.clock.currentTime+1_000);
      }
      if (match.phase!=='negotiation') return;
      const players:Map<string,{player:import('../src/map').Player}> = Reflect.get(this,'players');
      const plenaryTest = players.size >= 2;
      for (const {player} of players.values()) {
        if (!positioned.has(player.id)) {
          positioned.add(player.id);
          if (player.nick==='Final QA') {
            this.clock.setTimeout(()=>match.advance(this.clock.currentTime+ELECTION_RULES.matchDuration),500);
          }
          Object.assign(player,plenaryTest ? stations.panel : player.nick==='Projetos QA' ? stations.secretary : stations.cabinet);
          const economy = Reflect.get(match,'economy');
          if (plenaryTest) economy.changePopularity(player.id,20);
          if (player.nick==='Projetos QA') {
            const {agenda} = Reflect.get(economy,'accounts').get(player.id);
            Reflect.set(agenda,'missions',[]);
            Reflect.set(agenda,'missionDeck',['assinaturas','cafe','passeio','selfieSolo']);
            match.refreshAgendaEligibility();
          }
        }
        if (player.nick==='Projetos QA') {
          const parliamentarians:Parliamentarians = Reflect.get(this,'parliamentarians');
          parliamentarians.players.forEach((npc,index)=>{
            Object.assign(npc,{x:stations.secretary.x+8+index*6,y:stations.secretary.y,moving:false});
          });
        }
        const now = this.clock.currentTime;
        if (!shortenedCassation && player.nick==='Cassação QA' && Reflect.get(match,'cassationAt')!==undefined) {
          shortenedCassation = true;
          Reflect.set(match,'cassationAt',now+500);
        }
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
