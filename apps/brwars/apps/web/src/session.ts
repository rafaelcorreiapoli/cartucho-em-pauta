import {
  battlefieldKind,
  botAct,
  createGame,
  execute,
  opposite,
  step,
  type BattlefieldKind,
  type Command,
  type GameState,
  type Side,
} from '@brwars/simulation';
import { ColyseusSDK, type Room } from '@colyseus/sdk';
export interface ChatMessage {
  id: number;
  side: Side;
  nick: string;
  text: string;
}
export interface MatchChatChannel {
  getMessages(): readonly ChatMessage[];
  subscribe(listener: () => void): () => void;
  send(text: string): void;
}
export interface Session {
  getState(): GameState;
  side: Side;
  battlefield: BattlefieldKind;
  mode: 'local' | 'online';
  roomId?: string;
  chat?: MatchChatChannel;
  nicknames?: Record<Side, string>;
  dev?: {
    readonly turbo: boolean;
    addCash(): void;
    toggleTurbo(): void;
  };
  send(command: Command): void;
  subscribe(listener: () => void): () => void;
  close(): void;
}
export function localSession(side: Side, battlefield: BattlefieldKind = 'campo'): Session {
  const game = createGame('playing', battlefield);
  const listeners = new Set<() => void>();
  const refresh = () => {
    for (const listener of listeners) listener();
  };
  let turbo = false;
  let botTime = 0;
  let uiTick = 0;
  let timer: ReturnType<typeof setInterval> | undefined;
  const tick = () => {
    step(game, 0.05, import.meta.env.DEV && turbo ? side : undefined);
    botTime += 0.05;
    if (botTime >= 4) {
      botTime = 0;
      botAct(game, opposite(side));
    }
    if (++uiTick % 2 === 0) refresh();
  };
  return {
    side,
    mode: 'local',
    battlefield,
    dev: import.meta.env.DEV
      ? {
          get turbo() {
            return turbo;
          },
          addCash() {
            if (game.status !== 'playing') return;
            game.players[side].cash += 10_000;
            refresh();
          },
          toggleTurbo() {
            if (game.status !== 'playing') return;
            turbo = !turbo;
            refresh();
          },
        }
      : undefined,
    getState: () => game,
    send(command) {
      const error = execute(game, side, command);
      if (error) throw new Error(error);
      refresh();
    },
    subscribe(listener) {
      listeners.add(listener);
      if (!timer) timer = setInterval(tick, 50);
      return () => {
        listeners.delete(listener);
        if (!listeners.size) {
          clearInterval(timer);
          timer = undefined;
        }
      };
    },
    close() {
      clearInterval(timer);
      timer = undefined;
      listeners.clear();
    },
  };
}
export const onlineEnabled =
  import.meta.env.VITE_ENABLE_ONLINE === 'true' ||
  (import.meta.env.DEV && import.meta.env.VITE_ENABLE_ONLINE !== 'false');
const endpoint =
  import.meta.env.VITE_GAME_SERVER ||
  `${globalThis.location?.protocol === 'https:' ? 'wss:' : 'ws:'}//${globalThis.location?.hostname ?? 'localhost'}:2567`;
export interface LobbyRoom {
  roomId: string;
  hostNick: string;
  hostSide: Side;
  battlefield: BattlefieldKind;
  hasPassword: boolean;
}
export type MatchRequest =
  | { mode: 'local'; side: Side; battlefield: BattlefieldKind }
  | {
      mode: 'create';
      side: Side;
      battlefield: BattlefieldKind;
      nick: string;
      password?: string;
    }
  | { mode: 'join'; roomId: string; nick: string; password?: string };

function lobbyUrl(path: string) {
  const url = new URL(endpoint.replace(/^ws/, 'http'));
  url.pathname = url.pathname.replace(/\/$/, '') + path;
  return url;
}

export async function listLobbyRooms(signal: AbortSignal): Promise<LobbyRoom[]> {
  const response = await fetch(lobbyUrl('/rooms'), { signal });
  if (!response.ok) throw new Error('Não foi possível listar as salas.');
  return response.json();
}

export async function lookupInvitation(roomId: string, signal: AbortSignal) {
  const response = await fetch(lobbyUrl(`/rooms/${encodeURIComponent(roomId)}`), { signal });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error('Não foi possível verificar o convite.');
  const { hasPassword }: { hasPassword: boolean } = await response.json();
  return hasPassword;
}

export async function onlineSession(
  request: Exclude<MatchRequest, { mode: 'local' }>,
  notify: (message: string) => void,
): Promise<Session> {
  if (!onlineEnabled) throw new Error('Esta versão está disponível apenas contra IA.');
  const client = new ColyseusSDK(endpoint);
  const { nick, password } = request;
  const room: Room =
    request.mode === 'join'
      ? await client.joinById(request.roomId, { nick, password })
      : await client.create('battle', {
          side: request.side,
          battlefield: request.battlefield,
          publicRoom: true,
          nick,
          password,
        });
  room.reconnection.minUptime = 0;
  room.reconnection.maxRetries = 10;
  let game = createGame('waiting', battlefieldKind(room.state?.battlefield));
  const listeners = new Set<() => void>();
  let messages: readonly ChatMessage[] = [];
  const chatListeners = new Set<() => void>();
  const session: Session = {
    side: request.mode === 'create' ? request.side : 'left',
    mode: 'online',
    battlefield: battlefieldKind(room.state?.battlefield),
    roomId: room.roomId,
    chat: {
      getMessages: () => messages,
      subscribe(listener) {
        chatListeners.add(listener);
        return () => chatListeners.delete(listener);
      },
      send(text) {
        room.send('chat', text);
      },
    },
    getState: () => game,
    send(command) {
      room.send('command', command);
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    close() {
      listeners.clear();
      chatListeners.clear();
      void room.leave();
    },
  };
  const update = () => {
    if (room.state?.players?.size === 2) {
      game = room.state.toJSON() as GameState;
      session.battlefield = battlefieldKind(room.state.battlefield);
      session.nicknames = { left: room.state.leftNick, right: room.state.rightNick };
      for (const listener of listeners) listener();
    }
  };
  room.onMessage('seat', (assigned: Side) => {
    session.side = assigned;
    for (const listener of listeners) listener();
  });
  room.onMessage('notice', notify);
  room.onMessage('chat', (message: ChatMessage) => {
    messages = [...messages.slice(-49), message];
    for (const listener of chatListeners) listener();
  });
  room.onStateChange(update);
  room.onDrop(() => notify('Conexão caiu. Tentando reconectar por até 30s…'));
  room.onReconnect(() => {
    notify('Conexão restabelecida.');
    room.send('identify');
  });
  room.onLeave(() => notify('Conexão encerrada. Volte ao menu para uma nova partida.'));
  room.onError((_code, message) => notify(message || 'Falha na conexão.'));
  room.send('identify');
  update();
  return session;
}
