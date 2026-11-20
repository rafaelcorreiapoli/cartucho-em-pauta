import {expect,test} from 'bun:test';
import {federalPatrolRules} from '../src/federal-patrol';
import {Client,type Room} from '@colyseus/sdk';
import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './SessionRoom';
import {Gameplay} from './Gameplay';
import type {PlenaryMatch} from './PlenaryMatch';
import {isolationRoom,roomAt,type Player} from '../src/map';
import {officeDoorPoint,privateOffices} from '../src/private-offices';
import {findRoute} from '../src/navigation';
import type {PlenaryView} from '../src/plenary';
import type {ControlState} from '../src/movement';
import type {WorldItem} from '../src/gameplay';

class FederalTestRoom extends SessionRoom {
  onCreate() { super.onCreate(); Reflect.set(Reflect.get(this,'match'),'minimumPlayers',1); }
}

test('room confirms host-only addon, broadcasts the inspector, arrests and releases the player in the solitary',async()=>{
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!; await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(FederalTestRoom)}});
  const peers:Room[] = [],views = new Map<string,PlenaryView>(),controls = new Map<string,ControlState>();
  const seen = new Map<string,Player[]>();
  const wait = async (ready:()=>boolean,timeout=3000)=>{
    const deadline = Date.now()+timeout;
    while (Date.now()<deadline) { if (ready()) return; await Bun.sleep(25); }
    throw Error('Expected Federal addon room update');
  };
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client(`http://127.0.0.1:${port}`);
    const host = await client.create('plenary',{nick:'Fiscalizado'}); peers.push(host);
    const guest = await client.joinById(host.roomId,{nick:'Observador'}); peers.push(guest);
    for (const peer of peers) {
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      peer.onMessage('control',(state:ControlState)=>controls.set(peer.sessionId,state));
      peer.onMessage('players',(players:Player[])=>seen.set(peer.sessionId,players));
      for (const key of ['mail-state','mail-reports','photo-state','gameplay-feedback']) peer.onMessage(key,()=>{});
    }
    await wait(()=>views.size===2);
    expect(views.get(host.sessionId)?.federalPatrolEnabled).toBe(false);
    const room = matchMaker.getLocalRoomById(host.roomId)!;
    const tokens:Map<string,number> = Reflect.get(room,'lastRoomCommandToken');
    guest.send('lobby-federal-patrol',{enabled:true,token:1});
    await wait(()=>tokens.get(guest.sessionId)===1);
    expect(Reflect.get(room,'federalPatrolEnabled')).toBe(false);
    host.send('lobby-federal-patrol',{enabled:true,token:1});
    await wait(()=>peers.every(peer=>views.get(peer.sessionId)?.federalPatrolEnabled===true));
    host.send('lobby-federal-patrol',{enabled:false,token:1});
    await Bun.sleep(75);
    expect(Reflect.get(room,'federalPatrolEnabled')).toBe(true);
    host.send('lobby-npc-count',{count:0,token:2});
    host.send('start-match',{infiltrators:1,token:3});
    await wait(()=>views.get(host.sessionId)?.phase==='negotiation');
    const game:Gameplay = Reflect.get(room,'gameplay'),match:PlenaryMatch = Reflect.get(room,'match');
    expect(game.federalPlayers).toHaveLength(1);
    expect(Reflect.get(room,'visitors').players).toHaveLength(0);
    host.send('lobby-federal-patrol',{enabled:false,token:4});
    await wait(()=>tokens.get(host.sessionId)===4);
    expect(Reflect.get(room,'federalPatrolEnabled')).toBe(true);
    const states:Map<string,ControlState> = Reflect.get(room,'players');
    const owner = states.get(host.sessionId)!.player;
    const world = ()=>Reflect.get(room,'gameplayWorld').call(room);
    const home = privateOffices.find(office=>office.id===game.view(owner,world()).ownOffice)!;
    const inspector = game.federalPlayers[0]; inspector.speed = 0;
    Object.assign(owner,home.safe,{moving:false});
    Object.assign(states.get(guest.sessionId)!.player,home.spawn,{moving:false});
    Object.assign(inspector,officeDoorPoint(home,-16));
    const patrol = Reflect.get(game,'federalPatrol');
    Reflect.set(patrol,'target',home);
    Reflect.set(patrol,'route',findRoute({...inspector,barriers:undefined},home.spawn));
    const cash = Reflect.get(game,'create').call(game,'briefcase',{holder:host.sessionId}) as WorldItem;
    world().cashFlow('spawned',3);
    await wait(()=>seen.get(guest.sessionId)?.some(player=>player.visitor==='japones-federal')===true);
    host.send('gameplay',{action:{kind:'office-cash',place:home.id,item:cash.id},token:5});
    await wait(()=>game.hasOfficeChannel(host.sessionId));
    inspector.speed = 68;
    await wait(()=>controls.get(host.sessionId)?.isolated===true && views.get(host.sessionId)?.isolationReason==='federal');
    const caught=controls.get(host.sessionId)!;
    const atScene={x:caught.player.x,y:caught.player.y};
    expect(caught.detaining).toBe(true);
    expect(roomAt(caught.player)).toBe(home.name);
    host.send('input',{seq:caught.ack+1,revision:caught.revision,plenary:!!caught.plenary,motion:{x:1,y:1}});
    await Bun.sleep(200);
    expect(controls.get(host.sessionId)!.player).toMatchObject(atScene);
    expect(controls.get(host.sessionId)!.detaining).toBe(true);
    await wait(()=>controls.get(host.sessionId)?.detaining!==true,federalPatrolRules.flagrantPauseMs+1000);
    expect(roomAt(controls.get(host.sessionId)!.player)).toBe(isolationRoom.name);
    expect(views.get(host.sessionId)).toMatchObject({isolationSeconds:10,isolationReason:'federal'});
    expect(game.view(owner,world()).inventory.some(item=>item.kind==='briefcase')).toBe(false);
    expect(game.hasOfficeChannel(host.sessionId)).toBe(false);
    expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
    await wait(()=>controls.get(host.sessionId)?.isolated===false,11000);
    expect(controls.get(host.sessionId)!.player).toMatchObject(isolationRoom.exit);
    expect(roomAt(inspector)).not.toBe(home.name);
  } finally {
    await Promise.allSettled(peers.map(peer=>peer.leave()));
    await server.gracefullyShutdown(false);
  }
},20_000);
