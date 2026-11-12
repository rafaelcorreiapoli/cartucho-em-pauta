import { Room, type Client } from 'colyseus';
import { idle, move, NAMES, type Motion, type Player } from '../src/map';

export class SessionRoom extends Room {
  maxClients = 6;
  maxMessagesPerSecond = 40;
  private players = new Map<string, Player>();
  private movementInputs = new Map<string, { motion: Motion; received: number }>();

  onCreate() {
    this.onMessage('move', (client, data: unknown) => {
      if (!data || typeof data !== 'object' || !('x' in data) || !('y' in data)) return;
      const {x,y} = data;
      if (typeof x !== 'number' || typeof y !== 'number' || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const clamp = (n: number) => Math.max(-1,Math.min(1,n));
      this.movementInputs.set(client.sessionId, {motion:{x:clamp(x),y:clamp(y)}, received:Date.now()});
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
        move(player, input && now-input.received<350 ? input.motion : idle, 0.05);
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
    this.movementInputs.delete(client.sessionId);
  }
}
