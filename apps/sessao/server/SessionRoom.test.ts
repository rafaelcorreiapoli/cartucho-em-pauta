import { expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { join } from 'node:path';
import { canStand, type Player } from '../src/map';

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
    const observed: Player[] = [];
    second.onMessage('players',(players: Player[]) => {
      seen = players;
      const player = players.find(player => player.id===first.sessionId);
      if (player) observed.push(player);
    });
    first.onMessage('players',() => {});
    const findFirst = () => seen.find(player => player.id===first.sessionId);
    const until = async (ready: () => boolean) => {
      for (let attempt=0;attempt<85;attempt++) {
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
    first.send('destination',{x:240,y:70});
    await until(() => Math.hypot(findFirst()!.x-240,findFirst()!.y-70)<1);
    expect(observed.some(player => player.x>=223 && player.x<=257 && player.y<132 && player.y>114)).toBe(true);
    expect(observed.every(player => canStand(player.x,player.y))).toBe(true);
    const roster: string[][] = [];
    const signals: unknown[] = [];
    first.onMessage('voice-roster',() => {});
    second.onMessage('voice-roster',(ids: string[]) => roster.push(ids));
    second.onMessage('voice-signal',(signal: unknown) => signals.push(signal));
    second.send('voice-join');
    await until(() => roster.at(-1)?.length===1);
    const signal = {description:{type:'offer',sdp:'voice test'}};
    first.send('voice-signal',{to:second.sessionId,signal});
    first.send('voice-join');
    await until(() => roster.at(-1)?.length===2);
    expect(signals).toHaveLength(0);
    first.send('voice-signal',{to:second.sessionId,signal});
    await until(() => signals.length===1);
    expect(signals[0]).toEqual({from:first.sessionId,signal});
    await first.leave();
    await until(() => roster.at(-1)?.length===1);
    expect(roster.at(-1)).toEqual([second.sessionId]);
    await until(() => seen.length===1 && seen[0].id===second.sessionId);
  } finally {
    await Promise.allSettled(rooms.map(room => room.leave()));
    server.kill();
    await server.exited;
  }
},10000);
