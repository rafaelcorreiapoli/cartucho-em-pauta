import { Parliamentarians } from './Parliamentarians';
import { ParliamentarianTalk } from './ParliamentarianTalk';
import { npcRules } from '../src/parliamentarians';
import { readAttributeRequest } from '../src/progression';
import { characterStats } from '../src/character-stats';
import { emptyPhotoAccess } from '../src/photography';
import { canUseGameplayAction, needsFieldToken, readGameplayAction } from '../src/gameplay';
import { Gameplay } from './Gameplay';
import { isGear } from '../src/equipment';
import { roomActivities, type RoomActivity } from '../src/room-activities';
import { readElectionAction } from '../src/elections';
import { readVoiceSignal } from '../src/voice-protocol';
import { Room, ServerError, type Client } from 'colyseus';
import { localPerception, worldVisible, NAMES, PLENARY_SEATS, inPlenary, type Player } from '../src/map';
import { applyInput, MAX_QUEUED_INPUTS, MAX_STAMINA, readInput, restMovement, STEP_MS, type ControlState, type MovementInput } from '../src/movement';

import { readPoliticsAction } from '../src/politics';
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
  private players = new Map<string, ControlState>();
  private movementQueue = new Map<string, MovementInput[]>();

  private lobbyNpcCount:number = npcRules.count;
  private gameplay = new Gameplay();
  private lastFieldToken = new Map<string,number>();
  private matchObjectsActive = false;
  private gameplayWorld() {
    const world = this.match.gameplayWorld([...this.players.values()].map(({player})=>player).concat(this.parliamentarians.players),this.clock.currentTime,
      id=>this.voice.has(id));
    return {
      ...world,
      feedback:(id:string,message:string)=>this.clients.getById(id)?.send('gameplay-feedback',message),
      vision:(id:string)=>this.gameplay.vision(id),
      present:(id:string)=>!!this.clients.getById(id) || this.parliamentarians.players.some(player=>player.id===id),
      publish: (event:Parameters<typeof world.publish>[0]) => {
        world.publish(event);
        const pickup = event.type==='collected' || event.type==='recovered';
        const recipient = pickup ? event.actor : event.type==='transferred' ? event.target : event.type==='purchased' ? event.actor : undefined;
        if (recipient) this.clients.getById(recipient)?.send('item-obtained',pickup);
        if (event.type==='purchased' && event.item!==undefined && isGear(event.kind)) {
          this.clients.getById(event.actor)?.send('gear-purchased',{id:event.item,kind:event.kind});
        }
      },
    };
  }

  private match = new PlenaryMatch(process.env.SESSAO_LOCAL_SOLO==='1' || (process.env.NODE_ENV==='test' && process.env.SESSAO_TEST_MIN_PLAYERS==='1') ? 1 : undefined);
  private parliamentarians = new Parliamentarians();
  private npcTalk = new ParliamentarianTalk(this.parliamentarians,this.gameplay,this.match);
  private lastMatchView = new Map<string,string>();
  private lastPhotos = new Map<string,{revision:number; key:string}>();

  private voice = new Set<string>();

  private resetFinishedMatch(now:number) {
    if (!this.matchObjectsActive || this.match.running) return;
    this.matchObjectsActive = false;
    this.match.logEconomy(this.gameplay.physicalCash());
    this.npcTalk.reset();
    this.parliamentarians.reset(0,now);
    const players = [...this.players.values()].map(state=>state.player);
    this.gameplay.reset(now,Math.random,players);
    for (const player of players) player.speed = undefined;
    void this.unlock();
  }

  private leaveVoice(id: string) {
    this.match.stopBroadcast(id,this.clock.currentTime);
    if (this.voice.delete(id)) this.broadcast('voice-roster', [...this.voice]);
  }

  private spyFrameAt = 0;

  private routeVoice(speaker:string|undefined) {
    const participants = [...this.voice].flatMap(id=>{
      const player = this.players.get(id)?.player;
      return player ? [player] : [];
    });
    const spatial = this.match.phase==='negotiation';
    const localVolume = (listener:Player, talker:Player) =>
      !spatial || talker.id===speaker || this.gameplay.callPeer(listener.id)===talker.id
        ? 1 : localPerception(listener,talker).volume;
    const volume = (listener:Player,talker:Player)=>Math.max(localVolume(listener,talker),spatial ? this.gameplay.spyVolume(listener,talker) : 0);
    for (const player of participants) {
      const others = participants.filter(peer=>peer.id!==player.id);
      const client = this.clients.getById(player.id);
      if (!client) continue;
      client.send('voice-send',others.filter(peer=>volume(peer,player)>0).map(peer=>peer.id));
      if (spatial) {
        const levels = others.map(peer=>[peer.id,volume(player,peer),localVolume(player,peer)>0] as const);
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
    this.onMessage('lobby-npc-count',(client,value:unknown)=>{
      if (this.match.running || this.players.keys().next().value!==client.sessionId ||
          typeof value!=='number' || !Number.isInteger(value) || value<0 || value>3) return;
      this.lobbyNpcCount = value;
    });
    this.onMessage('start-match', (client, countRequest:unknown) => {
      const players = [...this.players.values()].map(state=>state.player);
      if (this.match.start(client.sessionId,players,this.clock.currentTime,Math.random,(typeof countRequest==='object' && countRequest && 'infiltrators' in countRequest ? countRequest.infiltrators : countRequest)===2 ? 2 : 1)) {
        this.gameplay.reset(this.clock.currentTime,Math.random,players);
        const count = Math.min(countFromStart(countRequest,this.lobbyNpcCount),PLENARY_SEATS.length-players.length);
        this.lobbyNpcCount = count;
        this.parliamentarians.reset(count,this.clock.currentTime);
        this.npcTalk.reset();
        for (const npc of this.parliamentarians.players) this.match.addParliamentarian(npc);
        this.match.refreshAgendaEligibility();
        for (const [id,state] of this.players) {
          const {player} = state;
          Object.assign(player,this.gameplay.officeSpawn(id),{moving:false});
          state.route = [];
          this.movementQueue.get(id)?.splice(0);
          player.speed = characterStats[player.character].speed;
          player.stamina = MAX_STAMINA;
          player.sprinting = undefined;
        }
        this.matchObjectsActive = true;
        void this.lock();
      }
    });
    this.onMessage('plenary-action', (client, action:unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (player && !player.knockedOut && !player.carrying && (action==='amendment' || action==='audit' || action==='panel' || action==='fraud')) {
        const result = this.match.act(player,action,this.clock.currentTime);
        if (result) client.send('audit-result',result);
      }
    });
    this.onMessage('room-activity', (client, activity:unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (!player || player.knockedOut || player.carrying || typeof activity!=='string' || !Object.hasOwn(roomActivities,activity)) return;
      const result = this.match.roomActivity(player,activity as RoomActivity,this.clock.currentTime);
      if (result) client.send('room-activity-result',result);
    });
    this.onMessage('voice-activity',client=>{
      if (this.voice.has(client.sessionId)) this.gameplay.spySound(client.sessionId,this.clock.currentTime);
    });
    this.onMessage('spy',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || this.match.phase!=='negotiation' || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined) return;
      const result = this.gameplay.spyAction(player,raw,this.gameplayWorld());
      if (result) client.send('gameplay-feedback',result);
    });
    this.onMessage('gameplay',(client, raw:unknown) => {
      const action = readGameplayAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || this.npcTalk.robberyProgress(player.id,this.clock.currentTime)!==undefined || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          !canUseGameplayAction(action,this.match.phase==='negotiation')) return;
      if (needsFieldToken(action.kind)) {
        const last = this.lastFieldToken.get(player.id) ?? 0;
        if (action.token===undefined || action.token<=last) return;
        this.lastFieldToken.set(player.id,action.token);
      }
      const text = this.gameplay.act(player,action,this.gameplayWorld());
      if (text) client.send('gameplay-feedback',text);
      if (action.kind==='office-open' && text==='Você saiu do gabinete.') {
        const state = this.players.get(client.sessionId);
        if (state) state.route = [];
        this.movementQueue.get(client.sessionId)?.splice(0);
      }
    });
    this.onMessage('npc-deal',(client,raw:unknown)=>{
      const player = this.players.get(client.sessionId)?.player;
      if (!player || this.match.phase!=='negotiation' || !this.match.canHandleObjects(player.id,this.clock.currentTime)) return;
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
      if (!action || !player || player.knockedOut || player.carrying) return;
      const now = this.clock.currentTime;
      this.match.politics(player,action,[...this.players.values()].map(state => state.player),now);
      this.resetFinishedMatch(now);
    });
    this.onMessage('election', (client, raw:unknown) => {
      const action = readElectionAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (action && player && !player.knockedOut && !player.carrying) this.match.electionAction(player,action,this.clock.currentTime,this.voice.has(player.id));
    });
    this.onMessage('bill-vote', (client, vote:unknown) => {
      if (vote==='yes' || vote==='no') this.match.vote(client.sessionId,vote,this.clock.currentTime);
    });
    this.onMessage('input', (client, data: unknown) => {
      const input = readInput(data);
      const state = this.players.get(client.sessionId);
      const queue = this.movementQueue.get(client.sessionId);
      if (!input || !state || !queue || !!input.plenary!==!!state.plenary || input.seq <= (queue.at(-1)?.seq ?? state.ack)) return;
      if (queue.length >= MAX_QUEUED_INPUTS) queue.shift();
      queue.push(input);
    });
    this.onMessage('character', (client, character: unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (!this.match.running && player && typeof character === 'number' && Number.isInteger(character) && character >= 0 && character < NAMES.length) {
        player.character = character;
      }
    });
    this.setSimulationInterval(() => {
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
      const wasBallot = this.match.phase==='ballot';
      this.match.advance(now);
      this.resetFinishedMatch(now);
      const world = this.gameplayWorld();
      this.gameplay.tick(world,this.match.phase==='negotiation');
      const paused = this.npcTalk.tick(world,this.match.phase==='negotiation');
      this.parliamentarians.tick(now,STEP_MS/1000,paused,this.match.phase==='negotiation');
      if (!wasBallot && this.match.phase==='ballot') {
        this.parliamentarians.stopRoutes();
        this.parliamentarians.players.forEach((npc,index)=>{
          Object.assign(npc,PLENARY_SEATS[PLENARY_SEATS.length-1-index],{direction:2});
          const intention = this.parliamentarians.intention(npc.id,this.match.projectRound);
          if (intention) this.match.recordNpcVote(npc.id,intention);
        });
      }
      const plenary = this.match.phase==='ballot';
      for (const [index,[id,state]] of [...this.players].entries()) {
        if (!!state.plenary===plenary) continue;
        state.plenary = plenary;
        state.route = [];
        state.player.moving = false;
        state.player.sprinting = undefined;
        this.movementQueue.get(id)?.splice(0);
        if (plenary) Object.assign(state.player,PLENARY_SEATS[index],{direction:2});
      }
      for (const player of players) {
        player.former = this.match.running ? this.match.former(player.id) : undefined;
        player.phone = this.match.running ? this.gameplay.phoneActivity(player.id) : undefined;
        player.exposed = this.match.running ? this.gameplay.visibleItems(player.id,now) : undefined;
      }
      this.routeVoice(this.match.speaker(now));
      const ids = players.map(({id}) => id);
      const sendSpyFrame = now>=this.spyFrameAt && this.match.phase==='negotiation';
      if (sendSpyFrame) this.spyFrameAt = now+100;
      for (const client of this.clients) {
        const id = client.sessionId;
        const state = this.players.get(id);
        if (!state) continue;
        const view = this.match.view(id,ids,now,this.match.contacts(state.player,players));
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
          const vision = this.gameplay.vision(id);
          const visible = plenary ? world.players.filter(inPlenary) :
            world.players.filter(player=>player===state.player || worldVisible(state.player,player,vision));
          client.send('players',visible.map(({barriers:_barriers,hpBonus:_hp,attackBonus:_attack,defenseBonus:_defense,...player})=>({...player,exposed:player.id===id ? this.gameplay.visibleItems(id,now,id) : player.exposed,health:this.gameplay.healthFraction(player,now)})));
        } else client.send('players',players);
        client.send('control',state);
      }
    },STEP_MS);
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
    this.movementQueue.get(client.sessionId)?.splice(0);
    const state = this.players.get(client.sessionId);
    if (state) {
      state.route = [];
      state.player.moving = false;
    }
    await this.allowReconnection(client,30);
  }

  onReconnect(client:Client) {
    this.lastMatchView.delete(client.sessionId);
    this.lastPhotos.delete(client.sessionId);
  }

  onLeave(client: Client) {
    this.leaveVoice(client.sessionId);
    this.lastMatchView.delete(client.sessionId);
    this.lastPhotos.delete(client.sessionId);
    this.npcTalk.leave(client.sessionId);
    const player = this.players.get(client.sessionId)?.player;
    if (player) this.gameplay.leave(player,this.gameplayWorld(),true);
    this.match.leave(client.sessionId,this.clock.currentTime);
    this.resetFinishedMatch(this.clock.currentTime);
    this.players.delete(client.sessionId);
    this.lastFieldToken.delete(client.sessionId);
    this.movementQueue.delete(client.sessionId);
  }
}
