import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';

await defineServer({
  transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)},
  express:app=>{
    app.get('/health',(_request,response)=>response.sendStatus(200));
    // This endpoint exists only in the browser smoke fixture, never in server/index.ts.
    app.get('/qa/budget',(request,response)=>{
      const id = request.query.room;
      const balance = Number(request.query.balance);
      const age = Number(request.query.age ?? 0);
      if (typeof id!=='string' || !Number.isFinite(balance) || !Number.isFinite(age) || age<0) return response.sendStatus(400);
      const room = matchMaker.getLocalRoomById(id);
      if (!room) return response.sendStatus(404);
      const match = Reflect.get(room,'match');
      if (Reflect.get(match,'gameMode')!=='calote' || !match.running) return response.sendStatus(409);
      const now = match.gameTime(room.clock.currentTime);
      const difference = balance-Reflect.get(match,'budget');
      const cash = Reflect.get(match,'cash');
      cash[difference>=0 ? 'spawned' : 'expired'] += Math.abs(difference);
      Reflect.get(match,'changeBudget').call(match,difference,now);
      if (balance<0 && age) Reflect.set(match,'caloteStartedAt',now-age);
      response.sendStatus(204);
    });
  },
}).listen(Number(process.env.PORT ?? 2693),'127.0.0.1');
