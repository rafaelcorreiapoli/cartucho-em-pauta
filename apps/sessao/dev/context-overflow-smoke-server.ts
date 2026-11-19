import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {stations,MIN_PLAYERS} from '../src/plenary';

class ContextOverflowRoom extends SessionRoom {
  onJoin(client:Parameters<SessionRoom['onJoin']>[0],options?:Parameters<SessionRoom['onJoin']>[1]) {
    if (options?.nick==='Assinatura QA') Reflect.set(Reflect.get(this,'match'),'minimumPlayers',MIN_PLAYERS);
    return super.onJoin(client,options);
  }
  onCreate() {
    super.onCreate();
    const positioned = new Set<string>();
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      const signing = [...Reflect.get(this,'players').values()].some((state:any)=>state.player.nick==='Assinatura QA');
      const guide = [...Reflect.get(this,'players').values()].find((state:any)=>state.player.bot)?.player;
      if (signing) Reflect.get(this,'match').training = true;
      for (const {player} of Reflect.get(this,'players').values()) {
        if (positioned.has(player.id)) continue;
        positioned.add(player.id);
        const game = Reflect.get(this,'gameplay');
        if (signing) {
          Object.assign(player,player.bot ? player.id===guide?.id ? {x:stations.coffee.x+40,y:stations.coffee.y} : {x:140,y:146} : stations.coffee);
          if (!player.bot) for (const title of ['Documento A','Documento B']) {
            const document = Reflect.get(game,'create').call(game,'document',{holder:player.id});
            document.document = {author:player.nick,title,edited:false,signatures:[],stamps:[],requiredSignatures:1,requiredStamps:[]};
          }
        } else if (player.nick==='Armário QA') {
          const office = Reflect.get(game,'privateOffices').ownedBy(player.id);
          if (!office) throw new Error('O cenário de teste precisa de um gabinete atribuído.');
          Object.assign(player,office.cabinet);
          game.distributePinga(player,this.clock.currentTime);
        } else {
          Object.assign(player,stations.coffee);
          // Keep the nearby-item shortcut scenario independent from station supplies.
          Reflect.get(game,'create').call(game,'coffee',{ground:{...stations.coffee}});
          for (let i=0;i<3;i++) game.distributePinga(player,this.clock.currentTime);
        }
      }
      for (const player of Reflect.get(this,'parliamentarians').players) {
        Object.assign(player,{x:stations.coffee.x+8,y:stations.coffee.y});
      }
    },50);
  }
}

await defineServer({
  transport:new BunWebSockets(),
  rooms:{plenary:defineRoom(ContextOverflowRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
