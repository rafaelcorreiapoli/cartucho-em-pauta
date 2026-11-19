import {defineRoom,defineServer} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './classic-room-fixture';
import {gameplayMetrics} from '../server/gameplay-metrics';
await defineServer({transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)},
  express:app=>{
    app.get('/health',(_request,response)=>response.json({ok:true,runtime:'bun'}));
    app.get('/metrics',(_request,response)=>response.set('Content-Type','text/plain; version=0.0.4; charset=utf-8').send(gameplayMetrics.exposition()));
  },
}).listen(Number(process.env.PORT),'127.0.0.1');
