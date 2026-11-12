import {
  battlefieldKind,
  addLog,
  createGame,
  execute,
  finish,
  opposite,
  step,
  type Side,
} from '@brwars/simulation';
import { ErrorCode, Room, ServerError, type Client } from 'colyseus';
import { MatchState, syncState } from './state';
function nickname(value: unknown) {
  return typeof value === 'string' ? value.trim().slice(0, 24) : '';
}

export class MatchRoom extends Room<{ state: MatchState }> {
  maxClients = 2;
  state = new MatchState();
  game = createGame('waiting');
  seats = new Map<string, Side>();
  private rates = new Map<string, { since: number; count: number }>();
  private chatRates = new Map<string, { since: number; count: number }>();
  private nextChatId = 0;
  private passwordHash?: string;
  private publicRoom = false;
  async onCreate(options: {
    side?: Side;
    battlefield?: unknown;
    publicRoom?: unknown;
    nick?: unknown;
    password?: unknown;
  }) {
    const hostSide = options.side === 'right' ? 'right' : 'left';
    const battlefield = battlefieldKind(options.battlefield);
    this.publicRoom = options.publicRoom === true;
    const hostNick = nickname(options.nick) || 'Anfitrião';
    if (options.password !== undefined) {
      if (
        typeof options.password !== 'string' ||
        !options.password.trim() ||
        options.password.length > 64
      )
        throw new ServerError(ErrorCode.AUTH_FAILED, 'Informe uma senha de até 64 caracteres.');
      this.passwordHash = await Bun.password.hash(options.password);
    }
    this.game = createGame('waiting', battlefield);
    await this.setMatchmaking({
      private: !this.publicRoom,
      metadata: { hostSide, battlefield, hostNick, hasPassword: !!this.passwordHash },
    });
    this.patchRate = 100;
    this.onMessage('command', (client, command: unknown) => {
      const side = this.seats.get(client.sessionId);
      if (!side || this.game.status !== 'playing') return;
      const now = Date.now();
      const rate = this.rates.get(client.sessionId) ?? { since: now, count: 0 };
      if (now - rate.since > 1000) {
        rate.since = now;
        rate.count = 0;
      }
      this.rates.set(client.sessionId, rate);
      if (++rate.count > 12) {
        client.send('notice', 'Muitas ações. Aguarde um instante.');
        return;
      }
      const error = execute(this.game, side, command);
      if (error) client.send('notice', error);
      syncState(this.state, this.game);
    });
    this.onMessage('chat', (client, payload: unknown) => {
      const side = this.seats.get(client.sessionId);
      if (!side || this.game.status !== 'playing' || typeof payload !== 'string') return;
      if (payload.length > 240) return;
      const text = payload.replace(/\s+/g, ' ').trim();
      if (!text) return;
      const now = Date.now();
      let rate = this.chatRates.get(client.sessionId);
      if (!rate || now - rate.since >= 5000) {
        rate = { since: now, count: 0 };
        this.chatRates.set(client.sessionId, rate);
      }
      if (rate.count >= 5) {
        if (rate.count === 5) {
          rate.count++;
          client.send('notice', 'Aguarde um instante antes de enviar outra mensagem.');
        }
        return;
      }
      rate.count++;
      const nick = side === 'left' ? this.state.leftNick : this.state.rightNick;
      this.broadcast('chat', { id: ++this.nextChatId, side, nick, text });
    });
    this.onMessage('identify', (client) => client.send('seat', this.seats.get(client.sessionId)));
    this.setSimulationInterval(() => {
      step(this.game, 0.05);
      syncState(this.state, this.game);
    }, 50);
    this.clock.setTimeout(
      () => {
        if (this.game.status === 'waiting') this.disconnect();
      },
      10 * 60 * 1000,
    );
    syncState(this.state, this.game);
  }
  async onAuth(_client: Client, options: { password?: unknown }) {
    if (!this.passwordHash) return true;
    const password = options.password;
    if (
      typeof password !== 'string' ||
      password.length > 64 ||
      !(await Bun.password.verify(password, this.passwordHash))
    )
      throw new ServerError(ErrorCode.AUTH_FAILED, 'Senha incorreta ou ausente.');
    return true;
  }
  async onJoin(client: Client, options: { nick?: unknown }) {
    const hostSide = this.metadata?.hostSide === 'right' ? 'right' : 'left';
    const side: Side = this.seats.size === 0 ? hostSide : opposite(hostSide);
    const nick = nickname(options.nick) || (this.seats.size === 0 ? 'Anfitrião' : 'Visitante');
    if (side === 'left') this.state.leftNick = nick;
    else this.state.rightNick = nick;
    this.seats.set(client.sessionId, side);
    client.send('seat', side);
    if (this.seats.size === 2) {
      void this.lock();
      this.game.status = 'playing';
      addLog(this.game, 'As duas civilizações estão prontas. Batalha iniciada!');
    }
    syncState(this.state, this.game);
    if (this.seats.size === 1 && this.publicRoom)
      await this.setMetadata({ ...this.metadata, listed: true });
  }
  async onDrop(client: Client) {
    try {
      await this.allowReconnection(client, 30);
    } catch {
      /* Colyseus invokes onLeave when the reconnection window expires. */
    }
  }
  onLeave(client: Client) {
    const side = this.seats.get(client.sessionId);
    if (side && this.game.status === 'playing') {
      finish(this.game, opposite(side));
      addLog(this.game, 'O adversário abandonou o campo de batalha.');
    }
    this.seats.delete(client.sessionId);
    this.rates.delete(client.sessionId);
    this.chatRates.delete(client.sessionId);
    syncState(this.state, this.game);
  }
}
