import { defineRoom, defineServer } from 'colyseus';
import { BunWebSockets } from '@colyseus/bun-websockets';
import { SessionRoom } from './SessionRoom';

const server = defineServer({
  transport: new BunWebSockets({maxPayloadLength:4096,idleTimeout:60}),
  rooms: { plenary: defineRoom(SessionRoom) },
  express: app => { app.get('/health', (_req,res) => res.json({ok:true,runtime:'bun'})); },
});
await server.listen(Number(process.env.PORT || 2568));
