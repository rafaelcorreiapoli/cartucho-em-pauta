import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {INVENTORY_SLOTS} from '../src/gameplay';
import type {Gameplay} from '../server/Gameplay';
import {npcs} from '../src/npcs';
class TestRoom extends SessionRoom {
  onCreate() {
    super.onCreate();
    const positioned = new WeakSet();
    this.clock.setInterval(()=>{
      const match = Reflect.get(this,'match');
      if (match.phase!=='negotiation') return;
      for (const state of Reflect.get(this,'players').values()) {
        if (positioned.has(state)) continue;
        positioned.add(state);
        if (state.player.nick==='Mercado Lotado') {
          const game:Gameplay = Reflect.get(this,'gameplay');
          const world = Reflect.get(this,'gameplayWorld').call(this);
          Reflect.get(match,'economy').earn(state.player.id,50);
          Object.assign(state.player,npcs.snackVendor.interaction);
          game.act(state.player,{kind:'open-shop',target:'snackVendor'},world);
          for (let slot=0;slot<INVENTORY_SLOTS;slot++) {
            const token = game.view(state.player,world).dialogue?.token;
            const result = game.act(state.player,{kind:'shop-buy',target:'pizza',token},world);
            if (result!=='Compra guardada no inventário.') throw Error(result ?? 'Compra de pizza sem confirmação');
          }
          if (game.view(state.player,world).inventory.length!==INVENTORY_SLOTS) throw Error('Mochila do cenário deve estar cheia');
          game.act(state.player,{kind:'dialogue-close'},world);
        }
        // Fund a third accessory so the replacement prompt can be exercised.
        Reflect.get(match,'economy').earn(state.player.id,2);
        const position = state.player.nick==='Observador distante' ? {x:140,y:146} : {x:npcs.vendor.x,y:npcs.vendor.y+11};
        Object.assign(state.player,position);
      }
    },100);
  }
}
await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(TestRoom)},
  express:app=>{ app.get('/health',(_request,response)=>response.sendStatus(200)); },
}).listen(Number(process.env.PORT ?? 2605),'127.0.0.1');
