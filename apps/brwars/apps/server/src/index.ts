import { BunWebSockets } from '@colyseus/bun-websockets';
import { defineRoom, defineServer, matchMaker } from 'colyseus';
import { MatchRoom } from './MatchRoom';
const port = Number(process.env.PORT || 2567);
const server = defineServer({
  transport: new BunWebSockets({ maxPayloadLength: 4096, idleTimeout: 60 }),
  rooms: { battle: defineRoom(MatchRoom) },
  express: (app) => {
    app.get('/health', (_req, res) => res.json({ ok: true, runtime: 'bun' }));
    app.get('/rooms/:roomId', async (req, res) => {
      res.setHeader('Cache-Control', 'no-store');
      try {
        const [room] = await matchMaker.query({
          roomId: req.params.roomId,
          name: 'battle',
          locked: false,
          clients: 1,
        });
        if (!room) {
          res.status(404).json({ error: 'Esta sala não está mais disponível.' });
          return;
        }
        res.json({ hasPassword: room.metadata?.hasPassword === true });
      } catch {
        res.status(503).json({ error: 'Não foi possível verificar o convite.' });
      }
    });
    app.get('/rooms', async (_req, res) => {
      try {
        const rooms = await matchMaker.query({
          name: 'battle',
          private: false,
          locked: false,
          clients: 1,
        });
        res.setHeader('Cache-Control', 'no-store');
        res.json(
          rooms.flatMap(({ roomId, metadata }) => {
            if (!metadata?.listed) return [];
            const { hostNick, hostSide, battlefield, hasPassword } = metadata;
            return [{ roomId, hostNick, hostSide, battlefield, hasPassword }];
          }),
        );
      } catch {
        res.status(503).json({ error: 'Não foi possível listar as salas.' });
      }
    });
  },
});
await server.listen(port);
console.log(`BR WARS game server · http://localhost:${port} · Bun ${Bun.version}`);
