import {expect,test} from 'bun:test';
import {Client,type Room} from '@colyseus/sdk';
import {defineRoom,defineServer,matchMaker} from 'colyseus';
import {BunWebSockets} from '@colyseus/bun-websockets';
import {SessionRoom} from './SessionRoom';
import {PlenaryMatch} from './PlenaryMatch';
import {stations,type PlenaryView} from '../src/plenary';
import {reprography} from '../src/room-activities';
import {npcs} from '../src/npcs';
import type {Player} from '../src/map';
import type {ForensicReport,InternalNotice} from '../src/internal-mail';

test('players sign, publish, alter, examine and counterpublish snapshots over the room socket',async()=>{
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)}});
  const rooms:Room[] = [];
  async function wait<T>(read:()=>T|undefined):Promise<T> {
    for (let attempt=0;attempt<160;attempt++) {
      const result = read();
      if (result) return result;
      await Bun.sleep(25);
    }
    throw new Error('Expected room state did not arrive');
  }
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client('http://127.0.0.1:'+port);
    const alice = await client.create('plenary',{nick:'Alice'});
    rooms.push(alice);
    const bia = await client.joinById(alice.roomId,{nick:'Bia'});
    rooms.push(bia);
    const views = new Map<string,PlenaryView>();
    const inboxes = new Map<string,InternalNotice[]>();
    const reports = new Map<string,ForensicReport[]>();
    for (const peer of rooms) {
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      peer.onMessage('mail-state',(mail:InternalNotice[])=>inboxes.set(peer.sessionId,mail));
      peer.onMessage('mail-reports',(mail:ForensicReport[])=>reports.set(peer.sessionId,mail));
      for (const name of ['players','control','photo-state','gameplay-feedback','mail-result','item-obtained']) peer.onMessage(name,()=>{});
    }
    const room = matchMaker.getLocalRoomById(alice.roomId) as SessionRoom;
    const match = new PlenaryMatch(1);
    Reflect.set(room,'match',match);
    const players = Reflect.get(room,'players') as Map<string,{player:Player}>;
    const move = (peer:Room,point:{x:number;y:number})=>Object.assign(players.get(peer.sessionId)!.player,point);
    const state = (peer:Room)=>views.get(peer.sessionId)?.gameplay;
    alice.send('start-match');
    await wait(()=>state(alice));
    const economy = Reflect.get(match,'economy');
    const account = Reflect.get(economy,'accounts').get(alice.sessionId);
    // Choose a deterministic agenda draw; the match still assigns the target and validates the signature.
    Reflect.set(account.agenda,'missions',[]);
    Reflect.set(account.agenda,'missionDeck',['assinaturaAlvo','cafe','passeio']);
    match.refreshAgendaEligibility();
    await wait(()=>views.get(alice.sessionId)?.politics?.missions.active.find(mission=>mission.kind==='assinaturaAlvo'));
    expect(views.get(alice.sessionId)?.politics?.missions.active.find(mission=>mission.kind==='assinaturaAlvo')?.person?.id).toBe(bia.sessionId);
    expect(views.get(bia.sessionId)?.politics?.missions.active.some(mission=>mission.person?.id===bia.sessionId)).toBe(false);
    move(alice,stations.secretary);
    move(bia,{x:stations.secretary.x+8,y:stations.secretary.y});
    alice.send('gameplay',{kind:'supply',place:'secretary',target:'project-0'});
    const original = await wait(()=>state(alice)?.inventory.find(item=>item.document?.project===0));
    alice.send('gameplay',{kind:'sign-request',item:original.id,target:bia.sessionId});
    const request = await wait(()=>state(bia)?.requests.find(item=>item.kind==='signature'));
    bia.send('gameplay',{kind:'accept',item:request.id});
    await wait(()=>state(alice)?.inventory.find(item=>item.document?.signatures.some(signer=>signer.id===bia.sessionId)));
    await wait(()=>views.get(alice.sessionId)?.politics?.missions.completed.find(mission=>mission.kind==='assinaturaAlvo'));
    move(alice,reprography);
    alice.send('gameplay',{kind:'edit',item:original.id,target:'1'});
    await wait(()=>state(alice)?.forgeryRemaining);
    expect(state(alice)?.inventory.find(item=>item.id===original.id)?.document?.project).toBe(0);
    await Bun.sleep(4900);
    await wait(()=>state(alice)?.inventory.find(item=>item.document?.project===1));
    move(alice,stations.audit);
    alice.send('mail-publish',{subject:'Proposta assinada',body:'Segue documento',attachment:{kind:'document',id:original.id}});
    const publication = await wait(()=>inboxes.get(bia.sessionId)?.[0]);
    expect(publication.attachment).toMatchObject({kind:'document',document:{id:original.id,signatures:['Bia']}});
    expect(JSON.stringify(publication)).not.toContain('authentic');
    move(bia,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    bia.send('gameplay',{kind:'talk',target:'vendor'});
    const dialogue = await wait(()=>state(bia)?.dialogue);
    bia.send('gameplay',{kind:'dialogue-choice',target:'products',token:dialogue.token});
    const shop = await wait(()=>state(bia)?.dialogue?.shop ? state(bia)?.dialogue : undefined);
    bia.send('gameplay',{kind:'shop-buy',target:'forensicKit',token:shop.token});
    await wait(()=>state(bia)?.inventory.find(item=>item.kind==='forensicKit'));
    bia.send('mail-examine',publication.id);
    const report = await wait(()=>reports.get(bia.sessionId)?.[0]);
    expect(report.authentic).toBe(false);
    expect(reports.get(alice.sessionId)).toEqual([]);
    await wait(()=>state(bia)?.inventory.some(item=>item.kind==='forensicKit')===false);
    move(bia,stations.audit);
    bia.send('mail-publish',{subject:'Contraexposição',body:'Laudo anexo',attachment:{kind:'report',id:report.notice}});
    const rebuttal = await wait(()=>inboxes.get(alice.sessionId)?.find(entry=>entry.subject==='Contraexposição'));
    expect(rebuttal.attachment).toEqual({kind:'report',report});
  } finally {
    await Promise.allSettled(rooms.map(room=>room.leave()));
    await server.gracefullyShutdown(false);
  }
},20_000);
