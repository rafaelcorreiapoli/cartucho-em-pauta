import { gameplayMetrics } from './gameplay-metrics';
import { isFood } from '../src/food';
import { InternalMail } from './InternalMail';
import { megaphone } from '../src/equipment';
import { Parliamentarians } from './Parliamentarians';
import { ParliamentarianTalk } from './ParliamentarianTalk';
import { npcRules } from '../src/parliamentarians';
import { readAttributeRequest } from '../src/progression';
import { characterStats } from '../src/character-stats';
import { emptyPhotoAccess } from '../src/photography';
import { consumableAction, canUseGameplayAction, readGameplayAction } from '../src/gameplay';
import { Gameplay } from './Gameplay';
import { isGear } from '../src/equipment';
import { roomActivities, type RoomActivity } from '../src/room-activities';
import { readElectionAction } from '../src/elections';
import { readVoiceSignal } from '../src/voice-protocol';
import { Room, ServerError, type Client } from 'colyseus';
import { isolationRoom, localPerception, characterVisible, NAMES, PLENARY_SEATS, inPlenary, type Player } from '../src/map';
import { applyInput, MAX_QUEUED_INPUTS, MAX_STAMINA, readInput, restMovement, STEP_MS, type ControlState, type MovementInput } from '../src/movement';

import { readPoliticsAction } from '../src/politics';
import { readRoomCommandToken } from '../src/room-commands';
import { INVALID_NICK, NICK_TAKEN, nickHint, nickKey, readNick } from '../src/nick';
import { MAX_PLAYERS } from '../src/plenary';
import { PlenaryMatch } from './PlenaryMatch';

function countFromStart(request:unknown,lobbyCount:number) {
  if (!request || typeof request!=='object') return 0;
  if (!('npcs' in request)) return lobbyCount;
  return typeof request.npcs==='number' && Number.isInteger(request.npcs) ? Math.max(0,Math.min(3,request.npcs)) : npcRules.count;
}

export class SessionRoom extends Room {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = 100;
  autoBatchMessages = true;
  private players = new Map<string, ControlState>();
  private movementQueue = new Map<string, MovementInput[]>();

  private resetMovement(state:ControlState) {
    this.movementQueue.get(state.player.id)?.splice(0);
    state.route = [];
    state.revision = (state.revision ?? 0)+1;
  }

  private lobbyNpcCount:number = npcRules.count;
  private gameplay = new Gameplay();
  private lastRoomCommandToken = new Map<string,number>();
  private readonly internalMail = new InternalMail();
  private matchObjectsActive = false;
  private consumeRoomCommand(id:string,raw:unknown) {
    const token = readRoomCommandToken(raw);
    if (token===undefined || token<=(this.lastRoomCommandToken.get(id) ?? 0)) return false;
    this.lastRoomCommandToken.set(id,token);
    return true;
  }

  private gameplayWorld() {
    const world = this.match.gameplayWorld([...this.players.values()].map(({player})=>player).concat(this.parliamentarians.players),this.clock.currentTime,
      id=>this.voice.has(id));
    return {
      ...world,
      feedback:(id:string,message:string)=>this.clients.getById(id)?.send('gameplay-feedback',message),
      vision:(id:string)=>this.gameplay.vision(id,world.now),
      present:(id:string)=>!!this.clients.getById(id) || this.parliamentarians.players.some(player=>player.id===id),
      publish: (event:Parameters<typeof world.publish>[0]) => {
        world.publish(event);
        this.parliamentarians.witnessAggression(event);
        const pickup = event.type==='collected' || event.type==='recovered';
        const recipient = pickup ? event.actor : event.type==='transferred' ? event.target : event.type==='purchased' ? event.actor : undefined;
        if (recipient) this.clients.getById(recipient)?.send('item-obtained',pickup);
        if (event.type==='used' && isFood(event.kind)) {
          const drink = event.kind==='coffee' || event.kind==='energyDrink';
          this.clients.getById(event.actor)?.send('food-consumed',drink ? 'drink' : 'eat');
        }
        if (event.type==='purchased' && event.item!==undefined && isGear(event.kind)) {
          this.clients.getById(event.actor)?.send('gear-purchased',{id:event.item,kind:event.kind});
        } else if (event.type==='purchased' && event.item!==undefined && event.kind &&
          consumableAction({id:event.item,kind:event.kind})) {
          this.clients.getById(event.actor)?.send('consumable-purchased',event.inventoryItem ?? event.item);
        }
      },
    };
  }

  private match = new PlenaryMatch(process.env.SESSAO_LOCAL_SOLO==='1' || process.env.SESSAO_PREVIEW_SOLO==='1' || (process.env.NODE_ENV==='test' && process.env.SESSAO_TEST_MIN_PLAYERS==='1') ? 1 : undefined);
  private parliamentarians = new Parliamentarians();
  private npcTalk = new ParliamentarianTalk(this.parliamentarians,this.gameplay,this.match);
  private lastMatchView = new Map<string,string>();
  private lastPhotos = new Map<string,{revision:number; key:string}>();

  private voice = new Set<string>();

  private resetFinishedMatch(now:number) {
    if (!this.matchObjectsActive || this.match.running) return;
    this.matchObjectsActive = false;
    const summary = this.match.economySummary(this.gameplay.physicalCash());
    console.info(JSON.stringify({event:'economy-totals',roomId:this.roomId,...summary}));
    gameplayMetrics.finish(this.roomId,summary.discrepancy);
    this.npcTalk.reset();
    this.parliamentarians.reset(0,now);
    const players = [...this.players.values()].map(state=>state.player);
    this.gameplay.reset(now,Math.random,players);
    for (const player of players) player.speed = undefined;
    void this.unlock();
  }

  private leaveVoice(id: string) {
    const world = this.gameplayWorld();
    this.gameplay.disconnectCall(id,world);
    this.gameplay.stopMegaphone(id,world);
    this.match.stopBroadcast(id,this.clock.currentTime);
    if (this.voice.delete(id)) this.broadcast('voice-roster', [...this.voice]);
  }

  private spyFrameAt = 0;

  private lastMegaphone = new Map<string,boolean>();

  private routeVoice(speaker:string|undefined) {
    const participants = [...this.voice].flatMap(id=>{
      const player = this.players.get(id)?.player;
      return player ? [player] : [];
    });
    const spatial = this.match.phase==='negotiation';
    const broadcaster = spatial ? this.gameplay.megaphoneSpeaker() : undefined;
    for (const client of this.clients) {
      const active = !!broadcaster && client.sessionId!==broadcaster;
      if ((this.lastMegaphone.get(client.sessionId) ?? false)===active) continue;
      client.send('megaphone-active',active);
      this.lastMegaphone.set(client.sessionId,active);
    }
    const localVolume = (listener:Player, talker:Player) =>
      !spatial || talker.id===speaker || this.gameplay.callPeer(listener.id)===talker.id
        ? 1 : localPerception(listener,talker).volume;
    const volume = (listener:Player,talker:Player)=> {
      if (!spatial && (this.match.isolated(listener.id) || this.match.isolated(talker.id))) return 0;
      return talker.id===broadcaster ? megaphone.volume : Math.max(localVolume(listener,talker),spatial ? this.gameplay.spyVolume(listener,talker) : 0);
    };
    for (const player of participants) {
      const others = participants.filter(peer=>peer.id!==player.id);
      const client = this.clients.getById(player.id);
      if (!client) continue;
      client.send('voice-send',others.filter(peer=>volume(peer,player)>0).map(peer=>peer.id));
      if (spatial) {
        const levels = others.map(peer=>[peer.id,volume(player,peer),peer.id!==broadcaster && localVolume(player,peer)>0,peer.id===broadcaster || undefined] as const);
        client.send('voice-range',levels.filter(([,level])=>level>0));
      }
    }
  }

  onCreate() {
    this.onMessage('voice-join', client => {
      this.voice.add(client.sessionId);
      this.broadcast('voice-roster', [...this.voice]);
    });
    this.onMessage('voice-leave', client => this.leaveVoice(client.sessionId));
    this.onMessage('voice-signal', (client, message: unknown) => {
      if (!this.voice.has(client.sessionId) || !message || typeof message !== 'object' ||
        !('to' in message) || !('signal' in message) || typeof message.to !== 'string' ||
        message.to === client.sessionId || !this.voice.has(message.to)) return;
      const signal = readVoiceSignal(message.signal);
      if (signal) this.clients.getById(message.to)?.send('voice-signal', { from:client.sessionId, signal });
    });
    this.onMessage('lobby-npc-count',(client,raw:unknown)=>{
      if (!raw || typeof raw!=='object' || !('count' in raw) || !this.consumeRoomCommand(client.sessionId,raw)) return;
      const value = raw.count;
      if (this.match.running || this.players.keys().next().value!==client.sessionId ||
          typeof value!=='number' || !Number.isInteger(value) || value<0 || value>3) return;
      this.lobbyNpcCount = value;
    });
    this.onMessage('start-match', (client, countRequest:unknown) => {
      if (!this.consumeRoomCommand(client.sessionId,countRequest)) return;
      const players = [...this.players.values()].map(state=>state.player);
      if (this.match.start(client.sessionId,players,this.clock.currentTime,Math.random,(typeof countRequest==='object' && countRequest && 'infiltrators' in countRequest ? countRequest.infiltrators : countRequest)===2 ? 2 : 1)) {
        this.internalMail.reset();
        this.broadcast('mail-state',[]);
        this.broadcast('mail-reports',[]);
        this.gameplay.reset(this.clock.currentTime,Math.random,players);
        const count = Math.min(countFromStart(countRequest,this.lobbyNpcCount),PLENARY_SEATS.length-players.length);
        this.lobbyNpcCount = count;
        this.parliamentarians.reset(count,this.clock.currentTime,new Set(players.map(player=>player.character)));
        this.npcTalk.reset();
        for (const npc of this.parliamentarians.players) this.match.addParliamentarian(npc);
        this.match.setAgendaInventory((id,kind)=>this.gameplay.owns(id,kind),id=>this.gameplay.officeStock(id),
          (id,kind,replacement)=>this.gameplay.hasAgendaDecoration(id,kind,replacement),
          id=>this.parliamentarians.cheapestPaidVote(id,this.match.projectRound,this.match.projectIndex),
          id=>this.gameplay.hasOffice(id),id=>this.gameplay.installedPizza(id),
          id=>this.parliamentarians.players.map(npc=>this.parliamentarians.signature(npc.id,id)));
        this.match.refreshAgendaEligibility();
        for (const [id,state] of this.players) {
          const {player} = state;
          Object.assign(player,this.gameplay.officeSpawn(id),{moving:false});
          this.resetMovement(state);
          player.speed = characterStats[player.character].speed;
          player.stamina = MAX_STAMINA;
          player.sprinting = undefined;
        }
        this.matchObjectsActive = true;
        gameplayMetrics.increment('matches_started');
        void this.lock();
      }
    });
    this.onMessage('complaint-submit',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !raw || typeof raw!=='object' || !('id' in raw) || typeof raw.id!=='number' || !Number.isSafeInteger(raw.id)) return;
      if (!this.consumeRoomCommand(player.id,raw)) return;
      const photoId = 'photo' in raw ? raw.photo : undefined;
      const photo = photoId===undefined ? undefined :
        this.gameplay.photoView(player.id,this.clock.currentTime).album.find(entry=>entry.photo.id===photoId)?.photo;
      if (photoId!==undefined && !photo) {
        client.send('gameplay-feedback','Fotografia indisponível no seu álbum.');
        return;
      }
      const error = this.match.submitComplaint(player,raw.id,this.clock.currentTime,photo);
      if (error) client.send('gameplay-feedback',error);
    });
    this.onMessage('mail-read',client=>{
      client.send('mail-state',this.internalMail.view());
      client.send('mail-reports',this.internalMail.reportsFor(client.sessionId));
    });
    this.onMessage('mail-examine',(client,raw:unknown)=>{
      const id = client.sessionId;
      const player = this.players.get(id)?.player;
      if (!raw || typeof raw!=='object' || !('notice' in raw) || !Number.isSafeInteger(raw.notice)) return;
      if (!player || !this.consumeRoomCommand(id,raw) || player.knockedOut || player.carried || this.match.phase!=='negotiation' || this.match.isolated(id)) return;
      const error = this.internalMail.examine(id,raw.notice,()=>this.gameplay.consumeForensicKit(id));
      if (error) client.send('gameplay-feedback',error);
      else client.send('mail-reports',this.internalMail.reportsFor(id));
    });
    this.onMessage('mail-publish',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !this.consumeRoomCommand(player.id,raw)) return;
      if (this.match.phase!=='negotiation' || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          player.knockedOut || player.carrying || player.carried) {
        client.send('mail-result','Publicação indisponível nesta fase.');
        return;
      }
      const error = this.internalMail.publish(player,raw,this.gameplayWorld(),ref=>{
        if (!ref || typeof ref!=='object' || !('kind' in ref) || !('id' in ref) || typeof ref.id!=='number') return;
        if (ref.kind==='document') {
          const snapshot = this.gameplay.documentAttachment(player.id,ref.id);
          if (snapshot) return {attachment:{kind:'document',document:snapshot.document},authentic:snapshot.authentic};
        }
        if (ref.kind==='photo') {
          const photo = this.gameplay.photoView(player.id,this.clock.currentTime).album.find(entry=>entry.photo.id===ref.id)?.photo;
          if (photo) return {attachment:{kind:'photo',photo}};
        }
        if (ref.kind==='report') {
          const report = this.internalMail.reportsFor(player.id).find(entry=>entry.notice===ref.id);
          if (report) return {attachment:{kind:'report',report}};
        }
      });
      client.send('mail-result',error ?? null);
      if (!error) this.broadcast('mail-state',this.internalMail.view());
    });
    this.onMessage('plenary-action', (client, raw:unknown) => {
      if (!raw || typeof raw!=='object' || !('action' in raw)) return;
      const {action} = raw;
      const player = this.players.get(client.sessionId)?.player;
      if (player && this.consumeRoomCommand(player.id,raw) && !player.knockedOut && !player.carrying && (action==='amendment' || action==='audit' || action==='panel' || action==='fraud')) {
        const result = this.match.act(player,action,this.clock.currentTime);
        if (result) client.send('audit-result',result);
      }
    });
    this.onMessage('room-activity', (client, raw:unknown) => {
      if (!raw || typeof raw!=='object' || !('activity' in raw)) return;
      const {activity} = raw;
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !this.consumeRoomCommand(player.id,raw) || player.knockedOut || player.carrying || typeof activity!=='string' || !Object.hasOwn(roomActivities,activity)) return;
      const result = this.match.roomActivity(player,activity as RoomActivity,this.clock.currentTime);
      if (result) {
        client.send('room-activity-result',result);
        if (result.activity==='coffee') client.send('food-consumed','drink');
      }
    });
    this.onMessage('voice-activity',client=>{
      if (this.voice.has(client.sessionId)) this.gameplay.spySound(client.sessionId,this.clock.currentTime);
    });
    this.onMessage('spy',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !this.consumeRoomCommand(player.id,raw) || this.match.phase!=='negotiation' || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined) return;
      const result = this.gameplay.spyAction(player,raw,this.gameplayWorld());
      if (result) client.send('gameplay-feedback',result);
    });
    this.onMessage('fire-action',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !raw || typeof raw!=='object' || !('site' in raw) || typeof raw.site!=='number' ||
          !Number.isInteger(raw.site) || !('kind' in raw) || (raw.kind!=='ignite' && raw.kind!=='extinguish')) return;
      if (!this.consumeRoomCommand(player.id,raw)) return;
      const result = this.match.actOnFire(player,raw.kind,raw.site,this.clock.currentTime);
      if (result) client.send('gameplay-feedback',result);
    });
    this.onMessage('gameplay',(client, raw:unknown) => {
      if (!raw || typeof raw!=='object' || !('action' in raw)) return;
      const action = readGameplayAction(raw.action);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || !this.consumeRoomCommand(player.id,raw) || this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          (this.match.phase==='hearing' && action.kind!=='attack' && action.kind!=='toggle-modulator') ||
          !canUseGameplayAction(action,this.match.phase==='negotiation',this.match.allowsPlenaryCombat && inPlenary(player))) return;
      const text = this.gameplay.act(player,action,this.gameplayWorld());
      if (text) client.send('gameplay-feedback',text);
      if (action.kind==='office-open' && text==='Você saiu do gabinete.') {
        const state = this.players.get(client.sessionId);
        if (state) this.resetMovement(state);
      }
    });
    this.onMessage('npc-deal',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !this.consumeRoomCommand(player.id,raw) || this.match.phase!=='negotiation' || !this.match.canHandleObjects(player.id,this.clock.currentTime)) return;
      if (this.gameplay.hasOfficeChannel(player.id)) return;
      const result = this.npcTalk.act(player,raw,this.gameplayWorld());
      if (result) client.send('gameplay-feedback',result);
    });
    this.onMessage('allocate-attribute',(client,raw:unknown)=>{
      const request = readAttributeRequest(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!request || !player || player.knockedOut || player.carrying) return;
      if (this.match.allocateAttribute(player.id,request,this.clock.currentTime)) {
        this.gameplay.applyAttribute(player,request.attribute);
      }
    });
    this.onMessage('politics', (client, raw:unknown) => {
      const action = readPoliticsAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || !this.consumeRoomCommand(player.id,raw) || player.knockedOut || player.carrying) return;
      const now = this.clock.currentTime;
      const transferred = this.match.politics(player,action,[...this.players.values()].map(state => state.player),now);
      if (action.kind==='transfer' && transferred) {
        this.clients.getById(action.to)?.send('pix-received',{from:player.nick,amount:action.amount});
      }
      this.resetFinishedMatch(now);
    });
    this.onMessage('election', (client, raw:unknown) => {
      const action = readElectionAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || !this.consumeRoomCommand(player.id,raw) || player.knockedOut || player.carrying) return;
      const advertisement = this.match.electionAction(player,action,this.clock.currentTime,this.voice.has(player.id));
      if (advertisement) this.broadcast('campaign-advertisement',advertisement);
    });
    this.onMessage('bill-intent',(client,raw:unknown)=>{
      if (!raw || typeof raw!=='object' || !('vote' in raw)) return;
      const {vote} = raw;
      if ((vote==='yes' || vote==='no' || vote==='clear') && this.consumeRoomCommand(client.sessionId,raw)) {
        this.match.declareVote(client.sessionId,vote==='clear' ? null : vote,this.clock.currentTime);
      }
    });
    this.onMessage('cassation-vote',(client,raw:unknown)=>{
      if (!raw || typeof raw!=='object' || !('candidate' in raw) ||
          (raw.candidate!==null && typeof raw.candidate!=='string') || !this.consumeRoomCommand(client.sessionId,raw)) return;
      const player = this.players.get(client.sessionId);
      if (player?.plenary && inPlenary(player.player)) {
        this.match.castCassation(client.sessionId,raw.candidate,this.clock.currentTime);
      }
    });
    this.onMessage('bill-vote',(client,raw:unknown)=>{
      if (!raw || typeof raw!=='object' || !('vote' in raw)) return;
      const {vote} = raw;
      if ((vote==='yes' || vote==='no' || vote==='abstain') && this.consumeRoomCommand(client.sessionId,raw)) {
        this.match.vote(client.sessionId,vote,this.clock.currentTime);
      }
    });
    this.onMessage('input', (client, data: unknown) => {
      const input = readInput(data);
      const state = this.players.get(client.sessionId);
      const queue = this.movementQueue.get(client.sessionId);
      if (!input || !state || !queue || input.revision!==state.revision || !!input.plenary!==!!state.plenary || input.seq <= (queue.at(-1)?.seq ?? state.ack)) return;
      if (queue.length >= MAX_QUEUED_INPUTS) queue.shift();
      queue.push(input);
    });
    this.onMessage('character', (client, raw:unknown) => {
      if (!raw || typeof raw!=='object' || !('character' in raw) || !this.consumeRoomCommand(client.sessionId,raw)) return;
      const {character} = raw;
      const player = this.players.get(client.sessionId)?.player;
      if (!this.match.running && player && typeof character === 'number' && Number.isInteger(character) && character >= 0 && character < NAMES.length) {
        player.character = character;
      }
    });
    let previousActiveTick:number|undefined;
    let sendPlayerSnapshot = true;
    let projectedPhase = this.match.phase;
    this.setFixedTimestep(() => {
      const startedAt = performance.now();
      const active = this.match.running && this.clients.length>0;
      const gap = active && previousActiveTick!==undefined ? startedAt-previousActiveTick : undefined;
      previousActiveTick = active ? startedAt : undefined;
      for (const [id,state] of this.players) {
        const input = this.movementQueue.get(id)?.shift();
        if (input) applyInput(state,input);
        else {
          restMovement(state.player);
          if (state.player.knockedOut) state.route = [];
        }
      }
      const players = [...this.players.values()].map(state => state.player);
      const now = this.clock.currentTime;
      const previousProject = this.match.phase==='ballot' ? this.match.projectRound : undefined;
      const wasVoting = this.match.allowsPlenaryCombat;
      this.match.advance(now);
      this.resetFinishedMatch(now);
      const world = this.gameplayWorld();
      this.gameplay.tick(world,this.match.phase==='negotiation',wasVoting && this.match.allowsPlenaryCombat);
      const paused = this.npcTalk.tick(world,this.match.phase==='negotiation');
      this.parliamentarians.tick(now,STEP_MS/1000,paused,this.match.phase==='negotiation');
      if (this.match.phase==='ballot' && this.match.projectRound!==previousProject) {
        this.parliamentarians.stopRoutes();
        this.parliamentarians.players.forEach((npc,index)=>{
          Object.assign(npc,PLENARY_SEATS[PLENARY_SEATS.length-1-index],{direction:2});
          const intention = this.parliamentarians.castVote(npc.id,this.match.projectRound,this.match.projectIndex);
          if (intention) this.match.recordNpcVote(npc.id,intention);
        });
      }
      const inSession = this.match.phase==='ballot' || this.match.phase==='hearing';
      for (const [index,[id,state]] of [...this.players].entries()) {
        const isolated = this.match.isolated(id);
        const plenary = inSession && !isolated;
        if (!!state.plenary===plenary && !!state.isolated===isolated) continue;
        const wasIsolated = state.isolated;
        state.isolated = isolated;
        state.plenary = plenary;
        this.resetMovement(state);
        state.player.moving = false;
        state.player.sprinting = undefined;
        if (isolated) {
          this.npcTalk.leave(id);
          this.gameplay.stopMegaphone(id,world);
          this.gameplay.leave(state.player,world,false);
          Object.assign(state.player,isolationRoom.spawn,{direction:0});
        } else if (plenary) Object.assign(state.player,PLENARY_SEATS[index],{direction:2});
        else if (wasIsolated) Object.assign(state.player,isolationRoom.exit,{direction:2});
      }
      for (const player of players) {
        player.former = this.match.running ? this.match.former(player.id) : undefined;
        player.phone = this.match.running ? this.gameplay.phoneActivity(player.id) : undefined;
        player.exposed = this.match.running ? this.gameplay.visibleItems(player.id,now) : undefined;
      }
      this.routeVoice(this.match.speaker(now));
      const ids = players.map(({id}) => id);
      const projectWorld = sendPlayerSnapshot || projectedPhase!==this.match.phase;
      projectedPhase = this.match.phase;
      const sendSpyFrame = now>=this.spyFrameAt && this.match.phase==='negotiation';
      if (sendSpyFrame) this.spyFrameAt = now+100;
      for (const client of this.clients) {
        const id = client.sessionId;
        const state = this.players.get(id);
        if (!state) continue;
        if (!projectWorld) {
          client.send('control',state);
          continue;
        }
        const view = this.match.view(id,ids,now,this.match.contacts(state.player,players));
        if (this.match.running) {
          view.complaints = this.match.complaintView(id);
          if (this.match.canFileComplaint(state.player,now)) view.complaints.atDesk = true;
        }
        view.lobbyNpcCount = this.lobbyNpcCount;
        if (this.match.canHandleObjects(id,now)) view.gameplay = this.gameplay.view(state.player,world);
        const photoRevision = this.match.running ? this.gameplay.photoRevision : -1;
        const lastPhotos = this.lastPhotos.get(id);
        if (lastPhotos?.revision!==photoRevision) {
          const photos = this.match.running ? this.gameplay.photoView(id,now) : emptyPhotoAccess;
          const key = JSON.stringify(photos);
          this.lastPhotos.set(id,{revision:photoRevision,key});
          if (lastPhotos?.key!==key && (lastPhotos || this.match.running)) client.send('photo-state',photos);
        }
        if (view.gameplay && this.match.phase==='negotiation') {
          view.gameplay.surveillance = this.gameplay.spyView(state.player,world);
          if (sendSpyFrame) {
            const frame = this.gameplay.spyFrame(state.player,world);
            if (frame) client.send('spy-frame',frame);
          }
          view.gameplay.parliamentarians = this.npcTalk.nearby(state.player);
          view.gameplay.parliamentarianDeal = this.npcTalk.view(state.player,world);
          view.gameplay.robberyProgress = this.npcTalk.robberyProgress(id,now);
        }
        const key = JSON.stringify(view);
        if (this.lastMatchView.get(id)!==key) {
          client.send('plenary',view);
          this.lastMatchView.set(id,key);
        }
        if (this.match.running) {
          const vision = this.gameplay.vision(id,now);
          const visible = state.plenary ? world.players.filter(inPlenary) :
            world.players.filter(player=>player===state.player || characterVisible(state.player,player,vision));
          client.send('players',visible.map(({barriers:_barriers,hpBonus:_hp,attackBonus:_attack,defenseBonus:_defense,...player})=>({...player,exposed:player.id===id ? this.gameplay.visibleItems(id,now,id) : player.exposed,cashInHand:this.gameplay.hasVisibleCash(player.id,now,id) ? true : undefined,health:this.gameplay.healthFraction(player,now)})));
        } else client.send('players',players);
        client.send('control',state);
      }
      sendPlayerSnapshot = !sendPlayerSnapshot;
      if (active) gameplayMetrics.observeSimulation(gap,performance.now()-startedAt);
    },1000/STEP_MS);
  }

  onJoin(client: Client, options?:{nick?:unknown}) {
    const nick = readNick(options?.nick);
    if (!nick) throw new ServerError(INVALID_NICK,nickHint);
    if ([...this.players.values()].some(({player}) => nickKey(player.nick)===nickKey(nick))) {
      throw new ServerError(NICK_TAKEN,'Esse nick já está em uso nesta sala.');
    }
    const occupied = new Set([...this.players.values()].map(({player}) => player.character));
    const character = NAMES.findIndex((_, index) => !occupied.has(index));
    const player: Player = {
      id:client.sessionId, nick, character:Math.max(0,character), x:140+this.players.size*36, y:146, direction:0, moving:false,
    };
    this.players.set(client.sessionId,{player,route:[],ack:0});
    this.movementQueue.set(client.sessionId,[]);
  }

  async onDrop(client:Client) {
    if (!this.match.running) return;
    this.leaveVoice(client.sessionId);
    this.npcTalk.leave(client.sessionId);
    const player = this.players.get(client.sessionId)?.player;
    if (player) this.gameplay.leave(player,this.gameplayWorld(),false);
    const state = this.players.get(client.sessionId);
    if (state) {
      this.resetMovement(state);
      state.player.moving = false;
    }
    this.match.setPlayerConnected(client.sessionId,false);
    await this.allowReconnection(client,30);
  }

  onReconnect(client:Client) {
    gameplayMetrics.increment('reconnects');
    this.match.setPlayerConnected(client.sessionId,true);
    this.lastMegaphone.delete(client.sessionId);
    this.lastMatchView.delete(client.sessionId);
    this.lastPhotos.delete(client.sessionId);
  }

  onLeave(client: Client) {
    this.leaveVoice(client.sessionId);
    this.lastMegaphone.delete(client.sessionId);
    this.lastMatchView.delete(client.sessionId);
    this.lastPhotos.delete(client.sessionId);
    this.npcTalk.leave(client.sessionId);
    const player = this.players.get(client.sessionId)?.player;
    if (player) this.gameplay.leave(player,this.gameplayWorld(),true);
    this.match.leave(client.sessionId,this.clock.currentTime);
    this.resetFinishedMatch(this.clock.currentTime);
    this.players.delete(client.sessionId);
    this.lastRoomCommandToken.delete(client.sessionId);
    this.movementQueue.delete(client.sessionId);
  }
}
