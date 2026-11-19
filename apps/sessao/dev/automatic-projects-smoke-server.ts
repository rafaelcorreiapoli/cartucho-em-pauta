import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from '../server/SessionRoom';
import {automaticProjectRules} from '../src/automatic-projects';

await defineServer({transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)},express:app=>{
  app.get('/health',(_request,response)=>response.sendStatus(200));
  // Test fixture only: make the next scheduled deadline due without inventing an approval.
  app.post('/qa/next-project',(request,response)=>{
    const id = request.query.room;
    if (typeof id!=='string') return response.sendStatus(400);
    const room = matchMaker.getLocalRoomById(id);
    if (!room) return response.sendStatus(404);
    const match = Reflect.get(room,'match');
    if (!match.running) return response.sendStatus(409);
    const projects = Reflect.get(match,'automaticProjects');
    const completed = Reflect.get(projects,'approved').length;
    if (completed>=4) return response.sendStatus(409);
    Reflect.set(projects,'order',['porrete','reajuste','energeticos','qualificacao']);
    const now = match.gameTime(room.clock.currentTime);
    Reflect.set(projects,'started',now-automaticProjectRules.firstAfter-completed*automaticProjectRules.interval);
    const difference = 1000-Reflect.get(match,'budget');
    Reflect.get(match,'cash').spawned += difference;
    Reflect.get(match,'changeBudget').call(match,difference,now);
    response.sendStatus(204);
  });
}}).listen(Number(process.env.PORT ?? 2696),'127.0.0.1');
