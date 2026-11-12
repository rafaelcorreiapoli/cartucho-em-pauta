import { expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { join } from 'node:path';
import type { Player } from '../src/map';

test('two clients share movement, collision and character changes in a room', async () => {
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:() => new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = Bun.spawn([process.execPath,join(import.meta.dir,'index.ts')],{
    env:{...process.env,PORT:String(port)},stdout:'ignore',stderr:'inherit',
  });
  const endpoint = `http://127.0.0.1:${port}`;
  const rooms: Room[] = [];
  try {
    for (let attempt=0;attempt<40;attempt++) {
      if (await fetch(endpoint+'/health').then(r => r.ok).catch(() => false)) break;
      await Bun.sleep(50);
    }
    const first = await new Client(endpoint).create('plenary');
    rooms.push(first);
    const second = await new Client(endpoint).joinById(first.roomId);
    rooms.push(second);
    let seen: Player[] = [];
    second.onMessage('players',(players: Player[]) => { seen = players; });
    first.onMessage('players',() => {});
    const findFirst = () => seen.find(player => player.id===first.sessionId);
    const until = async (ready: () => boolean) => {
      for (let attempt=0;attempt<30;attempt++) {
        if (ready()) return;
        await Bun.sleep(35);
      }
      throw new Error('Expected room update did not arrive');
    };
    await until(() => seen.length===2);
    const start = findFirst()!;
    first.send('character',2);
    for (let step=0;step<10;step++) {
      first.send('move',{x:0,y:-1});
      await Bun.sleep(50);
    }
    first.send('move',{x:0,y:0});
    await until(() => findFirst()?.moving===false && findFirst()?.character===2);
    const end = findFirst()!;
    expect(end.y).toBeLessThan(start.y);
    expect(end.y).toBeGreaterThanOrEqual(132);
    expect(end.x).toBe(start.x);
    await first.leave();
    await until(() => seen.length===1 && seen[0].id===second.sessionId);
  } finally {
    await Promise.allSettled(rooms.map(room => room.leave()));
    server.kill();
    await server.exited;
  }
},10000);
