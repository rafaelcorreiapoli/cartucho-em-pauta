import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {installationSites} from '../src/installations';
import {npcs} from '../src/npcs';

class ContextProgressRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const prepared = new Set<string>();
    this.clock.setInterval(()=>{
      if (Reflect.get(this,'match').phase!=='negotiation') return;
      const game:import('../server/Gameplay').Gameplay = Reflect.get(this,'gameplay');
      const world:import('../server/gameplay-world').GameplayWorld = Reflect.get(this,'gameplayWorld').call(this);
      for (const player of world.players) {
        if (player.npc || prepared.has(player.id)) continue;
        Object.assign(player,npcs.credentialsVendor.interaction);
        game.act(player,{kind:'open-shop',target:'credentialsVendor'},world);
        const token = game.view(player,world).dialogue?.token;
        if (game.act(player,{kind:'shop-buy',target:'portrait',token},world)!=='Compra guardada no inventário.') continue;
        game.act(player,{kind:'dialogue-close'},world);
        const point = installationSites.hall.point;
        Object.assign(player,point);
        Reflect.get(game,'create').call(game,'extinguisher',{ground:point});
        prepared.add(player.id);
      }
    },100);
  }
}

await defineServer({
  transport:new BunWebSockets(),
  rooms:{plenary:defineRoom(ContextProgressRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 26874),'127.0.0.1');
