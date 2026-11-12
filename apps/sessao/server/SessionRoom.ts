import { readVoiceSignal } from '../src/voice-protocol';
import { Room, type Client } from 'colyseus';
import { NAMES, type Player } from '../src/map';
import { applyInput, MAX_QUEUED_INPUTS, readInput, STEP_MS, type ControlState, type MovementInput } from '../src/movement';

export class SessionRoom extends Room {
  maxClients = 6;
  maxMessagesPerSecond = 100;
  private players = new Map<string, ControlState>();
  private movementQueue = new Map<string, MovementInput[]>();

  private voice = new Set<string>();

  private leaveVoice(id: string) {
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
      if (player && typeof character === 'number' && Number.isInteger(character) && character >= 0 && character < NAMES.length) {
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
      this.broadcast('players',players);
      for (const client of this.clients) {
        const state = this.players.get(client.sessionId);
        if (state) client.send('control',state);
      }
    },STEP_MS);
  }

  onJoin(client: Client) {
    const occupied = new Set([...this.players.values()].map(({player}) => player.character));
    const character = NAMES.findIndex((_, index) => !occupied.has(index));
    const player: Player = {
      id:client.sessionId, character:Math.max(0,character), x:140+this.players.size*36, y:146, direction:0, moving:false,
    };
    this.players.set(client.sessionId,{player,route:[],ack:0});
    this.movementQueue.set(client.sessionId,[]);
  }

  onLeave(client: Client) {
    this.leaveVoice(client.sessionId);
    this.players.delete(client.sessionId);
    this.movementQueue.delete(client.sessionId);
  }
}
