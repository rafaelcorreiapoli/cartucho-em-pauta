import { fireSites, type FireExtinguished } from '../src/fire';
import type { SpyCameraFrame } from '../src/surveillance';
import { canUseSecurityTerminal, securityCameras, type SecurityCamera } from '../src/security';
import { publishGameplay } from './gameplay-world';
import { gameplayMetrics } from './gameplay-metrics';
import { isDrink, isFood } from '../src/food';
import { InternalMail } from './InternalMail';
import { megaphone } from '../src/equipment';
import { Parliamentarians } from './Parliamentarians';
import { ParliamentarianTalk } from './ParliamentarianTalk';
import { npcRules } from '../src/parliamentarians';
import { readAttributeRequest } from '../src/progression';
import { characterStats } from '../src/character-stats';
import { emptyPhotoAccess } from '../src/photography';
import { consumableAction, canUseGameplayAction, readGameplayAction, type InteractionCue } from '../src/gameplay';
import { StationCooldowns } from './StationCooldowns';
import { Gameplay } from './Gameplay';
import { isGear } from '../src/equipment';
import { roomActivities, type RoomActivity } from '../src/room-activities';
import { readElectionAction, type CampaignBroadcast } from '../src/elections';
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
  private readonly stationCooldowns = new StationCooldowns();
  private gameplay = new Gameplay(this.stationCooldowns,()=>this.match.powerOut);
  private lastRoomCommandToken = new Map<string,number>();
  private readonly internalMail = new InternalMail();
  private matchObjectsActive = false;
  private consumeRoomCommand(id:string,raw:unknown) {
    const token = readRoomCommandToken(raw);
    if (token===undefined || token<=(this.lastRoomCommandToken.get(id) ?? 0)) return false;
    this.lastRoomCommandToken.set(id,token);
    return this.match.ballotCountdown(this.clock.currentTime)===undefined;
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
        if (!world.publish(event)) return;
        this.parliamentarians.witnessAggression(event);
        let cue:InteractionCue | undefined;
        if (event.type==='delivered' && event.place==='treasury') cue = 'cash';
        else if (event.type==='stamped') cue = 'stamp';
        else if (event.type==='door-breached' || event.type==='cabinet-breached') cue = 'lock';
        else if (event.kind==='portrait' || event.kind==='vip') {
          if (event.type==='installed') cue = 'stamp';
          if (event.type==='uninstalled') cue = 'pickup';
        }
        if (cue) this.clients.getById(event.actor)?.send('interaction-cue',cue);
        const pickup = event.type==='collected' || event.type==='recovered';
        const recipient = pickup ? event.actor : event.type==='transferred' ? event.target : event.type==='purchased' ? event.actor : undefined;
        if (recipient) this.clients.getById(recipient)?.send('item-obtained',pickup);
        if (event.type==='coffee-drunk' || event.type==='used' && isFood(event.kind)) {
          const drink = event.type==='coffee-drunk' || isDrink(event.kind);
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

  private match = new PlenaryMatch(process.env.SESSAO_LOCAL_SOLO==='1' || process.env.SESSAO_PREVIEW_SOLO==='1' || (process.env.NODE_ENV==='test' && process.env.SESSAO_TEST_MIN_PLAYERS==='1') ? 1 : undefined,this.stationCooldowns);
  private parliamentarians = new Parliamentarians();
  private npcTalk = new ParliamentarianTalk(this.parliamentarians,this.gameplay,this.match);
  private lastMatchView = new Map<string,string>();
  private lastPhotos = new Map<string,{revision:number; key:string}>();

  private voice = new Set<string>();

  private resetFinishedMatch(now:number) {
    if (!this.matchObjectsActive || this.match.running) return;
    this.matchObjectsActive = false;
    this.securityFeeds.clear();
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
  private securityFeeds = new Map<string,{camera:SecurityCamera; delivered:boolean}>();

  private atSecurityTerminal(player:Player, now:number) {
    return this.match.phase==='negotiation' && this.match.ballotCountdown(now)===undefined &&
      this.match.canHandleObjects(player.id,now) && canUseSecurityTerminal(player);
  }

  private routeVoice(speaker:string|undefined,broadcaster:string|undefined) {
    const participants = [...this.voice].flatMap(id=>{
      const player = this.players.get(id)?.player;
      return player ? [player] : [];
    });
    const spatial = this.match.phase==='negotiation';
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
        this.match.setAgendaMailAvailability(id=>this.internalMail.nextPublicationAt(id),id=>this.gameplay.agendaSelfies(id),
          id=>this.internalMail.reportsFor(id).map(report=>report.notice));
        this.match.setAgendaCashAvailability(itemId=>this.gameplay.canPartiallyDepositCash(itemId));
        this.match.setAgendaCommerce(()=>this.clock.currentTime);
        this.match.setAgendaXrayAvailability((id,wallet)=>this.gameplay.canUseAgendaXray(id,wallet,this.clock.currentTime));
        this.match.setAgendaInventory((id,kind)=>this.gameplay.owns(id,kind),id=>this.gameplay.officeStock(id),
          (id,kind,replacement)=>this.gameplay.hasAgendaDecoration(id,kind,replacement,this.clock.currentTime),
          id=>{
            const project = this.match.projectIndex;
            return project===undefined ? undefined : this.parliamentarians.cheapestPaidVote(id,this.match.projectRound,project);
          },
          id=>this.gameplay.hasOffice(id),id=>this.gameplay.installedPizza(id),
          id=>this.parliamentarians.players.map(npc=>this.parliamentarians.signature(npc.id,id)),
          ()=>this.gameplay.hasLuxuryDecoration(),(id,kind)=>this.gameplay.canInstallSpy(id,kind),(id,credited)=>this.gameplay.agendaCameras(id,credited),id=>this.gameplay.ownsWiretap(id),(id,amount)=>this.gameplay.hasCashLot(id,amount),id=>this.gameplay.hasKnownForeignSpy(id));
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
      if (!player || !raw || typeof raw!=='object') return;
      const id = 'id' in raw && typeof raw.id==='number' && Number.isSafeInteger(raw.id) ? raw.id :
        'target' in raw && typeof raw.target==='string' ? raw.target : undefined;
      if (id===undefined || !this.consumeRoomCommand(player.id,raw)) return;
      const photoId = 'photo' in raw ? raw.photo : undefined;
      const photo = photoId===undefined ? undefined :
        this.gameplay.photoView(player.id,this.clock.currentTime).album.find(entry=>entry.photo.id===photoId)?.photo;
      if (photoId!==undefined && !photo) {
        client.send('gameplay-feedback','Fotografia indisponível no seu álbum.');
        return;
      }
      const error = this.match.submitComplaint(player,id,this.clock.currentTime,photo);
      if (error) client.send('gameplay-feedback',error);
      else {
        const [decision] = this.match.complaintView(player.id).history;
        this.internalMail.publishComplaint(decision);
        this.broadcast('mail-state',this.internalMail.view());
      }
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
      else {
        this.match.refreshAgendaEligibility(this.clock.currentTime);
        client.send('mail-reports',this.internalMail.reportsFor(id));
      }
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
      if (!error) {
        this.match.refreshAgendaEligibility();
        this.broadcast('mail-state',this.internalMail.view());
      }
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
      const world = this.gameplayWorld();
      const result = this.match.roomActivity(player,activity as RoomActivity,world.now,world.publish);
      if (result) client.send('room-activity-result',result);
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
    this.onMessage('security-camera',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !raw || typeof raw!=='object' || !('kind' in raw) || !this.consumeRoomCommand(player.id,raw)) return;
      if (raw.kind==='close') {
        this.securityFeeds.delete(player.id);
        return;
      }
      if (!this.atSecurityTerminal(player,this.clock.currentTime)) return;
      if (raw.kind==='open' && !this.securityFeeds.has(player.id)) {
        this.securityFeeds.set(player.id,{camera:securityCameras[0],delivered:false});
      } else if (raw.kind==='select' && 'camera' in raw && this.securityFeeds.has(player.id)) {
        const cameraId = raw.camera;
        const camera = securityCameras.find(({id})=>id===cameraId);
        if (camera && camera!==this.securityFeeds.get(player.id)?.camera) {
          this.securityFeeds.set(player.id,{camera,delivered:false});
        }
      }
    });
    this.onMessage('power-action',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !raw || typeof raw!=='object' || !('panel' in raw) ||
        (raw.panel!==0 && raw.panel!==1) || !('kind' in raw) ||
        (raw.kind!=='sabotage' && raw.kind!=='repair' && raw.kind!=='cancel') ||
        !this.consumeRoomCommand(player.id,raw)) return;
      const result = this.match.actOnPower(player,{kind:raw.kind,panel:raw.panel},this.clock.currentTime);
      if (result) client.send('gameplay-feedback',result);
    });
    this.onMessage('fire-action',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || !raw || typeof raw!=='object' || !('site' in raw) || typeof raw.site!=='number' ||
          !Number.isInteger(raw.site) || !('kind' in raw) || (raw.kind!=='plant' && raw.kind!=='disarm' && raw.kind!=='extinguish')) return;
      if (!this.consumeRoomCommand(player.id,raw) || this.gameplay.hasOfficeChannel(player.id) ||
          this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined) return;
      const result = this.match.actOnFire(player,raw.kind,raw.site,this.clock.currentTime,
        raw.kind==='extinguish' && this.gameplay.owns(player.id,'extinguisher'),
        raw.kind==='plant' ? this.gameplay.incendiaryItem(player.id) : undefined);
      if (!result) return;
      if (raw.kind==='extinguish') {
        this.broadcast('fire-extinguished',{actor:player.nick,room:fireSites[raw.site].name} satisfies FireExtinguished);
      } else client.send('gameplay-feedback',result);
    });
    this.onMessage('gameplay',(client, raw:unknown) => {
      if (!raw || typeof raw!=='object' || !('action' in raw)) return;
      const action = readGameplayAction(raw.action);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || !this.consumeRoomCommand(player.id,raw) || this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          (this.match.phase==='hearing' && action.kind!=='attack' && action.kind!=='toggle-modulator') ||
          !canUseGameplayAction(action,this.match.phase==='negotiation',this.match.allowsPlenaryCombat && inPlenary(player))) return;
      const text = this.gameplay.act(player,action,this.gameplayWorld());
      if (action.kind==='photo-delete' || action.kind==='scan-xray') this.match.refreshAgendaEligibility();
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
      if (!request || !player) return;
      if (this.match.allocateAttribute(player,request,this.clock.currentTime)) {
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
      if (advertisement) {
        const broadcast:CampaignBroadcast = {...advertisement,advertiserId:player.id};
        this.broadcast('campaign-advertisement',broadcast);
      }
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
      if (this.match.ballotCountdown(this.clock.currentTime)!==undefined) return;
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
    let countingDown = false;
    this.setFixedTimestep(() => {
      const startedAt = performance.now();
      const active = this.match.running && this.clients.length>0;
      const gap = active && previousActiveTick!==undefined ? startedAt-previousActiveTick : undefined;
      previousActiveTick = active ? startedAt : undefined;
      const now = this.clock.currentTime;
      const freeze = this.match.ballotCountdown(now)!==undefined;
      if (freeze && !countingDown) this.parliamentarians.stopRoutes();
      for (const [id,state] of this.players) {
        if (freeze && !countingDown) this.resetMovement(state);
        const input = freeze ? undefined : this.movementQueue.get(id)?.shift();
        if (input) applyInput(state,input);
        else {
          restMovement(state.player);
          if (state.player.knockedOut) state.route = [];
        }
      }
      countingDown = freeze;
      const players = [...this.players.values()].map(state => state.player);
      const previousProject = this.match.phase==='ballot' ? this.match.projectRound : undefined;
      const wasVoting = this.match.allowsPlenaryCombat;
      this.match.advance(now, recipients=>{
        for (const id of recipients) this.gameplay.distributePinga(this.players.get(id)!.player,now);
      });
      this.resetFinishedMatch(now);
      const world = this.gameplayWorld();
      if (!freeze || this.match.phase!=='negotiation') {
        const exploring = this.match.phase==='negotiation';
        const endedXray = this.gameplay.tick(world,exploring,wasVoting && this.match.allowsPlenaryCombat);
        if (endedXray) this.match.refreshAgendaEligibility(now);
        const paused = this.npcTalk.tick(world,exploring);
        this.parliamentarians.tick(now,STEP_MS/1000,paused,exploring);
      }
      if (this.gameplay.expireRecentPortraits(now)) this.match.refreshAgendaEligibility();
      const project = this.match.projectIndex;
      if (project!==undefined && this.match.phase==='ballot' && this.match.projectRound!==previousProject) {
        this.parliamentarians.stopRoutes();
        this.parliamentarians.players.forEach((npc,index)=>{
          Object.assign(npc,PLENARY_SEATS[PLENARY_SEATS.length-1-index],{direction:2});
          const intention = this.parliamentarians.castVote(npc.id,this.match.projectRound,project);
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
      const installation = this.match.updateFireInstallation(now,id=>{
        if (!world.present(id) || this.gameplay.hasOfficeChannel(id) || this.npcTalk.robberyProgress(id,now)!==undefined) return;
        return this.players.get(id)?.player;
      },(id,item)=>this.gameplay.incendiaryItem(id,item)!==undefined,(id,item)=>this.gameplay.consumeIncendiary(id,item));
      if (installation) world.feedback(installation.actor,installation.feedback);
      this.match.advancePower(now,id=>this.clients.getById(id) ? this.players.get(id)?.player : undefined);
      for (const player of players) {
        player.handlingObject = this.match.fireHandlingDirection(player);
        player.former = this.match.running ? this.match.former(player.id) : undefined;
        player.phone = this.match.running ? this.gameplay.phoneActivity(player.id) : undefined;
        player.exposed = this.match.running ? this.gameplay.visibleItems(player.id,now) : undefined;
      }
      const broadcaster = this.match.phase==='negotiation' ? this.gameplay.megaphoneSpeaker() : undefined;
      this.routeVoice(this.match.speaker(now),broadcaster);
      const ids = players.map(({id}) => id);
      const projectWorld = sendPlayerSnapshot || projectedPhase!==this.match.phase;
      projectedPhase = this.match.phase;
      const sendSpyFrame = now>=this.spyFrameAt && this.match.phase==='negotiation';
      if (sendSpyFrame) this.spyFrameAt = now+100;
      for (const client of this.clients) {
        const id = client.sessionId;
        const state = this.players.get(id);
        if (!state) continue;
        const atTerminal = this.atSecurityTerminal(state.player,now);
        if (!atTerminal) this.securityFeeds.delete(id);
        if (!projectWorld) {
          client.send('control',state);
          continue;
        }
        const view = this.match.view(id,ids,now,this.match.contacts(state.player,players));
        if (broadcaster && broadcaster!==id) view.megaphoneActive = true;
        if (this.match.running) {
          const atDesk = this.match.canFileComplaint(state.player,now);
          const photos = atDesk ? this.gameplay.photoView(id,now).album.map(entry=>entry.photo) : undefined;
          view.complaints = this.match.complaintView(id,photos);
          if (atDesk) view.complaints.atDesk = true;
        }
        view.lobbyNpcCount = this.lobbyNpcCount;
        if (this.match.phase==='negotiation') view.fireInteraction = this.match.fireInteraction(
          state.player,now,this.gameplay.vision(id,now),this.gameplay.incendiaryItem(id)!==undefined,this.gameplay.owns(id,'extinguisher'));
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
          view.gameplay.parliamentarians = this.npcTalk.nearby(state.player);
          view.gameplay.parliamentarianDeal = this.npcTalk.view(state.player,world);
          view.gameplay.robberyProgress = this.npcTalk.robberyProgress(id,now);
        }
        const securityFeed = this.securityFeeds.get(id);
        if (atTerminal && view.gameplay) view.gameplay.security = {camera:securityFeed?.camera.id};
        const key = JSON.stringify(view);
        if (this.lastMatchView.get(id)!==key) {
          client.send('plenary',view);
          this.lastMatchView.set(id,key);
        }
        const spyChannel = view.gameplay?.surveillance?.selected;
        if (sendSpyFrame && spyChannel!==undefined) {
          const frame = this.gameplay.spyFrame(state.player,world);
          if (frame) {
            client.send('spy-frame',{...frame,channel:spyChannel} satisfies SpyCameraFrame);
            this.gameplay.confirmSpyFrame(state.player,world);
          }
        }
        if (sendSpyFrame && securityFeed) {
          const {camera} = securityFeed;
          client.send('security-frame',{camera:camera.id,scene:this.gameplay.securityFrame(state.player,camera,world)});
          if (!securityFeed.delivered) {
            securityFeed.delivered = true;
            publishGameplay(world,state.player,'security-camera-viewed',{place:camera.id,witnesses:[]});
          }
        }
        if (this.match.running) {
          const vision = this.gameplay.vision(id,now);
          const visible = world.players.filter(player=>player===state.player ||
            (!state.plenary || inPlenary(player)) &&
            (state.plenary && !this.match.powerOut || characterVisible(state.player,player,vision)));
          client.send('players',visible.map(({barriers:_barriers,interactionSpeedBonus:_interactionSpeed,...player})=>({...player,exposed:player.id===id ? this.gameplay.visibleItems(id,now,id) : player.exposed,cashInHand:this.gameplay.hasVisibleCash(player.id,now,id) ? true : undefined,health:this.gameplay.healthFraction(player,now)})));
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
    this.securityFeeds.delete(client.sessionId);
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
    this.lastMatchView.delete(client.sessionId);
    this.lastPhotos.delete(client.sessionId);
  }

  onLeave(client: Client) {
    this.securityFeeds.delete(client.sessionId);
    this.leaveVoice(client.sessionId);
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
