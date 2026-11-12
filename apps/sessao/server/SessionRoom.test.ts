import { privateOffices } from '../src/private-offices';
import { expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { join } from 'node:path';
import type { PhotoAccessView } from '../src/photography';
import type { PlenaryView } from '../src/plenary';
import { canStand, roomAt, type Player } from '../src/map';

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
    let firstOutbound:string[] = [];
    first.onMessage('voice-send',(ids:string[])=>{firstOutbound = ids;});
    first.onMessage('voice-range',() => {});
    await expect(new Client(endpoint).joinById(first.roomId,{nick:'  RAFA  '})).rejects.toThrow('já está em uso');
    await expect(new Client(endpoint).joinById(first.roomId,{nick:'   '})).rejects.toThrow('Use de 1 a 20');
    const second = await new Client(endpoint).joinById(first.roomId,{nick:'Bia'});
    rooms.push(second);
    let secondView: PlenaryView;
    let secondRange:[string,number][] = [];
    second.onMessage('plenary',(view:PlenaryView) => { secondView = view; });
    second.onMessage('voice-send',() => {});
    second.onMessage('voice-range',(levels:[string,number][]) => { secondRange = levels; });
    let seen: Player[] = [];
    const observed: Player[] = [];
    second.onMessage('players',(players: Player[]) => {
      seen = players;
      const player = players.find(player => player.id===first.sessionId);
      if (player) observed.push(player);
    });
    first.onMessage('players',() => {});
    const positions = new Map<string,Player>();
    const track = (room:Room) => room.onMessage('control',(state:{player:Player})=>positions.set(room.sessionId,state.player));
    track(first);
    track(second);
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
    expect(observed.some(player => player.y>114 && player.y<132)).toBe(true);
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
    track(third);
    third.onMessage('voice-roster',() => {});
    await until(() => firstView?.players===3 && secondView?.players===3 && thirdView?.players===3);
    let firstPhotos:PhotoAccessView | undefined;
    let secondPhotos:PhotoAccessView | undefined;
    let thirdPhotos:PhotoAccessView | undefined;
    const feedback:string[] = [];
    first.onMessage('gameplay-feedback',(message:string) => feedback.push(message));
    first.onMessage('photo-state',(view:PhotoAccessView) => { firstPhotos = view; });
    second.onMessage('gameplay-feedback',() => {});
    second.onMessage('photo-state',(view:PhotoAccessView) => { secondPhotos = view; });
    third.onMessage('photo-state',(view:PhotoAccessView) => { thirdPhotos = view; });
    first.send('start-match');
    await until(() => [firstView,secondView,thirdView].every(view => view?.phase==='negotiation'));
    expect([firstView!,secondView!,thirdView!].filter(view => view.role==='Infiltrado')).toHaveLength(1);
    expect([firstView!,secondView!,thirdView!].every(view => !view.infiltratorName)).toBe(true);
    const participants = [first,second,third];
    const assigned = [firstView!,secondView!,thirdView!].map(view=>privateOffices.find(office=>office.id===view.gameplay?.ownOffice)!);
    expect(new Set(assigned.map(office=>office.id)).size).toBe(3);
    await until(()=>participants.every((peer,index)=>{
      const player = positions.get(peer.sessionId);
      return !!player && roomAt(player)===assigned[index].name;
    }));
    expect(findFirst()).toBeUndefined();
    first.send('gameplay',{kind:'install',place:'constructor',item:1});
    first.send('gameplay',{kind:'photo'});
    await until(() => feedback.includes('Aproxime-se do local.') && firstPhotos?.album.length===1);
    const strike = {kind:'attack',token:1};
    first.send('gameplay',strike);
    first.send('gameplay',strike);
    first.send('gameplay',{kind:'treat',token:2});
    await until(() => feedback.includes('Atendimento indisponível.'));
    expect(feedback.filter(message=>message==='Equipe uma arma.')).toHaveLength(1);
    second.send('gameplay',{kind:'photo'});
    await until(() => secondPhotos?.album.length===1);
    expect(firstPhotos?.album.map(entry=>entry.photo.author.id)).toEqual([first.sessionId]);
    expect(secondPhotos?.album.map(entry=>entry.photo.author.id)).toEqual([second.sessionId]);
    expect(thirdPhotos?.album ?? []).toEqual([]);
    first.send('gameplay',{kind:'call',target:second.sessionId});
    await until(() => secondView?.gameplay?.call?.state==='incoming' && firstView?.gameplay?.call?.state==='outgoing');
    expect(thirdView!.gameplay?.call).toBeUndefined();
    second.send('gameplay',{kind:'answer'});
    await until(() => secondView?.gameplay?.call?.state==='connected' &&
      secondRange.some(([peer,volume]) => peer===first.sessionId && volume===1));
    expect(secondRange.filter(([peer]) => peer===first.sessionId)).toHaveLength(1);
    expect(firstOutbound).toContain(second.sessionId);
    second.send('gameplay',{kind:'hangup'});
    await until(() => !secondView?.gameplay?.call &&
      !secondRange.some(([peer,volume]) => peer===first.sessionId && volume===1));
    await Promise.all([second,third].map(async(peer,index)=>{
      const destination = {x:140+index*12,y:146};
      let sequence = 100;
      peer.send('input',{seq:sequence,destination,sprint:true});
      for (let attempt=0;attempt<350;attempt++) {
        const player = positions.get(peer.sessionId)!;
        if (Math.hypot(player.x-destination.x,player.y-destination.y)<2) return;
        peer.send('input',{seq:++sequence,sprint:true});
        await Bun.sleep(52);
      }
      throw new Error('Could not reach the transfer point from the assigned office');
    }));
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
    await until(() => secondPhotos?.album.length===0);
    const newcomer = await new Client(endpoint).joinById(second.roomId,{nick:'Nova'});
    rooms.push(newcomer);
    newcomer.onMessage('players',() => {});
    newcomer.onMessage('control',() => {});
    newcomer.onMessage('plenary',() => {});
    newcomer.onMessage('voice-roster',() => {});
    await until(() => secondView?.players===3);

    const solo = await new Client(endpoint).create('plenary',{nick:'Solo'});
    rooms.push(solo);
    let soloView:PlenaryView;
    solo.onMessage('players',() => {});
    solo.onMessage('control',() => {});
    solo.onMessage('photo-state',() => {});
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
},30_000);

test('transport is released on an actual socket reconnect and on plenary admission', async () => {
  const {defineRoom,defineServer,matchMaker} = await import('colyseus');
  const {BunWebSockets} = await import('@colyseus/bun-websockets');
  const {SessionRoom} = await import('./SessionRoom');
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({
    gracefullyShutdown:false,transport:new BunWebSockets(),
    rooms:{plenary:defineRoom(SessionRoom)},
  });
  const rooms:Room[] = [];
  const wait = async (ready:()=>boolean) => {
    for (let attempt=0;attempt<100;attempt++) {
      if (ready()) return;
      await Bun.sleep(30);
    }
    throw new Error('Expected transport state did not arrive');
  };
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client(`http://127.0.0.1:${port}`);
    const carrier = await client.create('plenary',{nick:'Alice'});
    rooms.push(carrier);
    const passenger = await client.joinById(carrier.roomId,{nick:'Bia'});
    rooms.push(passenger);
    const snapshots = new Map<string,Player>();
    const views = new Map<string,PlenaryView>();
    const purchases = new Map<string,{id:number;kind:string}>();
    let visible:Player[] = [];
    carrier.onMessage('players',(players:Player[])=>{visible = players;});
    for (const peer of rooms) {
      peer.onMessage('control',(state:{player:Player})=>snapshots.set(peer.sessionId,state.player));
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      peer.onMessage('gear-purchased',(item:{id:number;kind:string})=>purchases.set(peer.sessionId,item));
      for (const message of ['players','photo-state','gameplay-feedback','item-obtained']) peer.onMessage(message,()=>{});
    }
    const room = matchMaker.getLocalRoomById(carrier.roomId) as InstanceType<typeof SessionRoom>;
    // Set only the fixture position and deadline. Actions and results use the live socket.
    const positions = Reflect.get(room,'players') as Map<string,{player:Player}>;
    const match = Reflect.get(room,'match');
    carrier.send('start-match');
    await wait(()=>views.get(carrier.sessionId)?.phase==='negotiation');
    Object.assign(positions.get(carrier.sessionId)!.player,{x:631,y:197,direction:1});
    Object.assign(positions.get(passenger.sessionId)!.player,{x:640,y:197});
    const gameplay = ()=>views.get(carrier.sessionId)?.gameplay;
    carrier.send('gameplay',{kind:'talk',target:'vendor'});
    await wait(()=>!!gameplay()?.dialogue);
    carrier.send('gameplay',{kind:'dialogue-choice',target:'products',token:gameplay()?.dialogue?.token});
    await wait(()=>gameplay()?.dialogue?.shop===true);
    carrier.send('gameplay',{kind:'shop-buy',target:'baton',token:gameplay()?.dialogue?.token});
    await wait(()=>gameplay()?.inventory.some(item=>item.kind==='baton')===true);
    const purchase = purchases.get(carrier.sessionId);
    expect(purchase).toEqual(gameplay()?.inventory.find(item=>item.kind==='baton'));
    expect(purchases.has(passenger.sessionId)).toBe(false);
    carrier.send('gameplay',{kind:'equip',item:purchase?.id});
    await wait(()=>gameplay()?.equipped?.some(item=>item.kind==='baton')===true);
    for (let token=1;token<=4;token++) {
      carrier.send('gameplay',{kind:'attack',token});
      if (token===1) await wait(()=>visible.some(player=>player.id===passenger.sessionId && player.health===.74 && player.hit!==undefined));
      if (token<4) await Bun.sleep(1300);
    }
    await wait(()=>snapshots.get(passenger.sessionId)?.knockedOut===true);
    carrier.send('gameplay',{kind:'carry',target:passenger.sessionId,token:5});
    await wait(()=>snapshots.get(passenger.sessionId)?.carried===true);
    let reconnected = false;
    passenger.reconnection.minUptime = 0;
    passenger.onReconnect(()=>{reconnected = true;});
    passenger.connection.close(4010);
    await wait(()=>!snapshots.get(carrier.sessionId)?.carrying);
    await wait(()=>reconnected && snapshots.get(passenger.sessionId)?.carried===undefined);
    expect(snapshots.get(passenger.sessionId)?.knockedOut).toBe(true);
    const passengerOffice = views.get(passenger.sessionId)?.gameplay?.ownOffice;
    expect(passengerOffice).toBeDefined();
    carrier.send('gameplay',{kind:'carry',target:passenger.sessionId,token:6});
    await wait(()=>snapshots.get(passenger.sessionId)?.carried===true);
    Reflect.set(match,'ends',room.clock.currentTime);
    await wait(()=>views.get(passenger.sessionId)?.phase==='ballot' &&
      snapshots.get(passenger.sessionId)?.x===386 && snapshots.get(passenger.sessionId)?.y===655);
    expect(snapshots.get(passenger.sessionId)?.carried).toBeUndefined();
    expect(views.get(passenger.sessionId)?.gameplay?.ownOffice).toBe(passengerOffice);
    expect(snapshots.get(passenger.sessionId)?.knockedOut).toBeUndefined();
    passenger.send('bill-vote','yes');
    await wait(()=>views.get(passenger.sessionId)?.vote==='yes');
  } finally {
    await Promise.allSettled(rooms.map(room=>room.leave()));
    await server.gracefullyShutdown(false);
  }
},15_000);
