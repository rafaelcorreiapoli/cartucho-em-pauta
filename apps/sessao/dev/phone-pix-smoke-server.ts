import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import type {WorldItem} from '../src/gameplay';
import {stations} from '../src/plenary';
import {ELECTION_RULES} from '../src/elections';
class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet();
    const voice:Set<string> = Reflect.get(this,'voice');
    this.clock.setInterval(()=>{
      const match = Reflect.get(this,'match');
      if (match.phase!=='negotiation') return;
      // Keep the starting balances and transfers deterministic for this flow.
      Reflect.set(match,'nextPayrollAt',Infinity);
      // Keep the renewal dialog from interrupting the phone flow on slower runners.
      Reflect.set(Reflect.get(match,'election'),'due',Reflect.get(match,'started')+ELECTION_RULES.matchDuration);
      for (const state of Reflect.get(this,'players').values()) {
        if (positioned.has(state)) continue;
        positioned.add(state);
        // Permit the call UI to exercise signaling without capturing audio.
        voice.add(state.player.id);
        if (state.player.nick==='Denúncia QA' || state.player.nick==='Jogo QA') {
          Object.assign(state.player,stations.audit);
          if (state.player.nick==='Jogo QA') state.player.x += 12;
          continue;
        }
        Object.assign(state.player,stations.coffee);
        const game = Reflect.get(this,'gameplay');
        const holder = state.player.id;
        if (state.player.nick==='Alice') {
          const document:WorldItem = Reflect.get(game,'create').call(game,'document',{holder});
          document.document = {
            author:holder,title:'Projeto de teste',description:'Anexo de teste',edited:false,project:0,
            signatures:[],stamps:[],requiredStamps:[],requiredSignatures:0,
          };
        } else {
          Reflect.get(game,'create').call(game,'forensicKit',{holder});
        }
      }
    },100);
  }
}
await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2607),'127.0.0.1');
