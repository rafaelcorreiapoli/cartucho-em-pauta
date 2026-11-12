import { characterStats } from '../src/character-stats';
import { emptyPhotoAccess } from '../src/photography';
import { canUseGameplayAction, readGameplayAction } from '../src/gameplay';
import { Gameplay } from './Gameplay';
import { roomActivities, type RoomActivity } from '../src/room-activities';
import { readElectionAction } from '../src/elections';
import { readVoiceSignal } from '../src/voice-protocol';
import { Room, ServerError, type Client } from 'colyseus';
import { localPerception, NAMES, PLENARY_SEATS, inPlenary, type Player } from '../src/map';
import { applyInput, MAX_QUEUED_INPUTS, readInput, STEP_MS, type ControlState, type MovementInput } from '../src/movement';

import { readPoliticsAction } from '../src/politics';
import { INVALID_NICK, NICK_TAKEN, nickHint, nickKey, readNick } from '../src/nick';
import { MAX_PLAYERS } from '../src/plenary';
import { PlenaryMatch } from './PlenaryMatch';

export class SessionRoom extends Room {
  maxClients = MAX_PLAYERS;
  maxMessagesPerSecond = 100;
  private players = new Map<string, ControlState>();
  private movementQueue = new Map<string, MovementInput[]>();

  private gameplay = new Gameplay();
  private matchObjectsActive = false;
  private gameplayWorld() {
    const world = this.match.gameplayWorld([...this.players.values()].map(({player})=>player),this.clock.currentTime,
      id=>this.voice.has(id));
    return {
      ...world,
      publish: (event:Parameters<typeof world.publish>[0]) => {
        world.publish(event);
        const pickup = event.type==='collected' || event.type==='recovered';
        const recipient = pickup ? event.actor : event.type==='transferred' ? event.target : event.type==='purchased' ? event.actor : undefined;
        if (recipient) this.clients.getById(recipient)?.send('item-obtained',pickup);
      },
    };
  }

  private match = new PlenaryMatch();
  private lastMatchView = new Map<string,string>();
  private lastPhotos = new Map<string,{revision:number; key:string}>();

  private voice = new Set<string>();

  private resetFinishedMatch(now:number) {
    if (!this.matchObjectsActive || this.match.running) return;
    this.matchObjectsActive = false;
    const players = [...this.players.values()].map(state=>state.player);
    this.gameplay.reset(now,Math.random,players);
    for (const player of players) player.speed = undefined;
    void this.unlock();
  }

  private leaveVoice(id: string) {
    this.match.stopBroadcast(id,this.clock.currentTime);
    if (this.voice.delete(id)) this.broadcast('voice-roster', [...this.voice]);
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
    this.onMessage('start-match', (client, count:unknown) => {
      const players = [...this.players.values()].map(state=>state.player);
      if (this.match.start(client.sessionId,players,this.clock.currentTime,Math.random,count===2 ? 2 : 1)) {
        this.gameplay.reset(this.clock.currentTime,Math.random,players);
        for (const player of players) player.speed = characterStats[player.character].speed;
        this.matchObjectsActive = true;
        void this.lock();
      }
    });
    this.onMessage('plenary-action', (client, action:unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (player && !player.knockedOut && (action==='amendment' || action==='audit' || action==='panel' || action==='fraud')) {
        const result = this.match.act(player,action,this.clock.currentTime);
        if (result) client.send('audit-result',result);
      }
    });
    this.onMessage('room-activity', (client, activity:unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (!player || player.knockedOut || typeof activity!=='string' || !Object.hasOwn(roomActivities,activity)) return;
      const result = this.match.roomActivity(player,activity as RoomActivity,this.clock.currentTime);
      if (result) client.send('room-activity-result',result);
    });
    this.onMessage('gameplay',(client, raw:unknown) => {
      const action = readGameplayAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || !this.match.canHandleObjects(player.id,this.clock.currentTime) ||
          !canUseGameplayAction(action,this.match.phase==='negotiation')) return;
      const text = this.gameplay.act(player,action,this.gameplayWorld());
      if (text) client.send('gameplay-feedback',text);
    });
    this.onMessage('politics', (client, raw:unknown) => {
      const action = readPoliticsAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (!action || !player || player.knockedOut) return;
      const now = this.clock.currentTime;
      this.match.politics(player,action,[...this.players.values()].map(state => state.player),now);
      this.resetFinishedMatch(now);
    });
    this.onMessage('election', (client, raw:unknown) => {
      const action = readElectionAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (action && player && !player.knockedOut) this.match.electionAction(player,action,this.clock.currentTime,this.voice.has(player.id));
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
          state.player.moving = false;
          if (state.player.knockedOut) state.route = [];
        }
      }
      const players = [...this.players.values()].map(state => state.player);
      const now = this.clock.currentTime;
      this.match.advance(now);
      const plenary = this.match.phase==='ballot';
      for (const [index,[id,state]] of [...this.players].entries()) {
        if (!!state.plenary===plenary) continue;
        state.plenary = plenary;
        state.route = [];
        state.player.moving = false;
        this.movementQueue.get(id)?.splice(0);
        if (plenary) Object.assign(state.player,PLENARY_SEATS[index],{direction:2});
      }
      this.resetFinishedMatch(now);
      const world = this.gameplayWorld();
      this.gameplay.tick(world,this.match.phase==='negotiation');
      for (const player of players) {
        player.phone = this.match.running ? this.gameplay.phoneActivity(player.id) : undefined;
        player.exposed = this.match.running ? this.gameplay.visibleItem(player.id) : undefined;
      }
      const speaker = this.match.speaker(now);
      const ids = players.map(({id}) => id);
      for (const client of this.clients) {
        const id = client.sessionId;
        const state = this.players.get(id);
        if (!state) continue;
        const view = this.match.view(id,ids,now,this.match.contacts(state.player,players));
        if (this.match.canHandleObjects(id,now)) view.gameplay = this.gameplay.view(state.player,world);
        const photoRevision = this.match.running ? this.gameplay.photoRevision : -1;
        const lastPhotos = this.lastPhotos.get(id);
        if (lastPhotos?.revision!==photoRevision) {
          const photos = this.match.running ? this.gameplay.photoView(id,now) : emptyPhotoAccess;
          const key = JSON.stringify(photos);
          this.lastPhotos.set(id,{revision:photoRevision,key});
          if (lastPhotos?.key!==key && (lastPhotos || this.match.running)) client.send('photo-state',photos);
        }
        const key = JSON.stringify(view);
        if (this.lastMatchView.get(id)!==key) {
          client.send('plenary',view);
          this.lastMatchView.set(id,key);
        }
        if (this.match.running) {
          const nearby = players.map(player => ({player,...localPerception(state.player,player,this.gameplay.vision(id))}));
          client.send('players',plenary ? players.filter(inPlenary) : nearby.filter(entry => entry.visible).map(entry => entry.player));
          if (view.phase==='negotiation' && this.voice.has(id)) client.send('voice-range',nearby
            .map(entry => entry.player.id===speaker || entry.player.id===this.gameplay.callPeer(id) ? {...entry,volume:1} : entry)
            .filter(({player,volume}) => player.id!==id && volume>0 && this.voice.has(player.id))
            .map(({player,volume}) => [player.id,volume]));
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
    const player = this.players.get(client.sessionId)?.player;
    if (player) this.gameplay.leave(player,this.gameplayWorld(),true);
    this.match.leave(client.sessionId,this.clock.currentTime);
    this.resetFinishedMatch(this.clock.currentTime);
    this.players.delete(client.sessionId);
    this.movementQueue.delete(client.sessionId);
  }
}
