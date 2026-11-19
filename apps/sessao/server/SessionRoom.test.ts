import {publishProjectFiling} from './project-test-fixture';
import {MAX_QUEUED_INPUTS,type ControlState} from '../src/movement';
import { ELECTION_RULES, type CampaignBroadcast } from '../src/elections';
import {MAX_PLAYERS,stations} from '../src/plenary';
import { npcs } from '../src/npcs';
import { stationRecharge } from '../src/station-recharge';
import { INVENTORY_SLOTS, terminals, treasuryDeliveries, type GameplayEvent, type InteractionCue } from '../src/gameplay';
import type { PhotoScene } from '../src/photography';
import type { SpyCameraFrame } from '../src/surveillance';
import { missionReward } from '../src/politics';
import { privateOffices } from '../src/private-offices';
import { expect, test } from 'bun:test';
import { Client, type Room } from '@colyseus/sdk';
import { join } from 'node:path';
import type { PhotoAccessView } from '../src/photography';
import type { PlenaryView } from '../src/plenary';
import { canStand, PLENARY_SEATS, roomAt, securityRoom, type Player } from '../src/map';

test('clients share movement and voice, then receive private roles and payments', async () => {
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:() => new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = Bun.spawn([process.execPath,join(import.meta.dir,'index.ts')],{
    env:{...process.env,PORT:String(port),NODE_ENV:'test',SESSAO_TEST_MIN_PLAYERS:'1'},stdout:'ignore',stderr:'inherit',
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
    const controls = new Map<string,ControlState>();
    const track = (room:Room) => room.onMessage('control',(state:ControlState)=>{
      controls.set(room.sessionId,state);
      positions.set(room.sessionId,state.player);
    });
    track(first);
    track(second);
    let seq = 0;
    const findFirst = () => seen.find(player => player.id===first.sessionId);
    const until = async (ready: () => boolean, pollMs=35) => {
      for (let attempt=0;attempt<85*35/pollMs;attempt++) {
        if (ready()) return;
        await Bun.sleep(pollMs);
      }
      throw new Error('Expected room update did not arrive');
    };
    await until(() => seen.length===2);
    const start = findFirst()!;
    first.send('character',{character:2,token:1});
    first.send('character',{character:1,token:1});
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
    const acknowledged = new Set<number>();
    const firstBurstSeq = seq+1;
    const visualSnapshotsBeforeBurst = observed.length;
    first.onMessage('control',(state:ControlState)=>{
      if (state.ack>=firstBurstSeq && state.ack<firstBurstSeq+MAX_QUEUED_INPUTS) acknowledged.add(state.ack);
    });
    for (let step=0;step<MAX_QUEUED_INPUTS;step++) {
      first.send('input',{seq:++seq,motion:{x:0,y:0}});
    }
    await until(()=>controls.get(first.sessionId)?.ack===seq);
    expect([...acknowledged]).toEqual(Array.from({length:MAX_QUEUED_INPUTS},(_,index)=>firstBurstSeq+index));
    expect(observed.length-visualSnapshotsBeforeBurst).toBeLessThan(MAX_QUEUED_INPUTS);
    const destination = {x:240,y:94};
    first.send('input',{seq:++seq,destination});
    for (let step=0;step<55;step++) {
      if (Math.hypot(findFirst()!.x-destination.x,findFirst()!.y-destination.y)<1) break;
      first.send('input',{seq:++seq});
      await Bun.sleep(50);
    }
    await until(() => Math.hypot(findFirst()!.x-destination.x,findFirst()!.y-destination.y)<1);
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
    first.onMessage('map-action-failed',(message:string) => feedback.push(message));
    first.onMessage('photo-state',(view:PhotoAccessView) => { firstPhotos = view; });
    second.onMessage('gameplay-feedback',() => {});
    second.onMessage('photo-state',(view:PhotoAccessView) => { secondPhotos = view; });
    third.onMessage('photo-state',(view:PhotoAccessView) => { thirdPhotos = view; });
    first.send('start-match',{npcs:0,token:2});
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
    first.send('gameplay',{action:{kind:'install',place:'constructor',item:1},token:1310});
    const photoCommand = {action:{kind:'photo'},token:1320};
    first.send('gameplay',photoCommand);
    first.send('gameplay',photoCommand);
    await until(() => feedback.includes('Aproxime-se do local.') && firstPhotos?.album.length===1);
    const strike = {kind:'attack'};
    const strikeToken = 1340;
    first.send('gameplay',{action:strike,token:strikeToken});
    first.send('gameplay',{action:strike,token:strikeToken});
    first.send('gameplay',{action:{kind:'treat'},token:1370});
    await until(() => feedback.includes('Atendimento indisponível.'));
    expect(feedback.filter(message=>message==='Equipe uma arma.')).toHaveLength(1);
    second.send('gameplay',{action:{kind:'photo'},token:1400});
    await until(() => secondPhotos?.album.length===1);
    expect(firstPhotos?.album.map(entry=>entry.photo.author.id)).toEqual([first.sessionId]);
    expect(secondPhotos?.album.map(entry=>entry.photo.author.id)).toEqual([second.sessionId]);
    expect(thirdPhotos?.album ?? []).toEqual([]);
    first.send('gameplay',{action:{kind:'call',target:second.sessionId},token:1450});
    await until(() => secondView?.gameplay?.call?.state==='incoming' && firstView?.gameplay?.call?.state==='outgoing');
    expect(thirdView!.gameplay?.call).toBeUndefined();
    second.send('gameplay',{action:{kind:'answer'},token:1480});
    await until(() => secondView?.gameplay?.call?.state==='connected' &&
      secondRange.some(([peer,volume]) => peer===first.sessionId && volume===1));
    expect(secondRange.filter(([peer]) => peer===first.sessionId)).toHaveLength(1);
    expect(firstOutbound).toContain(second.sessionId);
    second.send('gameplay',{action:{kind:'hangup'},token:1530});
    await until(() => !secondView?.gameplay?.call &&
      !secondRange.some(([peer,volume]) => peer===first.sessionId && volume===1));
    async function walkTo(peer:Room,destination:{x:number;y:number},checkStaleRevision=false) {
      const control = controls.get(peer.sessionId)!;
      let sequence = Math.max(100,control.ack+2);
      if (checkStaleRevision) {
        peer.send('input',{seq:sequence-1,destination,sprint:true});
        await Bun.sleep(60);
        expect(controls.get(peer.sessionId)?.ack).toBeLessThan(sequence-1);
      }
      peer.send('input',{seq:sequence,revision:control.revision,destination,sprint:true});
      for (let attempt=0;attempt<350;attempt++) {
        await until(()=> {
          const latest = controls.get(peer.sessionId)!;
          return latest.ack>=sequence || latest.revision!==control.revision;
        },5);
        const latest = controls.get(peer.sessionId)!;
        const {x,y,knockedOut} = latest.player;
        if (latest.revision===control.revision && Math.hypot(x-destination.x,y-destination.y)<2) return;
        if (latest.revision!==control.revision || knockedOut || !latest.route.length) {
          throw new Error(`Walk to ${destination.x},${destination.y} stopped at ${x},${y} (ack ${latest.ack}, revision ${control.revision} → ${latest.revision})`);
        }
        peer.send('input',{seq:++sequence,revision:control.revision,sprint:true});
      }
      throw new Error(`Could not reach ${destination.x},${destination.y} in 350 acknowledged steps`);
    }
    await Promise.all([second,third].map((peer,index)=>walkTo(peer,{x:140+index*12,y:146},true)));
    const sourceBefore = secondView!.politics!.wallet;
    const sourceIncomeBefore = secondView!.politics!.walletIncome;
    const sourceWalletWithoutNewIncome = ()=> {
      const politics = secondView?.politics;
      return politics && politics.wallet-(politics.walletIncome-sourceIncomeBefore);
    };
    const balanceBefore = thirdView!.politics!.wallet;
    const completedBefore = thirdView!.politics!.missions.completed.length;
    const thirdRewards = () => thirdView!.politics!.missions.completed.slice(completedBefore)
      .reduce((sum,mission)=>sum+(missionReward(mission.kind).cash ?? 0),0);
    const transfer = {kind:'transfer',to:third.sessionId,amount:2,clandestine:false,token:1730};
    second.send('politics',{...transfer,token:undefined});
    second.send('politics',transfer);
    second.send('politics',{...transfer,amount:1});
    await until(() => sourceWalletWithoutNewIncome()===sourceBefore-2 && thirdView?.politics?.wallet===balanceBefore+2+thirdRewards());
    expect(firstView!.politics?.wallet).toBe(8);
    expect(firstView!.politics?.evidence).toEqual([]);
    expect(firstView!.politics?.ledger).toEqual([]);
    expect(thirdView!.politics?.evidence.at(-1)?.kind).toBe('clandestine-transfer');
    expect(firstView!.election?.offices).toEqual(secondView!.election?.offices);
    expect(firstView!.election?.offices.filter(({office}) => office==='deputy')).toHaveLength(3);
    const broadcasts = participants.map(peer=>{
      const ads:CampaignBroadcast[] = [];
      peer.onMessage('campaign-advertisement',(ad:CampaignBroadcast)=>ads.push(ad));
      return ads;
    });
    second.send('election',{kind:'advertise',token:1810});
    await walkTo(second,stations.press);
    expect(secondView!.election?.personal?.advertised).toBe(false);
    second.send('election',{kind:'invest',amount:1,token:1840});
    second.send('politics',{kind:'campaign',token:1841});
    second.send('election',{kind:'advertise',token:transfer.token});
    second.send('election',{kind:'advertise',token:1850});
    second.send('election',{kind:'advertise',token:1850});
    second.send('politics',{...transfer,token:1850});
    await until(() => sourceWalletWithoutNewIncome()===sourceBefore-2-ELECTION_RULES.advertisementCost &&
      firstView?.election?.polls.some(entry => entry.id===second.sessionId && entry.race==='deputy')===true);
    expect(thirdView!.politics!.wallet).toBe(balanceBefore+2+thirdRewards());
    expect(secondView!.election?.personal?.advertised).toBe(true);
    expect(firstView!.election?.personal?.advertised).toBe(false);
    await until(()=>broadcasts.every(ads=>ads.length>=1));
    const expectedAd = {
      advertiserId:second.sessionId,name:'Bia',character:positions.get(second.sessionId)!.character,
      number:expect.any(Number),
    };
    expect(broadcasts).toEqual([[expectedAd],[expectedAd],[expectedAd]]);
    expect(broadcasts[0][0]).toEqual(broadcasts[1][0]);
    expect(broadcasts[0][0]).toEqual(broadcasts[2][0]);
    const previousMatch = secondView!.politics!.progression.matchId;
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

    second.send('start-match',{npcs:0,token:1860});
    await until(() => [secondView,thirdView].every(view =>
      view?.phase==='negotiation' && view.politics?.progression.matchId===previousMatch+1));
    for (const view of [secondView!,thirdView!]) {
      expect(view.politics).toMatchObject({wallet:8,walletIncome:0,evidence:[],ledger:[],incoming:[]});
      expect(view.politics?.outgoing).toBeUndefined();
      expect(view.gameplay?.inventory).toEqual([]);
      expect(view.budget).toBe(ELECTION_RULES.startingBudget);
    }
    // The current view can change independently of the room's command sequence.
    second.send('politics',transfer);
    await walkTo(second,stations.press);
    second.send('election',{kind:'advertise',token:1870});
    await until(() => secondView?.election?.personal?.advertised===true);
    const secondMatchWallet = secondView!.politics!;
    expect(secondMatchWallet.wallet-secondMatchWallet.walletIncome).toBe(8-ELECTION_RULES.advertisementCost);
    expect(thirdView!.politics?.wallet).toBe(8);


    const solo = await new Client(endpoint).create('plenary',{nick:'Solo'});
    rooms.push(solo);
    let soloView:PlenaryView;
    solo.onMessage('players',() => {});
    solo.onMessage('control',() => {});
    solo.onMessage('photo-state',() => {});
    solo.onMessage('plenary',(view:PlenaryView) => { soloView = view; });
    solo.send('start-match',{npcs:0,token:1});
    await until(() => soloView?.phase==='negotiation');
    expect(soloView!).toMatchObject({solo:true,role:'Parlamentar',electorate:1,
      election:{personal:{office:'deputy'}}});

    const metricsResponse = await fetch(endpoint+'/metrics');
    expect(metricsResponse.headers.get('content-type')).toContain('version=0.0.4');
    const metrics = await metricsResponse.text();
    expect(metrics).toContain('congresso_matches_started_total 3\n');
    expect(metrics).toMatch(/congresso_simulation_ticks_total [1-9]\d*\n/);
    expect(metrics).not.toContain(solo.roomId);
    await solo.leave();
    const afterLeaving = await fetch(endpoint+'/metrics').then(response=>response.text());
    expect(afterLeaving).toMatch(/congresso_matches_finished_total [1-9]/);

    await Promise.all([second.leave(),third.leave()]);
    const full = await new Client(endpoint).create('plenary',{nick:'Lotação 1'});
    rooms.push(full);
    const lobby = [full];
    for (let index=1;index<MAX_PLAYERS;index++) {
      const peer = await new Client(endpoint).joinById(full.roomId,{nick:`Lotação ${index+1}`});
      rooms.push(peer);
      lobby.push(peer);
    }
    const active = new Set<string>();
    for (const peer of lobby) {
      track(peer);
      peer.onMessage('players',()=>{});
      peer.onMessage('plenary',(view:PlenaryView)=>{
        if (view.phase==='negotiation' && view.electorate===MAX_PLAYERS) active.add(peer.sessionId);
      });
    }
    full.send('start-match',{npcs:0,token:1});
    await until(()=>active.size===MAX_PLAYERS && lobby.every(peer=>controls.get(peer.sessionId)?.revision!==undefined));
    const readMetrics = async ()=>fetch(endpoint+'/metrics').then(response=>response.text());
    const ticks = (value:string)=>Number(value.match(/^congresso_simulation_ticks_total (\d+)$/m)?.[1]);
    const beforeBurst = await readMetrics();
    for (let input=1;input<=8;input++) {
      for (const peer of lobby) {
        peer.send('input',{seq:input,revision:controls.get(peer.sessionId)!.revision,motion:{x:0,y:input%2 ? 1 : -1}});
      }
      await Bun.sleep(40);
    }
    await until(()=>lobby.every(peer=>controls.get(peer.sessionId)?.ack===8));
    const afterBurst = await readMetrics();
    expect(afterBurst).toContain('congresso_matches_started_total 4\n');
    expect(ticks(afterBurst)).toBeGreaterThan(ticks(beforeBurst));
    expect(afterBurst).not.toContain(full.roomId);


  } finally {
    try {
      // A consented leave stops the SDK from reconnecting during cleanup.
      await Promise.allSettled(rooms.map(room => room.leave()));
    } finally {
      server.kill();
      await server.exited;
    }
  }
},65_000);

test('transport is released on an actual socket reconnect and on plenary admission', async () => {
  const {defineRoom,defineServer,matchMaker} = await import('colyseus');
  const {BunWebSockets} = await import('@colyseus/bun-websockets');
  const {gameplayMetrics} = await import('./gameplay-metrics');
  const {SessionRoom} = await import('./SessionRoom');
  const {PlenaryMatch} = await import('./PlenaryMatch');
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({
    gracefullyShutdown:false,transport:new BunWebSockets(),
    rooms:{plenary:defineRoom(SessionRoom)},
  });
  const rooms:Room[] = [];
  const wait = async (ready:()=>boolean,timeoutMs=3000) => {
    for (let elapsed=0;elapsed<timeoutMs;elapsed+=30) {
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
    const foodCues = new Map<string,string[]>();
    const interactionCues = new Map<string,InteractionCue[]>();
    const purchases = new Map<string,{id:number;kind:string}>();
    let visible:Player[] = [];
    const spyFrames = new Map<string,SpyCameraFrame>();
    const unconfirmedSpyFrames:SpyCameraFrame[] = [];
    const photoViews = new Map<string,PhotoAccessView>();
    const securityFrames = new Map<string,{camera:string;scene:PhotoScene}>();
    const feedback = new Map<string,string[]>();
    carrier.onMessage('players',(players:Player[])=>{visible = players;});
    for (const peer of rooms) {
      peer.onMessage('control',(state:{player:Player})=>snapshots.set(peer.sessionId,state.player));
      peer.onMessage('plenary',(view:PlenaryView)=>views.set(peer.sessionId,view));
      peer.onMessage('spy-frame',(frame:SpyCameraFrame)=>{
        if (views.get(peer.sessionId)?.gameplay?.surveillance?.selected!==frame.channel) unconfirmedSpyFrames.push(frame);
        spyFrames.set(peer.sessionId,frame);
      });
      peer.onMessage('security-frame',(frame:{camera:string;scene:PhotoScene})=>securityFrames.set(peer.sessionId,frame));
      const cues:string[] = [];
      foodCues.set(peer.sessionId,cues);
      peer.onMessage('food-consumed',(cue:string)=>cues.push(cue));
      const interactions:InteractionCue[] = [];
      interactionCues.set(peer.sessionId,interactions);
      peer.onMessage('interaction-cue',(cue:InteractionCue)=>interactions.push(cue));
      peer.onMessage('gear-purchased',(item:{id:number;kind:string})=>purchases.set(peer.sessionId,item));
      const notices:string[] = [];
      feedback.set(peer.sessionId,notices);
      peer.onMessage('gameplay-feedback',(message:string)=>notices.push(message));
      peer.onMessage('map-action-failed',(message:string)=>notices.push(message));
      peer.onMessage('photo-state',(view:PhotoAccessView)=>photoViews.set(peer.sessionId,view));
      for (const message of ['players','item-obtained']) peer.onMessage(message,()=>{});
    }
    const room = matchMaker.getLocalRoomById(carrier.roomId) as InstanceType<typeof SessionRoom>;
    // Set only the fixture position and deadline. Actions and results use the live socket.
    const positions = Reflect.get(room,'players') as Map<string,{player:Player}>;
    const match = new PlenaryMatch(1);
    Reflect.set(room,'match',match);
    carrier.send('start-match',{npcs:0,token:1});
    await wait(()=>views.get(carrier.sessionId)?.phase==='negotiation');
    const routes = new Map<string,[string,number,boolean?,boolean?][]>();
    for (const peer of rooms) {
      peer.onMessage('voice-range',(levels:[string,number,boolean?,boolean?][])=>routes.set(peer.sessionId,levels));
      peer.onMessage('voice-send',()=>{});
      peer.onMessage('voice-roster',()=>{});
      peer.send('voice-join');
    }
    Object.assign(positions.get(carrier.sessionId)!.player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    Object.assign(positions.get(passenger.sessionId)!.player,{x:140,y:146});
    const gearView = ()=>views.get(carrier.sessionId)?.gameplay;
    await wait(()=>routes.has(passenger.sessionId));
    expect(routes.get(passenger.sessionId)?.some(([id])=>id===carrier.sessionId)).toBe(false);
    carrier.send('gameplay',{action:{kind:'call',target:passenger.sessionId},token:2840});
    await wait(()=>views.get(passenger.sessionId)?.gameplay?.call?.state==='incoming');
    expect(gearView()?.call?.state).toBe('outgoing');
    expect(routes.get(passenger.sessionId)).toEqual([]);
    expect(routes.get(carrier.sessionId)).toEqual([]);
    passenger.send('gameplay',{action:{kind:'answer'},token:1});
    await wait(()=>gearView()?.call?.state==='connected' &&
      routes.get(passenger.sessionId)?.some(([id,level])=>id===carrier.sessionId && level===1)===true);
    expect(routes.get(carrier.sessionId)).toEqual([[passenger.sessionId,1,true,undefined]]);
    expect(gearView()?.call?.state).toBe('connected');
    passenger.send('gameplay',{action:{kind:'hangup'},token:2});
    await wait(()=>!gearView()?.call && routes.get(carrier.sessionId)?.length===0 && routes.get(passenger.sessionId)?.length===0);
    carrier.send('gameplay',{action:{kind:'call',target:passenger.sessionId},token:2860});
    await wait(()=>views.get(passenger.sessionId)?.gameplay?.call?.state==='incoming');
    passenger.send('gameplay',{action:{kind:'answer'},token:3});
    await wait(()=>gearView()?.call?.state==='connected');
    passenger.send('voice-leave');
    passenger.send('voice-join');
    await wait(()=>!gearView()?.call && !views.get(passenger.sessionId)?.gameplay?.call);
    carrier.send('gameplay',{action:{kind:'talk',target:'vendor'},token:2900});
    await wait(()=>!!gearView()?.dialogue);
    carrier.send('gameplay',{action:{kind:'dialogue-choice',target:'products',token:gearView()?.dialogue?.token},token:2920});
    await wait(()=>gearView()?.dialogue?.shop===true);
    carrier.send('gameplay',{action:{kind:'shop-buy',target:'megaphone',token:gearView()?.dialogue?.token},token:2940});
    await wait(()=>!!gearView()?.inventory.find(item=>item.kind==='megaphone'));
    carrier.send('gameplay',{action:{kind:'equip',item:gearView()?.inventory.find(item=>item.kind==='megaphone')?.id},token:2960});
    await wait(()=>!!gearView()?.equipped?.find(item=>item.kind==='megaphone'));
    carrier.send('gameplay',{action:{kind:'toggle-megaphone'},token:2980});
    await wait(()=>views.get(passenger.sessionId)?.megaphoneActive===true && routes.get(passenger.sessionId)?.some(([id,,,filtered])=>id===carrier.sessionId && filtered===true)===true);
    expect(views.get(carrier.sessionId)?.megaphoneActive).toBeUndefined();
    expect(routes.get(passenger.sessionId)).toEqual([[carrier.sessionId,.85,false,true]]);
    Object.assign(positions.get(passenger.sessionId)!.player,{x:npcs.vendor.x+9,y:npcs.vendor.y+11});
    await Bun.sleep(120);
    expect(routes.get(passenger.sessionId)).toEqual([[carrier.sessionId,.85,false,true]]);
    carrier.send('gameplay',{action:{kind:'toggle-megaphone'},token:3040});
    await wait(()=>views.get(passenger.sessionId)?.megaphoneActive===undefined && routes.get(passenger.sessionId)?.some(([id,,local,filtered])=>id===carrier.sessionId && local===true && !filtered)===true);
    carrier.send('voice-leave');
    passenger.send('voice-leave');
    carrier.send('gameplay',{action:{kind:'dialogue-close'},token:3080});
    await wait(()=>!gearView()?.dialogue);
    purchases.clear();
    const carrierAccount = Reflect.get(Reflect.get(match,'economy'),'accounts').get(carrier.sessionId);
    carrierAccount.wallet += 4;
    const progression = () => views.get(passenger.sessionId)?.politics?.progression;
    const economy = Reflect.get(match,'economy');
    const account = Reflect.get(economy,'accounts').get(passenger.sessionId);
    account.progression.earn(430);
    await wait(()=>progression()?.level===4 && progression()?.available===3);
    const request = {attribute:'stamina',revision:0,matchId:progression()!.matchId};
    passenger.send('allocate-attribute',request);
    passenger.send('allocate-attribute',request);
    await wait(()=>progression()?.revision===1);
    expect(progression()).toMatchObject({available:2,invested:{stamina:1}});
    expect(snapshots.get(passenger.sessionId)?.staminaMax).toBe(150);
    expect(views.get(carrier.sessionId)?.politics?.progression).toMatchObject({level:1,xp:0});
    Object.assign(positions.get(carrier.sessionId)!.player,{x:npcs.vendor.x,y:npcs.vendor.y+11,direction:1});
    Object.assign(positions.get(passenger.sessionId)!.player,{x:240,y:250});
    const record = Reflect.get(match,'recordGameplay').bind(match);
    let coffeeEvent:GameplayEvent|undefined;
    Reflect.set(match,'recordGameplay',(event:GameplayEvent)=>{
      const accepted = record(event);
      if (accepted && event.type==='used' && event.kind==='coffee') coffeeEvent = event;
      return accepted;
    });
    const coffeeResults:string[] = [];
    passenger.onMessage('room-activity-result',({text}:{text:string})=>coffeeResults.push(text));
    passenger.send('room-activity',{activity:'coffee',token:3270});
    passenger.send('room-activity',{activity:'coffee',token:3270});
    passenger.send('room-activity',{activity:'coffee',token:3271});
    await wait(()=>views.get(passenger.sessionId)?.politics?.missions.completed.some(mission=>mission.kind==='cafe')===true);
    await wait(()=>feedback.get(passenger.sessionId)?.includes(stationRecharge.coffee.feedback)===true);
    expect(coffeeResults).toEqual(['Café bebido.']);
    expect(feedback.get(carrier.sessionId)).not.toContain(stationRecharge.coffee.feedback);
    expect(coffeeEvent?.eventId).toBeDefined();
    Reflect.set(match,'recordGameplay',record);
    Reflect.get(room,'gameplayWorld').call(room).publish({...coffeeEvent});
    expect(views.get(carrier.sessionId)?.politics?.missions.completed.some(mission=>mission.kind==='cafe')).toBe(false);
    const gameplaySystem = Reflect.get(room,'gameplay');
    const snack = gameplaySystem.create('coxinha',{holder:passenger.sessionId});
    const beverage = gameplaySystem.create('energyDrink',{holder:passenger.sessionId});
    passenger.send('gameplay',{action:{kind:'use',item:snack.id},token:3280});
    passenger.send('gameplay',{action:{kind:'use',item:snack.id},token:3281});
    passenger.send('gameplay',{action:{kind:'use',item:beverage.id},token:3282});
    await wait(()=>foodCues.get(passenger.sessionId)?.length===3);
    expect(foodCues.get(passenger.sessionId)).toEqual(['drink','eat','drink']);
    expect(foodCues.get(carrier.sessionId)).toEqual([]);
    const briefcase = gameplaySystem.create('briefcase',{holder:passenger.sessionId});
    const passengerInventory = () => views.get(passenger.sessionId)?.gameplay?.inventory ?? [];
    await wait(()=>passengerInventory().some(item=>item.id===briefcase.id));
    const delivery = treasuryDeliveries(passengerInventory()).find(option=>option.action.item===briefcase.id && option.action.target==='partial')!.action;
    passenger.send('gameplay',{action:delivery,token:3283});
    await wait(()=>feedback.get(passenger.sessionId)?.includes('Leve a maleta à Tesouraria.')===true);
    expect(interactionCues.get(passenger.sessionId)).toEqual([]);
    Object.assign(positions.get(passenger.sessionId)!.player,terminals.treasury.point);
    const beforeDelivery = views.get(passenger.sessionId)!.budget;
    passenger.send('gameplay',{action:delivery,token:3284});
    passenger.send('gameplay',{action:delivery,token:3285});
    await wait(()=>feedback.get(passenger.sessionId)?.includes('O valor da maleta mudou.')===true);
    await wait(()=>passengerInventory().some(item=>item.id===briefcase.id && item.cash===1.5));
    expect(interactionCues.get(passenger.sessionId)).toEqual(['cash']);
    expect(interactionCues.get(carrier.sessionId)).toEqual([]);
    expect(views.get(passenger.sessionId)!.budget).toBeCloseTo(beforeDelivery+1.5);
    const remainder = treasuryDeliveries(passengerInventory()).find(option=>option.action.item===briefcase.id && !option.action.target)!.action;
    passenger.send('gameplay',{action:remainder,token:3286});
    await wait(()=>!passengerInventory().some(item=>item.id===briefcase.id));
    expect(views.get(passenger.sessionId)!.budget).toBeCloseTo(beforeDelivery+3);
    // Replay a delivered event through the same publisher that sends browser audio cues.
    const playback = Reflect.get(room,'gameplayWorld').call(room);
    const cueEvent:GameplayEvent = {type:'delivered',actor:passenger.sessionId,item:999,place:'treasury',
      position:terminals.treasury.point,at:playback.now,eventId:playback.nextEventId(),witnesses:[]};
    playback.publish(cueEvent);
    playback.publish({...cueEvent});
    // The stamp is an ordering barrier on the same socket.
    playback.publish({...cueEvent,type:'stamped',eventId:playback.nextEventId()});
    await wait(()=>interactionCues.get(passenger.sessionId)?.includes('stamp')===true);
    expect(interactionCues.get(passenger.sessionId)).toEqual(['cash','cash','cash','stamp']);
    expect(interactionCues.get(carrier.sessionId)).toEqual([]);
    Object.assign(positions.get(passenger.sessionId)!.player,{x:npcs.vendor.x+9,y:npcs.vendor.y+11});
    const gameplay = ()=>views.get(carrier.sessionId)?.gameplay;
    carrier.send('gameplay',{action:{kind:'talk',target:'vendor'},token:3320});
    await wait(()=>!!gameplay()?.dialogue);
    carrier.send('gameplay',{action:{kind:'dialogue-choice',target:'products',token:gameplay()?.dialogue?.token},token:3340});
    await wait(()=>gameplay()?.dialogue?.shop===true);
    carrier.send('gameplay',{action:{kind:'shop-buy',target:'baton',token:gameplay()?.dialogue?.token},token:3360});
    await wait(()=>gameplay()?.inventory.some(item=>item.kind==='baton')===true);
    const purchase = purchases.get(carrier.sessionId);
    expect(purchase).toEqual(gameplay()?.inventory.find(item=>item.kind==='baton'));
    expect(purchases.has(passenger.sessionId)).toBe(false);
    carrier.send('gameplay',{action:{kind:'shop-buy',target:'spyCamera',token:gameplay()?.dialogue?.token},token:3410});
    await wait(()=>gameplay()?.inventory.some(item=>item.kind==='spyCamera')===true);
    const camera = gameplay()!.inventory.find(item=>item.kind==='spyCamera')!;
    Object.assign(positions.get(carrier.sessionId)!.player,{x:240,y:250});
    Object.assign(positions.get(passenger.sessionId)!.player,{x:245,y:252});
    carrier.send('spy',{kind:'install',site:'coffee',item:camera.id,token:3460});
    await wait(()=>gameplay()?.surveillance?.progress!==undefined);
    await Bun.sleep(5100);
    await wait(()=>gameplay()?.surveillance?.channels.length===1);
    const {id:channel,name:cameraName} = gameplay()!.surveillance!.channels[0];
    Object.assign(positions.get(carrier.sessionId)!.player,{x:631,y:197,direction:1});
    passenger.send('spy',{kind:'open',channel,token:3520});
    carrier.send('spy',{kind:'open',channel,token:3530});
    await wait(()=>spyFrames.get(carrier.sessionId)?.people.some(person=>person.id===passenger.sessionId)===true);
    expect(spyFrames.get(carrier.sessionId)?.channel).toBe(channel);
    expect(unconfirmedSpyFrames).toEqual([]);
    expect(spyFrames.has(passenger.sessionId)).toBe(false);
    expect(views.get(passenger.sessionId)?.gameplay?.surveillance?.channels).toEqual([]);
    expect(photoViews.get(carrier.sessionId)?.album).toEqual([]);
    expect(photoViews.get(passenger.sessionId)?.album).toEqual([]);
    carrier.send('spy',{kind:'capture',channel:channel+1,token:3540});
    await wait(()=>feedback.get(carrier.sessionId)?.includes('O canal da câmera mudou.')===true);
    expect(photoViews.get(carrier.sessionId)?.album).toEqual([]);
    passenger.send('spy',{kind:'capture',channel,token:3540});
    await wait(()=>feedback.get(passenger.sessionId)?.includes('O canal da câmera mudou.')===true);
    carrier.send('spy',{kind:'capture',channel,token:3550});
    await wait(()=>photoViews.get(carrier.sessionId)?.album.length===1);
    expect(photoViews.get(carrier.sessionId)?.album[0].photo.source).toEqual({kind:'surveillance',channel:cameraName});
    expect(photoViews.get(passenger.sessionId)?.album).toEqual([]);
    carrier.send('spy',{kind:'close',token:3580});
    carrier.send('spy',{kind:'open',channel,token:3530});
    await wait(()=>gameplay()?.surveillance?.selected===undefined);

    for (const playerAccount of [carrierAccount,account]) {
      Reflect.set(playerAccount.agenda,'missions',[]);
      Reflect.set(playerAccount.agenda,'missionDeck',['vigilanciaInstitucional','cafe','passeio','selfieSolo']);
    }
    match.refreshAgendaEligibility();
    const cameraMission = (id:string)=>views.get(id)?.politics?.missions.active.find(mission=>mission.kind==='vigilanciaInstitucional');
    const completedCameraMission = ()=>views.get(carrier.sessionId)?.politics?.missions.completed.find(mission=>mission.kind==='vigilanciaInstitucional');
    await wait(()=>cameraMission(carrier.sessionId)?.current===0 && cameraMission(passenger.sessionId)?.current===0);

    carrier.send('security-camera',{kind:'open',token:3590});
    await Bun.sleep(150);
    expect(gameplay()?.security).toBeUndefined();
    expect(securityFrames.has(carrier.sessionId)).toBe(false);
    expect(cameraMission(carrier.sessionId)?.current).toBe(0);

    Object.assign(positions.get(carrier.sessionId)!.player,{x:securityRoom.terminal.x,y:securityRoom.terminal.y+15});
    await wait(()=>!!gameplay()?.security);
    carrier.send('security-camera',{kind:'open',token:3600});
    await wait(()=>securityFrames.get(carrier.sessionId)?.camera==='corridor' && cameraMission(carrier.sessionId)?.current===1);
    carrier.send('security-camera',{kind:'select',camera:'corridor',token:3601});
    carrier.send('security-camera',{kind:'select',camera:'invalid',token:3602});
    await Bun.sleep(150);
    expect(cameraMission(carrier.sessionId)?.current).toBe(1);
    expect(completedCameraMission()).toBeUndefined();
    const xpBeforeCamera = views.get(carrier.sessionId)!.politics!.progression.xp;
    Object.assign(positions.get(passenger.sessionId)!.player,{x:219,y:216});
    carrier.send('security-camera',{kind:'select',camera:'coffee',token:3610});
    await wait(()=>securityFrames.get(carrier.sessionId)?.scene.people.some(person=>person.id===passenger.sessionId)===true);
    expect(gameplay()?.security?.camera).toBe('coffee');
    await wait(()=>completedCameraMission()?.current===2);
    expect(views.get(carrier.sessionId)!.politics!.progression.xp).toBe(xpBeforeCamera+25);
    expect(cameraMission(passenger.sessionId)?.current).toBe(0);
    expect(securityFrames.has(passenger.sessionId)).toBe(false);

    Object.assign(positions.get(carrier.sessionId)!.player,{x:712,y:337});
    await wait(()=>gameplay()?.security===undefined);
    securityFrames.delete(carrier.sessionId);
    await Bun.sleep(150);
    expect(securityFrames.has(carrier.sessionId)).toBe(false);
    Object.assign(positions.get(carrier.sessionId)!.player,{x:631,y:197,direction:1});
    Object.assign(positions.get(passenger.sessionId)!.player,{x:npcs.vendor.x,y:npcs.vendor.y+11});
    const passengerGameplay = ()=>views.get(passenger.sessionId)?.gameplay;
    passenger.send('gameplay',{action:{kind:'talk',target:'vendor'},token:3630});
    await wait(()=>!!passengerGameplay()?.dialogue);
    passenger.send('gameplay',{action:{kind:'dialogue-choice',target:'products',token:passengerGameplay()?.dialogue?.token},token:3650});
    await wait(()=>passengerGameplay()?.dialogue?.shop===true);
    passenger.send('gameplay',{action:{kind:'shop-buy',target:'xray',token:passengerGameplay()?.dialogue?.token},token:3670});
    await wait(()=>passengerGameplay()?.inventory.some(item=>item.kind==='xray')===true);
    passenger.send('gameplay',{action:{kind:'equip',item:passengerGameplay()?.inventory.find(item=>item.kind==='xray')?.id},token:3690});
    await wait(()=>passengerGameplay()?.equipped?.some(item=>item.kind==='xray')===true);
    const safe = privateOffices.find(office=>office.id===gameplay()?.ownOffice)!;
    Object.assign(positions.get(passenger.sessionId)!.player,safe.safe);
    for (let repeat=0;repeat<2;repeat++) passenger.send('gameplay',{action:{kind:'scan-xray'},token:3730});
    await wait(()=>passengerGameplay()?.equipped?.find(item=>item.kind==='xray')?.charges===2);
    expect(passengerGameplay()?.xrayVision?.targets).toContainEqual(expect.objectContaining({id:safe.id,balance:views.get(carrier.sessionId)?.politics?.wallet}));
    expect(gameplay()?.xrayVision).toBeUndefined();
    expect(feedback.get(passenger.sessionId)?.filter(message=>message==='Raio X ativado.')).toHaveLength(1);
    expect(feedback.get(carrier.sessionId)?.includes('Raio X ativado.')).toBe(false);
    Object.assign(positions.get(passenger.sessionId)!.player,{x:640,y:197});
    carrier.send('gameplay',{action:{kind:'equip',item:purchase?.id},token:3800});
    await wait(()=>gameplay()?.equipped?.some(item=>item.kind==='baton')===true);
    for (let token=3;token<=6;token++) {
      carrier.send('gameplay',{action:{kind:'attack'},token:3830+token});
      if (token===3) await wait(()=>visible.some(player=>player.id===passenger.sessionId && player.health===.74 && player.hit!==undefined));
      if (token<6) await Bun.sleep(1300);
    }
    await wait(()=>snapshots.get(passenger.sessionId)?.knockedOut===true);
    carrier.send('gameplay',{action:{kind:'carry',target:passenger.sessionId},token:3880});
    await wait(()=>snapshots.get(passenger.sessionId)?.carried===true);
    const progressionBeforeReconnect = progression();
    const gearBeforeReconnect = views.get(passenger.sessionId)?.gameplay?.equipped;
    const walletBeforeReconnect = views.get(passenger.sessionId)?.politics?.wallet;
    expect(gearBeforeReconnect?.find(item=>item.kind==='xray')?.charges).toBe(2);
    const agendaBeforeReconnect = views.get(passenger.sessionId)?.politics?.missions;
    expect(agendaBeforeReconnect?.active).toHaveLength(3);
    const reconnectCount = () => Number(gameplayMetrics.exposition().match(/^congresso_reconnects_total (\d+)$/m)?.[1]);
    const beforeReconnect = reconnectCount();
    let reconnected = false;
    passenger.reconnection.minUptime = 0;
    passenger.onReconnect(()=>{reconnected = true;});
    views.delete(passenger.sessionId);
    passenger.connection.close(4010);
    await wait(()=>!snapshots.get(carrier.sessionId)?.carrying);
    await wait(()=>reconnected && views.has(passenger.sessionId) && snapshots.get(passenger.sessionId)?.carried===undefined);
    expect(reconnectCount()).toBe(beforeReconnect+1);
    let latency:number|undefined;
    passenger.ping(milliseconds=>{ latency = milliseconds; });
    await wait(()=>latency!==undefined);
    expect(latency).toBeGreaterThanOrEqual(0);
    expect(snapshots.get(passenger.sessionId)?.knockedOut).toBe(true);
    expect(views.get(passenger.sessionId)?.politics?.missions).toEqual(agendaBeforeReconnect);
    expect(progression()).toEqual(progressionBeforeReconnect);
    expect(views.get(passenger.sessionId)?.gameplay?.equipped).toEqual(gearBeforeReconnect);
    expect(views.get(passenger.sessionId)?.politics?.wallet).toBe(walletBeforeReconnect);
    const passengerOffice = views.get(passenger.sessionId)?.gameplay?.ownOffice;
    expect(passengerOffice).toBeDefined();
    carrier.send('gameplay',{action:{kind:'carry',target:passenger.sessionId},token:4100});
    await wait(()=>snapshots.get(passenger.sessionId)?.carried===true);
    const carrierControl = positions.get(carrier.sessionId)! as ControlState;
    const oldRevision = carrierControl.revision;
    const filingAt = room.clock.currentTime;
    publishProjectFiling(match,carrierControl.player,0,filingAt);
    Reflect.get(match,'proposal').voteAt = filingAt+5000;
    await wait(()=>views.get(carrier.sessionId)?.ballotCountdown===5 && carrierControl.revision!==oldRevision);
    const {x,y} = carrierControl.player;
    const ack = carrierControl.ack;
    const intents = views.get(carrier.sessionId)?.voteIntents;
    carrier.send('input',{seq:ack+1,revision:carrierControl.revision,motion:{x:1,y:0}});
    carrier.send('bill-intent',{vote:'yes',token:4110});
    await Bun.sleep(150);
    expect(views.get(carrier.sessionId)?.ballotCountdown).toBeDefined();
    expect(carrierControl.player).toMatchObject({x,y,moving:false});
    expect(carrierControl.ack).toBe(ack);
    expect(views.get(carrier.sessionId)?.voteIntents).toEqual(intents);
    Reflect.get(match,'proposal').voteAt = room.clock.currentTime;
    await wait(()=>views.get(passenger.sessionId)?.phase==='ballot' &&
      snapshots.get(passenger.sessionId)?.x===PLENARY_SEATS[1].x &&
      snapshots.get(passenger.sessionId)?.y===PLENARY_SEATS[1].y);
    expect(views.get(passenger.sessionId)?.ballotCountdown).toBeUndefined();
    expect(snapshots.get(passenger.sessionId)?.carried).toBeUndefined();
    expect(views.get(passenger.sessionId)?.gameplay?.ownOffice).toBe(passengerOffice);
    expect(snapshots.get(passenger.sessionId)?.knockedOut).toBe(true);
    const openedBallot = views.get(passenger.sessionId)!;
    const stamina = carrierControl.player.stamina;
    const ballotAck = carrierControl.ack;
    carrier.send('input',{seq:ballotAck+1,revision:carrierControl.revision,plenary:true,motion:{x:1,y:0}});
    carrier.send('gameplay',{action:{kind:'attack'},token:4170});
    await wait(()=>carrierControl.ack===ballotAck+1 && carrierControl.player.swing!==undefined);
    expect(carrierControl.player.stamina).toBeLessThan(stamina!);
    await wait(()=>views.get(passenger.sessionId)!.remaining<openedBallot.remaining);
    expect(views.get(passenger.sessionId)).toMatchObject({
      sessionRemaining:openedBallot.sessionRemaining,
      payroll:openedBallot.payroll,
      budget:openedBallot.budget,
    });
    expect(carrierControl.ack).toBe(ballotAck+1);
    expect(carrierControl.player.x).toBeGreaterThan(PLENARY_SEATS[0].x);
    expect(views.get(passenger.sessionId)?.gameplay?.vitality).toBeDefined();
    passenger.send('bill-vote',{vote:'yes',token:4180});
    await wait(()=>views.get(passenger.sessionId)?.vote==='yes');
    const infraction = views.get(passenger.sessionId)?.complaints?.available[0];
    expect(infraction).toMatchObject({kind:'hit'});
    expect(views.get(carrier.sessionId)?.complaints?.available).toEqual([]);
    Reflect.set(match,'voteEndsAt',room.clock.currentTime);
    await wait(()=>views.get(passenger.sessionId)?.phase==='negotiation');
    await wait(()=>!snapshots.get(passenger.sessionId)?.knockedOut,9000);
    Object.assign(positions.get(passenger.sessionId)!.player,stations.audit);
    passenger.send('complaint-submit',{id:infraction!.id,token:4260});
    await wait(()=>views.get(carrier.sessionId)?.complaints?.history.some(entry=>entry.id===infraction!.id)===true);
    expect(views.get(carrier.sessionId)?.complaints?.history[0]).toMatchObject({kind:'hit',accused:positions.get(carrier.sessionId)!.player.nick});

    Object.assign(carrierControl.player,stations.coffee);
    for (let slot=gameplay()?.inventory.length ?? 0;slot<INVENTORY_SLOTS;slot++) {
      gameplaySystem.create('portrait',{holder:carrier.sessionId});
    }
    const onFloor = gameplaySystem.create('extinguisher',{ground:stations.coffee});
    await wait(()=>gameplay()?.nearby.some(item=>item.id===onFloor.id)===true);
    carrier.send('gameplay',{action:{kind:'collect',item:onFloor.id},token:4302});
    await wait(()=>feedback.get(carrier.sessionId)?.includes('Inventário cheio.')===true);
    expect(gameplay()?.inventory.some(item=>item.id===onFloor.id)).toBe(false);
    expect(gameplay()?.nearby.some(item=>item.id===onFloor.id)).toBe(true);
    expect(feedback.get(passenger.sessionId)).not.toContain('Inventário cheio.');

  } finally {
    await Promise.allSettled(rooms.map(room=>room.leave()));
    await server.gracefullyShutdown(false);
  }
},35_000);

test('six human clients can select eight NPCs and fill the available seats when the vote opens',async()=>{
  const {defineRoom,defineServer,matchMaker} = await import('colyseus');
  const {BunWebSockets} = await import('@colyseus/bun-websockets');
  const {SessionRoom} = await import('./SessionRoom');
  const {gameplayMetrics} = await import('./gameplay-metrics');
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)}});
  const rooms:Room[] = [];
  const wait = async (ready:()=>boolean) => {
    for (let i=0;i<100;i++) {
      if (ready()) return;
      await Bun.sleep(30);
    }
    throw new Error('Expected plenary seating snapshot');
  };
  try {
    await server.listen(port,'127.0.0.1');
    const client = new Client(`http://127.0.0.1:${port}`);
    const host = await client.create('plenary',{nick:'Pessoa 1'});
    rooms.push(host);
    for (let i=2;i<=6;i++) rooms.push(await client.joinById(host.roomId,{nick:`Pessoa ${i}`}));
    const states = new Map<string,Player[]>();
    const phases = new Map<string,PlenaryView['phase']>();
    const npcCounts = new Map<string,number|undefined>();
    const roles = new Map<string,PlenaryView['role']>();
    for (const peer of rooms) {
      peer.onMessage('players',(players:Player[])=>states.set(peer.sessionId,players));
      peer.onMessage('plenary',(view:PlenaryView)=>{
        phases.set(peer.sessionId,view.phase);
        npcCounts.set(peer.sessionId,view.lobbyNpcCount);
        roles.set(peer.sessionId,view.role);
      });
      for (const key of ['control','mail-state','mail-reports','photo-state']) peer.onMessage(key,()=>{});
    }
    host.send('lobby-npc-count',{count:8,token:1});
    await wait(()=>rooms.every(peer=>npcCounts.get(peer.sessionId)===8));
    const room = matchMaker.getLocalRoomById(host.roomId) as InstanceType<typeof SessionRoom>;
    const guest = rooms[1];
    guest.send('lobby-npc-count',{count:0,token:1});
    const commandTokens:Map<string,number> = Reflect.get(room,'lastRoomCommandToken');
    await wait(()=>commandTokens.get(guest.sessionId)===1);
    expect(Reflect.get(room,'lobbyNpcCount')).toBe(8);
    host.send('lobby-phone-games',{enabled:false,token:2});
    await wait(()=>Reflect.get(room,'phoneGamesEnabled')===false);
    guest.send('lobby-phone-games',{enabled:true,token:2});
    await wait(()=>commandTokens.get(guest.sessionId)===2);
    expect(Reflect.get(room,'phoneGamesEnabled')).toBe(false);
    guest.send('lobby-project-voting',{enabled:false,token:3});
    await wait(()=>commandTokens.get(guest.sessionId)===3);
    expect(Reflect.get(room,'projectVotingEnabled')).toBe(true);
    host.send('start-match',{infiltrators:2,token:3});
    await wait(()=>rooms.every(peer=>phases.get(peer.sessionId)==='negotiation'));
    expect([...roles.values()].filter(role=>role==='Infiltrado')).toHaveLength(2);
    host.send('lobby-phone-games',{enabled:true,token:4});
    await wait(()=>commandTokens.get(host.sessionId)===4);
    expect(Reflect.get(room,'phoneGamesEnabled')).toBe(false);
    expect(Reflect.get(room,'gameplay').phoneGamesEnabled).toBe(false);
    const observer = Reflect.get(room,'players').get(host.sessionId).player as Player;
    const [walkingNpc] = Reflect.get(room,'parliamentarians').players as Player[];
    Object.assign(observer,{x:30,y:197});
    Object.assign(walkingNpc,{x:30,y:229,knockedOut:true});
    await wait(()=>states.get(host.sessionId)?.some(player=>player.id===walkingNpc.id)===true);
    Object.assign(observer,{x:30,y:146});
    await wait(()=>states.get(host.sessionId)?.some(player=>player.id===walkingNpc.id)===false);
    walkingNpc.knockedOut = undefined;
    const match: import('./PlenaryMatch').PlenaryMatch = Reflect.get(room,'match');
    publishProjectFiling(match,observer,0,room.clock.currentTime);
    Reflect.get(match,'proposal').voteAt = room.clock.currentTime;
    await wait(()=>rooms.every(peer=>phases.get(peer.sessionId)==='ballot' && states.get(peer.sessionId)?.length===12));
    const expected = PLENARY_SEATS.map(({x,y})=>`${x},${y}`).sort();
    for (const peer of rooms) {
      const players = states.get(peer.sessionId)!;
      expect(players.filter(player=>player.npc)).toHaveLength(6);
      expect(players.map(({x,y})=>`${x},${y}`).sort()).toEqual(expected);
    }

    const count = ()=>Number(gameplayMetrics.exposition().match(/^congresso_economy_discrepancies_total (\d+)$/m)?.[1]);
    const previous = count();
    const alerts:unknown[] = [];
    const error = console.error;
    console.error = (...args)=>{
      const [message] = args;
      if (typeof message==='string' && message.startsWith('{"event":"economy-discrepancy"')) alerts.push(JSON.parse(message));
      else error(...args);
    };
    try {
      const match = Reflect.get(room,'match');
      const economy = Reflect.get(match,'economy');
      // Inject an untracked credit, then finish through actual socket departures.
      Reflect.get(economy,'accounts').get(host.sessionId).wallet += 1;
      const physical = Reflect.get(room,'gameplay').physicalCash();
      expect(match.economySummary(physical).discrepancy).toBe(-1);
      await Promise.all(rooms.slice(2).map(peer=>peer.leave()));
      await wait(()=>phases.get(host.sessionId)==='finished');
      expect(count()).toBe(previous+1);
      expect(alerts).toEqual([{event:'economy-discrepancy',roomId:host.roomId,discrepancy:-1}]);
      await Promise.all(rooms.slice(0,2).map(peer=>peer.leave()));
      expect(count()).toBe(previous+1);
      expect(alerts).toHaveLength(1);
    } finally {
      console.error = error;
    }
  } finally {
    await Promise.allSettled(rooms.map(peer=>peer.leave()));
    await server.gracefullyShutdown(false);
  }
});

test.each([true,false])('the ordinary lobby starts solo with project voting=%s',async(projectsEnabled)=>{
  const {defineRoom,defineServer,matchMaker} = await import('colyseus');
  const {BunWebSockets} = await import('@colyseus/bun-websockets');
  const {SessionRoom} = await import('./SessionRoom');
  const reservation = Bun.serve({hostname:'127.0.0.1',port:0,fetch:()=>new Response()});
  const port = reservation.port!;
  await reservation.stop();
  const server = defineServer({gracefullyShutdown:false,transport:new BunWebSockets(),rooms:{plenary:defineRoom(SessionRoom)}});
  let host:Room|undefined;
  const wait = async (condition:()=>boolean) => {
    for (let attempt=0;attempt<100;attempt++) {
      if (condition()) return;
      await Bun.sleep(25);
    }
    throw new Error('Expected solo room snapshot');
  };
  try {
    await server.listen(port,'127.0.0.1');
    host = await new Client(`http://127.0.0.1:${port}`).create('plenary',{nick:'Sala solo'});
    let view:PlenaryView|undefined;
    let snapshot:Player[] = [];
    host.onMessage('plenary',(next:PlenaryView)=>{ view = next; });
    host.onMessage('players',(next:Player[])=>{ snapshot = next; });
    for (const message of ['control','mail-state','mail-reports','photo-state']) host.onMessage(message,()=>{});
    await wait(()=>view?.botsToFill===5);
    expect(view).toMatchObject({phase:'lobby',minimumPlayers:1,players:1});
    host.send('lobby-project-voting',{enabled:projectsEnabled,token:1});
    await wait(()=>view?.projectVotingEnabled===projectsEnabled);
    host.send('start-match',{infiltrators:2,npcs:8,token:2});
    await wait(()=>view?.phase==='negotiation');
    expect(view).toMatchObject({players:6,electorate:6});
    const room = matchMaker.getLocalRoomById(host.roomId) as InstanceType<typeof SessionRoom>;
    const match:import('./PlenaryMatch').PlenaryMatch = Reflect.get(room,'match');
    const controls:Map<string,ControlState> = Reflect.get(room,'players');
    const players = [...controls.keys()];
    expect(players.filter(id=>match.view(id,players,room.clock.currentTime).role==='Infiltrado')).toHaveLength(2);
    if (!projectsEnabled) {
      host.send('lobby-project-voting',{enabled:true,token:3});
      const commandTokens:Map<string,number> = Reflect.get(room,'lastRoomCommandToken');
      await wait(()=>commandTokens.get(host!.sessionId)===3);
      expect(Reflect.get(room,'projectVotingEnabled')).toBe(false);
      expect(Reflect.get(room,'gameplay').projectVotingEnabled).toBe(false);
      expect(()=>publishProjectFiling(match,controls.get(host!.sessionId)!.player,0,room.clock.currentTime)).toThrow('desativadas');
      return;
    }
    publishProjectFiling(match,controls.get(host.sessionId)!.player,0,room.clock.currentTime);
    Reflect.get(match,'proposal').voteAt = room.clock.currentTime;
    await wait(()=>view?.phase==='ballot' && snapshot.length===12);
    expect(snapshot.filter(player=>player.bot && !player.npc)).toHaveLength(5);
    expect(snapshot.filter(player=>player.npc && !player.bot)).toHaveLength(6);
    expect(view?.billVoters).toHaveLength(6);
  } finally {
    if (host) await host.leave();
    await server.gracefullyShutdown(false);
  }
});
