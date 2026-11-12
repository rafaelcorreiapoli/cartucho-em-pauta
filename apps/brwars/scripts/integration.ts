import { CloseCode, ColyseusSDK, type Room } from '@colyseus/sdk';
import assert from 'node:assert/strict';
const port = Number(process.env.BRWARS_INTEGRATION_PORT ?? 2579);
const remoteEndpoint = process.env.GAME_SERVER_URL;
const endpoint = remoteEndpoint || `ws://localhost:${port}`;
const server = remoteEndpoint
  ? null
  : Bun.spawn(['bun', 'apps/server/src/index.ts'], {
      cwd: new URL('..', import.meta.url).pathname,
      env: { ...process.env, PORT: String(port) },
      stdout: 'pipe',
      stderr: 'pipe',
    });
const rooms: Room[] = [];
async function until(test: () => boolean | Promise<boolean>, label: string, timeout = 6000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    if (await test()) return;
    await Bun.sleep(25);
  }
  throw new Error(`Timeout: ${label}`);
}
try {
  await until(async () => {
    try {
      return (await fetch(`${endpoint.replace(/^ws/, 'http')}/health`)).ok;
    } catch {
      return false;
    }
  }, 'Bun health');
  const sdk = new ColyseusSDK(endpoint);
  const roomsUrl = `${endpoint.replace(/^ws/, 'http')}/rooms`;
  const listRooms = async () => {
    const response = await fetch(roomsUrl);
    assert.ok(response.ok);
    return (await response.json()) as { roomId: string }[];
  };
  const password = 'segredo-de-teste';
  const host = await sdk.create('battle', {
    side: 'right',
    battlefield: 'paulista',
    publicRoom: true,
    nick: 'Rafa',
    password,
  });
  rooms.push(host);
  const notices: string[] = [];
  let hostSeat = '',
    guestSeat = '';
  host.onMessage('seat', (value) => {
    hostSeat = value;
  });
  host.onMessage('notice', (value) => notices.push(value));
  host.send('identify');
  await until(
    () => host.state?.status === 'waiting' && host.state?.players?.size === 2,
    'waiting state',
  );
  const waitingCash = host.state.players.get('right').cash;
  await Bun.sleep(200);
  assert.equal(host.state.time, 0);
  assert.equal(host.state.players.get('right').cash, waitingCash);
  const listing = (await listRooms()).find(({ roomId }) => roomId === host.roomId);
  assert.deepEqual(listing, {
    roomId: host.roomId,
    hostNick: 'Rafa',
    hostSide: 'right',
    battlefield: 'paulista',
    hasPassword: true,
  });
  const inviteUrl = `${roomsUrl}/${host.roomId}`;
  assert.deepEqual(await (await fetch(inviteUrl)).json(), { hasPassword: true });
  await assert.rejects(sdk.joinById(host.roomId, { password: 'incorreta' }), /Senha incorreta/);
  assert.equal(host.state.status, 'waiting');
  const guest = await sdk.joinById(host.roomId, { nick: 'Visitante de teste', password });
  rooms.push(guest);
  guest.onMessage('seat', (value) => {
    guestSeat = value;
  });
  guest.onMessage('notice', (value) => notices.push(value));
  guest.send('identify');
  await until(
    () =>
      host.state?.status === 'playing' &&
      guest.state?.status === 'playing' &&
      !!hostSeat &&
      !!guestSeat,
    'match started',
  );
  assert.equal(host.state.battlefield, 'paulista');
  assert.equal(guest.state.battlefield, 'paulista');
  assert.equal(hostSeat, 'right');
  assert.equal(guestSeat, 'left');
  assert.equal(guest.state.leftNick, 'Visitante de teste');
  assert.equal(guest.state.rightNick, 'Rafa');
  assert.ok(!(await listRooms()).some(({ roomId }) => roomId === host.roomId));
  assert.equal((await fetch(inviteUrl)).status, 404);

  const hostChat: unknown[] = [];
  const guestChat: unknown[] = [];
  host.onMessage('chat', (message) => hostChat.push(message));
  guest.onMessage('chat', (message) => guestChat.push(message));
  host.send('chat', { nick: 'Nome falso', text: 'Tentativa inválida' });
  host.send('chat', ' ');
  host.send('chat', 'x'.repeat(241));
  host.send('chat', '  Boa partida!  ');
  await until(() => hostChat.length === 1 && guestChat.length === 1, 'room chat broadcast');
  assert.deepEqual(hostChat[0], { id: 1, side: 'right', nick: 'Rafa', text: 'Boa partida!' });
  guest.send('chat', 'Igualmente!');
  await until(() => hostChat.length === 2 && guestChat.length === 2, 'room chat reply');
  assert.deepEqual(hostChat[1], {
    id: 2,
    side: 'left',
    nick: 'Visitante de teste',
    text: 'Igualmente!',
  });
  assert.deepEqual(guestChat, hostChat);
  for (let message = 0; message < 5; message++) host.send('chat', `Teste ${message}`);
  await until(
    () => guestChat.length === 6 && notices.some((notice) => notice.includes('outra mensagem')),
    'room chat rate limit',
  );

  host.send('command', {
    type: 'build',
    kind: 'media',
    slot: 1,
    side: 'left',
    constructionProgress: 1,
  });
  await until(
    () =>
      guest.state.players.get('right').buildings.length === 2 &&
      host.state.players.get('right').buildings.length === 2,
    'building synchronized',
  );
  assert.equal(
    host.state.players.get('left').buildings.length,
    1,
    'client cannot impersonate opponent',
  );
  assert.ok(
    host.state.players.get('right').buildings[1].constructionProgress < 0.5,
    'client cannot skip construction',
  );
  host.send('command', { type: 'upgrade', slot: 1 });
  await until(
    () => notices.some((notice) => notice.includes('construção')),
    'upgrade blocked during construction',
  );
  assert.equal(host.state.players.get('right').buildings[1].level, 1);
  assert.equal(guest.state.players.get('right').popularity, 0);
  host.send('command', { type: 'hero', hero: 'che' });
  await until(
    () => notices.some((notice) => notice.includes('civilização adversária')),
    'hero faction enforced',
  );
  host.send('command', { type: 'power', popularity: 999 });
  await until(
    () => notices.some((notice) => notice.includes('Requer:')),
    'power cannot bypass unlock requirements',
  );
  host.send('command', { type: 'instant', slot: 0, popularity: 999 });
  await until(
    () => notices.some((notice) => notice.includes('Comando desconhecido')),
    'removed instant production is rejected',
  );
  host.send('command', { type: 'build', kind: '__proto__', slot: 2 });
  host.send('command', { type: 'build', kind: 'media', slot: 1 });
  await until(() => notices.length >= 2, 'invalid commands rejected');
  assert.equal(host.state.players.get('right').buildings.length, 2);
  await until(
    () => host.state.players.get('right').buildings[1].constructionProgress === 1,
    'construction completes on Bun server',
    19000,
  );
  await until(
    () => guest.state.players.get('right').buildings[1].constructionProgress === 1,
    'construction completion synchronized',
  );
  assert.ok(
    host.state.players.get('right').buildings[1].progress < 3,
    'production starts only after completion',
  );
  host.send('command', { type: 'buy-plot', slot: 56 });
  await until(() => notices.includes('Terreno inválido.'), 'plot outside Paulista is rejected');
  host.send('command', { type: 'build', kind: 'civic', slot: 55 });
  await until(
    () => notices.some((notice) => notice.includes('Adquira')),
    'unowned plot rejects building',
  );
  await until(
    () => host.state.players.get('right').cash >= 430,
    'income covers land and civic building',
    20000,
  );
  host.send('command', { type: 'buy-plot', slot: 55 });
  await until(
    () => guest.state.players.get('right').ownedPlots.includes(55),
    'plot purchase synchronized',
  );
  host.send('command', { type: 'build', kind: 'civic', slot: 55 });
  await until(
    () =>
      guest.state.players
        .get('right')
        .buildings.some((building: { slot: number }) => building.slot === 55),
    'purchased plot synchronized',
  );
  host.send('command', { type: 'power', kind: '__proto__' });
  await until(
    () => notices.some((notice) => notice.includes('Poder global inválido')),
    'unknown global power rejected',
  );
  await until(() => host.state.units.length > 0, 'units synchronized');
  assert.equal(typeof guest.state.units[0].silencedUntil, 'number');
  assert.equal(typeof guest.state.units[0].strengthUntil, 'number');
  host.send('command', { type: 'auto-production', slot: 0, paused: true });
  host.send('command', { type: 'auto-production', slot: 1, paused: true });
  await until(
    () =>
      guest.state.players
        .get('right')
        .buildings.filter(
          (building: { slot: number }) => building.slot === 0 || building.slot === 1,
        )
        .every((building: { autoPaused: boolean }) => building.autoPaused),
    'automatic pause synchronized',
  );
  await until(
    () => host.state.players.get('right').cash >= 220,
    'income covers bank after paying unit production',
    15000,
  );
  host.send('command', { type: 'build', kind: 'bank', slot: 2 });
  await until(
    () =>
      guest.state.players
        .get('right')
        .buildings.some((building: { slot: number }) => building.slot === 2),
    'bank construction synchronized',
  );
  guest.send('command', { type: 'build', kind: 'civic', slot: 3 });
  await until(
    () =>
      host.state.players
        .get('left')
        .buildings.some(
          (b: { slot: number; constructionProgress: number }) =>
            b.slot === 3 && b.constructionProgress >= 1,
        ),
    'hero civic requirement completed',
    22000,
  );
  guest.send('command', { type: 'hero' });
  await until(
    () =>
      host.state.players
        .get('left')
        .trainingQueue.some((order: { kind: string }) => order.kind === 'hero'),
    'manual hero queued',
  );
  assert.ok(
    !host.state.units.some(
      (unit: { kind: string; side: string }) => unit.kind === 'hero' && unit.side === 'left',
    ),
    'hero is not instant',
  );
  await until(
    () =>
      host.state.units.some(
        (u: { side: string; kind: string }) => u.side === 'left' && u.kind === 'hero',
      ),
    'manual hero synchronized',
    16000,
  );
  assert.equal(
    host.state.units.find(
      (u: { side: string; kind: string }) => u.side === 'left' && u.kind === 'hero',
    ).hero,
    'jones',
    'hero identity synchronized',
  );
  assert.equal(host.state.players.get('left').heroBirthSerial, 1, 'hero birth event synchronized');
  assert.equal(
    host.state.players.get('left').heroes[0].hero,
    'jones',
    'persistent hero roster synchronized',
  );
  assert.equal(host.state.players.get('left').heroes[0].status, 'alive');
  guest.send('command', { type: 'medic', slot: 3 });
  await until(
    () => notices.some((notice) => notice.includes('Hospital concluído')),
    'medic requires a completed hospital, never the Base',
  );
  assert.ok(
    !host.state.players
      .get('left')
      .trainingQueue.some((order: { kind: string }) => order.kind === 'medic'),
    'medic cannot enter Base queue',
  );
  assert.ok(
    host.state.players.get('left').heroCooldowns.get('jones') > 0,
    'individual hero cooldown synchronized',
  );
  await until(
    () =>
      host.state.players
        .get('right')
        .buildings.find((building: { slot: number }) => building.slot === 2)
        ?.constructionProgress === 1,
    'bank ready',
    5000,
  );
  host.send('command', { type: 'loan', product: 'bridge', principal: 999999 });
  host.send('command', { type: 'loan', product: 'bridge' });
  await until(
    () => guest.state.players.get('right').loans.length === 2,
    'multiple loans synchronized',
  );
  assert.equal(guest.state.players.get('right').loans[0].principal, 200);
  host.send('command', { type: 'invest', product: 'reserve' });
  host.send('command', { type: 'invest', product: 'reserve' });
  await until(
    () =>
      host.state.players.get('right').investments.length === 2 &&
      guest.state.players.get('right').investments.length === 2,
    'multiple investments synchronized',
  );
  const ownInvestment = host.state.players.get('right').investments[0].id;
  guest.send('command', { type: 'redeem', id: ownInvestment });
  await Bun.sleep(150);
  assert.equal(
    host.state.players.get('right').investments.length,
    2,
    'opponent cannot redeem contract',
  );
  host.send('command', { type: 'redeem', id: ownInvestment });
  await until(
    () => guest.state.players.get('right').investments.length === 1,
    'early redemption synchronized',
  );
  guest.send('command', { type: 'research', slot: 3, kind: 'base_artillery' });
  await until(
    () => notices.some((notice) => notice.includes('escola concluída')),
    'base artillery requires a completed school',
  );
  assert.equal(host.state.players.get('left').baseAttackLevel, 1);
  await assert.rejects(sdk.joinById(host.roomId), 'third player denied');
  guest.reconnection.minUptime = 0;
  let reconnected = false;
  guest.onReconnect(() => {
    reconnected = true;
  });
  guest.connection.close(CloseCode.MAY_TRY_RECONNECT, 'integration drop');
  await until(() => reconnected, 'automatic reconnection', 10000);
  assert.equal(host.state.status, 'playing', 'drop does not immediately forfeit');
  guest.send('command', { type: 'worker' });
  guest.send('command', { type: 'tax', rate: 7.5 });
  await until(
    () => host.state.players.get('left').taxRate === 7.5,
    'reconnected seat retains authority',
  );
  await guest.leave();
  await until(() => host.state.status === 'finished', 'consented leave forfeits');
  assert.equal(host.state.winner, 'right');
  console.log(
    'PASS · Bun transport, lobby listing and password, room chat, 2-player sync, faction ownership, malformed commands, hero, room lock, reconnection and forfeit',
  );
} catch (error) {
  console.error(error);
  server?.kill();
  if (server) console.error((await new Response(server.stderr).text()).slice(-5000));
  process.exitCode = 1;
} finally {
  for (const room of rooms) await room.leave().catch(() => {});
  server?.kill();
  if (server) await server.exited;
}
