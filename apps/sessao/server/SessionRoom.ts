import { readElectionAction } from '../src/elections';
import { readVoiceSignal } from '../src/voice-protocol';
import { Room, ServerError, type Client } from 'colyseus';
import { localPerception, NAMES, type Player } from '../src/map';
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

  private match = new PlenaryMatch();
  private lastMatchView = new Map<string,string>();

  private voice = new Set<string>();

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
      if (this.match.start(client.sessionId,[...this.players.values()].map(({player}) => player),this.clock.currentTime,Math.random,count===2 ? 2 : 1)) void this.lock();
    });
    this.onMessage('plenary-action', (client, action:unknown) => {
      const player = this.players.get(client.sessionId)?.player;
      if (player && (action==='amendment' || action==='audit' || action==='panel' || action==='fraud')) {
        const result = this.match.act(player,action,this.clock.currentTime);
        if (result) client.send('audit-result',result);
      }
    });
    this.onMessage('politics', (client, raw:unknown) => {
      const action = readPoliticsAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (action && player) this.match.politics(player,action,[...this.players.values()].map(state => state.player),this.clock.currentTime);
    });
    this.onMessage('election', (client, raw:unknown) => {
      const action = readElectionAction(raw);
      const player = this.players.get(client.sessionId)?.player;
      if (action && player) this.match.electionAction(player,action,this.clock.currentTime,this.voice.has(player.id));
    });
    this.onMessage('bill-vote', (client, vote:unknown) => {
      if (vote==='yes' || vote==='no') this.match.vote(client.sessionId,vote,this.clock.currentTime);
    });
    this.onMessage('input', (client, data: unknown) => {
      const input = readInput(data);
      const state = this.players.get(client.sessionId);
      const queue = this.movementQueue.get(client.sessionId);
      if (!input || !state || !queue || input.seq <= (queue.at(-1)?.seq ?? state.ack)) return;
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
        else state.player.moving = false;
      }
      const players = [...this.players.values()].map(state => state.player);
      const running = this.match.running;
      const now = this.clock.currentTime;
      this.match.advance(now);
      if (running && !this.match.running) void this.unlock();
      const speaker = this.match.speaker(now);
      const ids = players.map(({id}) => id);
      for (const client of this.clients) {
        const id = client.sessionId;
        const state = this.players.get(id);
        if (!state) continue;
        const view = this.match.view(id,ids,now,this.match.contacts(state.player,players));
        const key = JSON.stringify(view);
        if (this.lastMatchView.get(id)!==key) {
          client.send('plenary',view);
          this.lastMatchView.set(id,key);
        }
        if (this.match.running) {
          const nearby = players.map(player => ({player,...localPerception(state.player,player)}));
          client.send('players',nearby.filter(entry => entry.visible).map(entry => entry.player));
          if (view.phase==='negotiation' && this.voice.has(id)) client.send('voice-range',nearby
            .map(entry => entry.player.id===speaker ? {...entry,volume:1} : entry)
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

  onLeave(client: Client) {
    this.leaveVoice(client.sessionId);
    this.lastMatchView.delete(client.sessionId);
    const running = this.match.running;
    this.match.leave(client.sessionId,this.clock.currentTime);
    if (running && !this.match.running) void this.unlock();
    this.players.delete(client.sessionId);
    this.movementQueue.delete(client.sessionId);
  }
}
