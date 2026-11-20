import {expect,test} from 'bun:test';
import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {Client,type Room} from '@colyseus/sdk';
import {SessionRoom} from './SessionRoom';
import type {PlenaryView} from '../src/plenary';

test('real rooms use the selected defaults, restrict the automatic-project switch to the host and deliver approvals over the socket',async()=>{
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)}});
  const peers:Room[] = [];
  const views = new Map<string,PlenaryView>();
  const wait = async (condition:()=>boolean)=>{
    for (let i=0;i<120;i++) { if (condition()) return; await Bun.sleep(25); }
    throw Error('Expected automatic-project room state');
  };
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client(`http://127.0.0.1:${port}`);
    for (let i=0;i<6;i++) {
      const peer = i ? await client.joinById(peers[0].roomId,{nick:`Pessoa ${i}`}) : await client.create('plenary',{nick:'Pessoa 0'});
      peers.push(peer);
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      for (const kind of ['players','control','mail-state','mail-reports','photo-state','voice-send','voice-range','cash-movement']) peer.onMessage(kind,()=>{});
    }
    const host = peers[0], guest = peers[1];
    await wait(()=>views.size===6);
    expect(views.get(host.sessionId)).toMatchObject({gameMode:'calote',lobbyNpcCount:3,automaticProjectsEnabled:true,
      photosEnabled:true,electionsEnabled:true,phoneGamesEnabled:false,projectVotingEnabled:false,surveillanceEnabled:false,decorationsEnabled:false,portraitsAndVipEnabled:false});
    const room = matchMaker.getLocalRoomById(host.roomId)!;
    const tokens:Map<string,number> = Reflect.get(room,'lastRoomCommandToken');
    guest.send('lobby-automatic-projects',{enabled:false,token:1});
    await wait(()=>tokens.get(guest.sessionId)===1);
    expect(Reflect.get(room,'automaticProjectsEnabled')).toBe(true);
    host.send('lobby-automatic-projects',{enabled:false,token:1});
    await wait(()=>views.get(host.sessionId)?.automaticProjectsEnabled===false);
    host.send('lobby-automatic-projects',{enabled:'true',token:2});
    host.send('lobby-automatic-projects',{enabled:true,token:2});
    await wait(()=>views.get(host.sessionId)?.automaticProjectsEnabled===true);
    guest.send('lobby-calote-debt-seconds',{value:60,token:2});
    await wait(()=>tokens.get(guest.sessionId)===2);
    expect(Reflect.get(room,'caloteDebtSeconds')).toBe(30);
    host.send('lobby-calote-debt-seconds',{value:40,token:3});
    host.send('lobby-calote-debt-seconds',{value:45,token:3});
    await wait(()=>[...views.values()].every(view=>view.caloteDebtSeconds===45));
    host.send('start-match',{token:4});
    await wait(()=>[...views.values()].every(view=>view.phase==='negotiation'));
    expect([...views.values()].filter(view=>view.role==='Infiltrado')).toHaveLength(2);
    expect(views.get(host.sessionId)?.automaticProjects).toMatchObject({approved:[],total:4,nextIn:300});
    host.send('lobby-automatic-projects',{enabled:false,token:5});
    await wait(()=>tokens.get(host.sessionId)===5);
    expect(Reflect.get(room,'automaticProjectsEnabled')).toBe(true);
    const match = Reflect.get(room,'match');
    expect(match.view(host.sessionId,[...views.keys()],match.gameTime(room.clock.currentTime)).caloteDebtSeconds).toBe(45);
    const projects = Reflect.get(match,'automaticProjects');
    Reflect.set(projects,'order',['porrete','reajuste','energeticos','qualificacao']);
    const now = match.gameTime(room.clock.currentTime);
    Reflect.set(projects,'started',now-300000);
    Reflect.get(match,'cash').spawned += 1000-Reflect.get(match,'budget');
    Reflect.set(match,'budget',1000);
    await wait(()=>views.get(host.sessionId)?.automaticProjects?.approved.length===1);
    expect(views.get(host.sessionId)?.automaticProjects?.announcement).toMatchObject({project:'porrete',cost:6,recipients:6});
    for (const peer of peers) expect(views.get(peer.sessionId)?.gameplay?.inventory.some(item=>item.kind==='baton')).toBe(true);
  } finally {
    await Promise.all(peers.map(peer=>peer.leave().catch(()=>{})));
    await server.gracefullyShutdown(false);
  }
},10000);
