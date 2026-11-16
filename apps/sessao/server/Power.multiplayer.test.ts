import {expect,test} from 'bun:test';
import {Client,type Room} from '@colyseus/sdk';
import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {canStand,roomAt,type Motion,type Player} from '../src/map';
import type {PlenaryView} from '../src/plenary';
import {powerPanels,powerRules,type PowerAction} from '../src/power';
import {SessionRoom} from './SessionRoom';

test('power panels are on walkable floors in their assigned rooms',()=>{
  for (const panel of powerPanels) {
    expect(canStand(panel.x,panel.y)).toBe(true);
    expect(roomAt(panel)).toBe(panel.name);
  }
});

test('an infiltrator cuts visibility for the room and distinct live panel operators restore it',async()=>{
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)}});
  const rooms:Room[] = [];
  async function wait(read:()=>boolean) {
    for (let attempt=0;attempt<160;attempt++) {
      if (read()) return;
      await Bun.sleep(25);
    }
    expect(read()).toBe(true);
  }
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client('http://127.0.0.1:'+port);
    const host = await client.create('plenary',{nick:'Alice'});
    rooms.push(host);
    for (const nick of ['Bia','Caio','Dani','Eva','Fábio']) {
      rooms.push(await client.joinById(host.roomId,{nick}));
    }
    const views = new Map<string,PlenaryView>();
    const snapshots = new Map<string,Player[]>();
    for (const peer of rooms) {
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      peer.onMessage('players',(players:Player[])=>snapshots.set(peer.sessionId,players));
      peer.onMessage('control',()=>{});
      peer.onMessage('gameplay-feedback',()=>{});
      peer.onMessage('mail-state',()=>{});
      peer.onMessage('mail-reports',()=>{});
      peer.onMessage('photo-state',()=>{});
    }
    const room = matchMaker.getLocalRoomById(host.roomId) as SessionRoom;
    const players = Reflect.get(room,'players') as Map<string,{player:Player}>;
    const move = (peer:Room,point:Motion)=>Object.assign(players.get(peer.sessionId)!.player,point);
    const view = (peer:Room)=>views.get(peer.sessionId);
    const sees = (peer:Room,other:Room)=>!!snapshots.get(peer.sessionId)?.some(player=>player.id===other.sessionId);
    const tokens = Reflect.get(room,'lastRoomCommandToken') as Map<string,number>;
    let token = 1;
    async function act(peer:Room,action:PowerAction) {
      const sent = ++token;
      peer.send('power-action',{...action,token:sent});
      await wait(()=>tokens.get(peer.sessionId)===sent);
    }

    host.send('start-match',{npcs:0,token});
    await wait(()=>rooms.every(peer=>view(peer)?.phase==='negotiation'));
    const infiltrator = rooms.find(peer=>view(peer)?.role==='Infiltrado')!;
    const [first,second] = rooms.filter(peer=>peer!==infiltrator);
    const [a,b] = powerPanels;
    const nearA = {x:a.x+49,y:a.y};
    expect(view(infiltrator)?.canSabotagePower).toBe(true);
    expect(view(first)?.canSabotagePower).toBeUndefined();

    move(first,a);
    await act(first,{kind:'sabotage',panel:0});
    move(infiltrator,b);
    await act(infiltrator,{kind:'sabotage',panel:0});
    expect(view(first)?.outage).toBeUndefined();

    move(infiltrator,a);
    move(first,nearA);
    await wait(()=>sees(first,infiltrator) && sees(infiltrator,first));
    await act(infiltrator,{kind:'sabotage',panel:0});
    await wait(()=>rooms.every(peer=>!!view(peer)?.outage) && !sees(first,infiltrator) && !sees(infiltrator,first));

    move(first,a);
    await act(first,{kind:'repair',panel:0});
    await wait(()=>view(first)?.outage?.operating===0);
    await act(infiltrator,{kind:'repair',panel:0});
    expect(view(infiltrator)?.outage?.operating).toBeUndefined();
    expect(view(first)?.outage?.seconds).toBeUndefined();

    move(second,b);
    await act(second,{kind:'repair',panel:1});
    await wait(()=>view(first)?.outage?.seconds===powerRules.repairMs/1000);
    move(second,nearA);
    await wait(()=>view(first)?.outage?.occupied[1]===false && view(first)?.outage?.seconds===undefined);

    move(second,b);
    await act(second,{kind:'repair',panel:1});
    await wait(()=>!!view(first)?.outage?.seconds);
    await wait(()=>rooms.every(peer=>view(peer)?.outage===undefined));
    expect(view(infiltrator)?.canSabotagePower).toBeUndefined();
    move(first,nearA);
    await wait(()=>sees(first,infiltrator) && sees(infiltrator,first));
  } finally {
    await Promise.all(rooms.map(room=>room.leave(true)));
    await server.gracefullyShutdown(false);
  }
},15_000);
