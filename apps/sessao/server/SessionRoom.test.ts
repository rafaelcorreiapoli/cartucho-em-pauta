import { expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { join } from 'node:path';
import type { PlenaryView } from '../src/plenary';
import { canStand, PLENARY_DOORS, type Player } from '../src/map';

test('clients share movement and voice, then receive private roles and payments', async () => {
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
    const first = await new Client(endpoint).create('plenary',{nick:'Rafa'});
    rooms.push(first);
    let firstView: PlenaryView;
    first.onMessage('plenary',(view:PlenaryView) => { firstView = view; });
    first.onMessage('voice-range',() => {});
    await expect(new Client(endpoint).joinById(first.roomId,{nick:'  RAFA  '})).rejects.toThrow('já está em uso');
    await expect(new Client(endpoint).joinById(first.roomId,{nick:'   '})).rejects.toThrow('Use de 1 a 20');
    const second = await new Client(endpoint).joinById(first.roomId,{nick:'Bia'});
    rooms.push(second);
    let secondView: PlenaryView;
    let secondRange:[string,number][] = [];
    second.onMessage('plenary',(view:PlenaryView) => { secondView = view; });
    second.onMessage('voice-range',(levels:[string,number][]) => { secondRange = levels; });
    let seen: Player[] = [];
    const observed: Player[] = [];
    second.onMessage('players',(players: Player[]) => {
      seen = players;
      const player = players.find(player => player.id===first.sessionId);
      if (player) observed.push(player);
    });
    first.onMessage('players',() => {});
    first.onMessage('control',() => {});
    second.onMessage('control',() => {});
    let seq = 0;
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
      first.send('input',{seq:++seq,motion:{x:0,y:-1}});
      await Bun.sleep(50);
    }
    first.send('input',{seq:++seq,motion:{x:0,y:0}});
    await until(() => findFirst()?.moving===false && findFirst()?.character===2);
    const end = findFirst()!;
    expect(end.nick).toBe('Rafa');
    expect(end.y).toBeLessThan(start.y);
    expect(end.y).toBeGreaterThanOrEqual(132);
    expect(end.x).toBe(start.x);
    first.send('input',{seq:++seq,destination:{x:240,y:70}});
    for (let step=0;step<55;step++) {
      if (Math.hypot(findFirst()!.x-240,findFirst()!.y-70)<1) break;
      first.send('input',{seq:++seq});
      await Bun.sleep(50);
    }
    await until(() => Math.hypot(findFirst()!.x-240,findFirst()!.y-70)<1);
    expect(observed.some(player => PLENARY_DOORS.some(([x,y,width,height]) =>
      player.x>=x+6 && player.x<=x+width-6 && player.y>y && player.y<y+height+7))).toBe(true);
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
    const third = await new Client(endpoint).joinById(first.roomId,{nick:'João'});
    rooms.push(third);
    let thirdView: PlenaryView;
    third.onMessage('plenary',(view:PlenaryView) => { thirdView = view; });
    third.onMessage('players',() => {});
    third.onMessage('control',() => {});
    third.onMessage('voice-roster',() => {});
    await until(() => firstView?.players===3 && secondView?.players===3 && thirdView?.players===3);
    first.send('start-match');
    await until(() => [firstView,secondView,thirdView].every(view => view?.phase==='negotiation'));
    expect([firstView!,secondView!,thirdView!].filter(view => view.role==='Infiltrado')).toHaveLength(1);
    expect([firstView!,secondView!,thirdView!].every(view => !view.infiltratorName)).toBe(true);
    await until(() => !findFirst() && secondRange.some(([id,volume]) => id===first.sessionId && volume>0));
    second.send('politics',{kind:'transfer',to:third.sessionId,amount:2,clandestine:true});
    await until(() => secondView?.politics?.wallet===6 && thirdView?.politics?.wallet===10);
    expect(firstView!.politics?.wallet).toBe(8);
    expect(firstView!.politics?.evidence).toEqual([]);
    expect(firstView!.politics?.ledger).toEqual([]);
    expect(thirdView!.politics?.evidence.at(-1)?.kind).toBe('clandestine-transfer');
    expect(firstView!.election?.offices).toEqual(secondView!.election?.offices);
    expect(firstView!.election?.offices.filter(({office}) => office==='president')).toHaveLength(1);
    second.send('election',{kind:'run',office:'president'});
    second.send('election',{kind:'invest',amount:2});
    await until(() => secondView?.politics?.wallet===4 &&
      firstView?.election?.polls.some(entry => entry.id===second.sessionId && entry.race==='president')===true);
    expect(secondView!.election?.personal?.invested).toBe(2);
    expect(firstView!.election?.personal?.invested).toBe(0);
    await first.leave();
    await until(() => roster.at(-1)?.length===1);
    expect(roster.at(-1)).toEqual([second.sessionId]);
    await until(() => secondView?.phase==='finished' && seen.length===2 && seen.some(player => player.id===second.sessionId));
    const solo = await new Client(endpoint).create('plenary',{nick:'Solo'});
    rooms.push(solo);
    let soloView:PlenaryView;
    solo.onMessage('players',() => {});
    solo.onMessage('control',() => {});
    solo.onMessage('plenary',(view:PlenaryView) => { soloView = view; });
    solo.send('start-match',1);
    await until(() => soloView?.phase==='negotiation');
    expect(soloView!).toMatchObject({solo:true,role:'Parlamentar',electorate:1,
      election:{personal:{office:'president'}}});

  } finally {
    await Promise.allSettled(rooms.map(room => room.leave()));
    server.kill();
    await server.exited;
  }
},10000);
