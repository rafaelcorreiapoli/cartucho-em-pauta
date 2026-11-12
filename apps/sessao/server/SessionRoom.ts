import { Room, type Client } from 'colyseus';
import { HEIGHT, idle, move, NAMES, WIDTH, type Motion, type Player } from '../src/map';
import { findRoute, followRoute } from './navigation';

export class SessionRoom extends Room {
  maxClients = 6;
  maxMessagesPerSecond = 40;
  private players = new Map<string, Player>();
  private movementInputs = new Map<string, { motion: Motion; received: number }>();

  private routes = new Map<string,Motion[]>();

  onCreate() {
    this.onMessage('move', (client, data: unknown) => {
      if (!data || typeof data !== 'object' || !('x' in data) || !('y' in data)) return;
      const {x,y} = data;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      this.routes.delete(client.sessionId);
      const clamp = (n: number) => Math.max(-1,Math.min(1,n));
      this.movementInputs.set(client.sessionId, {motion:{x:clamp(x),y:clamp(y)}, received:Date.now()});
    });
    this.onMessage('destination', (client, data: unknown) => {
      const player = this.players.get(client.sessionId);
      if (!player || !data || typeof data !== 'object' || !('x' in data) || !('y' in data)) return;
      const {x,y} = data;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      if (x<0 || y<0 || x>=WIDTH || y>=HEIGHT) return;
      this.movementInputs.delete(client.sessionId);
      this.routes.set(client.sessionId,findRoute(player,{x,y}));
    });
    this.onMessage('character', (client, character: unknown) => {
      const player = this.players.get(client.sessionId);
      if (player && typeof character === 'number' && Number.isInteger(character) && character >= 0 && character < NAMES.length) {
        player.character = character;
      }
    });
    this.setSimulationInterval(() => {
      const now = Date.now();
      for (const player of this.players.values()) {
        const input = this.movementInputs.get(player.id);
        const route = this.routes.get(player.id);
        if (route?.length) followRoute(player,route,.05);
        else move(player,input && now-input.received<350 ? input.motion : idle,.05);
      }
      this.broadcast('players', [...this.players.values()]);
    }, 50);
  }

  onJoin(client: Client) {
    const occupied = new Set([...this.players.values()].map(player => player.character));
    const character = NAMES.findIndex((_, index) => !occupied.has(index));
    this.players.set(client.sessionId, {
      id:client.sessionId, character:Math.max(0,character), x:140+this.players.size*36, y:146, direction:0, moving:false,
    });
  }

  onLeave(client: Client) {
    this.players.delete(client.sessionId);
    this.routes.delete(client.sessionId);
    this.movementInputs.delete(client.sessionId);
  }
}
