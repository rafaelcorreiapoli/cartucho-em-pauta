import {
  BATTLEFIELDS,
  FACTIONS,
  opposite,
  type BattlefieldKind,
  type Side,
} from '@brwars/simulation';
import {
  ArrowLeft,
  ArrowRight,
  Flag,
  LockSimple,
  LockSimpleOpen,
  MapTrifold,
  Plus,
  Sword,
  UserCircle,
  UsersThree,
} from '@phosphor-icons/react';
import { useEffect, useState } from 'react';
import { battlefieldBackgrounds } from './battlefield-art';
import {
  listLobbyRooms,
  lookupInvitation,
  onlineEnabled,
  type LobbyRoom,
  type MatchRequest,
} from './session';
import './lobby.css';

const lobbyMaps = ['paulista', 'floresta', 'deserto'] as const;
const mapBanners: Partial<Record<BattlefieldKind, string>> = {
  paulista: '/assets/maps/paulista-banner.webp',
  floresta: '/assets/maps/reserva-banner.webp',
  deserto: '/assets/maps/deserto-banner.webp',
};

function mapPortrait(kind: BattlefieldKind) {
  return mapBanners[kind] ?? battlefieldBackgrounds[kind] ?? '/assets/maps/reserva-north.webp';
}

export function Lobby({
  invitation,
  busy,
  error,
  onStart,
  onDismissInvitation,
}: {
  invitation: string;
  busy: boolean;
  error: string;
  onStart: (request: MatchRequest) => void;
  onDismissInvitation: () => void;
}) {
  const [page, setPage] = useState<'mode' | 'local' | 'online' | 'create'>('mode');
  const [inviteProtection, setInviteProtection] = useState<boolean | null | 'loading' | 'error'>(
    'loading',
  );
  const [side, setSide] = useState<Side>('left');
  const [battlefield, setBattlefield] = useState<BattlefieldKind>('paulista');
  const [nick, setNick] = useState(() => {
    try {
      return localStorage.getItem('brwars.nick') ?? '';
    } catch {
      return '';
    }
  });
  const [protectedRoom, setProtectedRoom] = useState(false);
  const [password, setPassword] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [joining, setJoining] = useState<LobbyRoom | null>(null);
  const [joinPassword, setJoinPassword] = useState('');
  const [rooms, setRooms] = useState<LobbyRoom[]>([]);
  const [listStatus, setListStatus] = useState<'loading' | 'ready' | 'error'>('loading');

  useEffect(() => {
    if (page !== 'online') return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    const refresh = async () => {
      try {
        const result = await listLobbyRooms(controller.signal);
        if (controller.signal.aborted) return;
        setRooms(result);
        setListStatus('ready');
      } catch {
        if (controller.signal.aborted) return;
        setListStatus('error');
      }
      timer = setTimeout(refresh, 4000);
    };
    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [page]);

  useEffect(() => {
    if (!invitation || !onlineEnabled) return;
    const controller = new AbortController();
    void lookupInvitation(invitation, controller.signal).then(
      (protectedRoom) => {
        if (!controller.signal.aborted) setInviteProtection(protectedRoom);
      },
      () => {
        if (!controller.signal.aborted) setInviteProtection('error');
      },
    );
    return () => controller.abort();
  }, [invitation]);

  function updateNick(value: string) {
    setNick(value);
    try {
      localStorage.setItem('brwars.nick', value);
    } catch {
      // The lobby also works when browser storage is disabled.
    }
  }

  const nickField = (
    <label className="lobby-field">
      <span>
        <UserCircle /> Seu nick
      </span>
      <input
        value={nick}
        onChange={(event) => updateNick(event.target.value)}
        maxLength={24}
        autoComplete="nickname"
        required
        disabled={busy}
      />
    </label>
  );

  function join(roomId: string, secret?: string) {
    if (nick.trim() && roomId.trim()) {
      onStart({
        mode: 'join',
        roomId: roomId.trim(),
        nick: nick.trim(),
        password: secret || undefined,
      });
    }
  }

  if (invitation) {
    const unavailable = !onlineEnabled || inviteProtection === null || inviteProtection === 'error';
    return (
      <div className="lobby">
        {unavailable ? (
          <>
            <p role="alert">
              {!onlineEnabled
                ? 'O modo online está indisponível.'
                : inviteProtection === null
                  ? 'Esta sala não está mais disponível.'
                  : 'Não foi possível verificar o convite. Recarregue a página para tentar novamente.'}
            </p>
            <button className="lobby-back" onClick={onDismissInvitation}>
              <ArrowLeft /> Voltar ao lobby
            </button>
          </>
        ) : inviteProtection === 'loading' ? (
          <p role="status">Verificando convite…</p>
        ) : (
          <form
            className="lobby-join"
            onSubmit={(event) => {
              event.preventDefault();
              if (!inviteProtection || joinPassword)
                join(invitation, inviteProtection ? joinPassword : undefined);
            }}
          >
            {nickField}
            {inviteProtection && (
              <label className="lobby-field">
                <span>
                  <LockSimple /> Senha da sala
                </span>
                <input
                  type="password"
                  value={joinPassword}
                  onChange={(event) => setJoinPassword(event.target.value)}
                  maxLength={64}
                  required
                  disabled={busy}
                />
              </label>
            )}
            <button
              className="primary-button"
              disabled={busy || !nick.trim() || (inviteProtection && !joinPassword)}
            >
              {busy ? 'Entrando…' : 'Entrar'} <ArrowRight />
            </button>
          </form>
        )}
        {error && (
          <p className="lobby-error" role="alert">
            {error}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="lobby">
      {page !== 'mode' && (
        <button
          type="button"
          className="lobby-back"
          disabled={busy}
          onClick={() => {
            setJoining(null);
            setJoinPassword('');
            setPage(page === 'create' ? 'online' : 'mode');
          }}
        >
          <ArrowLeft /> Voltar
        </button>
      )}
      {page === 'mode' && (
        <div className="lobby-modes">
          <button onClick={() => setPage('local')}>
            <Sword weight="duotone" />
            <strong>Contra IA</strong>
            <small>Escolha seu lado e enfrente o computador.</small>
          </button>
          <button onClick={() => setPage('online')} disabled={!onlineEnabled}>
            <UsersThree weight="duotone" />
            <strong>Online</strong>
            <small>
              {onlineEnabled
                ? 'Crie uma sala ou entre em uma batalha 1v1.'
                : 'Indisponível nesta versão.'}
            </small>
          </button>
        </div>
      )}
      {page === 'online' && (
        <>
          <div className="lobby-toolbar">
            {nickField}
            <button
              className="primary-button"
              disabled={busy}
              onClick={() => {
                setJoining(null);
                setJoinPassword('');
                setPage('create');
              }}
            >
              <Plus /> Criar sala
            </button>
          </div>
          <h3>
            <UsersThree /> Salas abertas
          </h3>
          {listStatus === 'loading' && <p role="status">Buscando salas…</p>}
          {listStatus === 'error' && (
            <p role="status">A lista está indisponível. Tentando reconectar…</p>
          )}
          {listStatus === 'ready' && rooms.length === 0 && (
            <p role="status">Nenhuma sala aguardando jogadores.</p>
          )}
          <ul className="lobby-rooms">
            {rooms.map((room) => (
              <li key={room.roomId}>
                <div className="lobby-room">
                  <img src={mapPortrait(room.battlefield)} alt="" />
                  <div className="lobby-room-title">
                    <strong>{room.hostNick}</strong>
                    <small>{BATTLEFIELDS[room.battlefield]}</small>
                  </div>
                  <div className="lobby-room-details">
                    <strong data-faction={room.hostSide}>
                      Anfitrião · {FACTIONS[room.hostSide].name}
                    </strong>
                    <small>Você · {FACTIONS[opposite(room.hostSide)].name}</small>
                  </div>
                  <span className="lobby-room-lock">
                    {room.hasPassword ? <LockSimple /> : <LockSimpleOpen />}
                    {room.hasPassword ? 'Com senha' : 'Aberta'}
                  </span>
                  <button
                    className="outline-button"
                    disabled={busy}
                    onClick={() => {
                      setJoinPassword('');
                      if (room.hasPassword || !nick.trim()) setJoining(room);
                      else join(room.roomId);
                    }}
                  >
                    Entrar <ArrowRight />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {joining && (
            <form
              className="lobby-join"
              onSubmit={(event) => {
                event.preventDefault();
                join(joining.roomId, joinPassword);
              }}
            >
              <strong>Entrar na sala de {joining.hostNick}</strong>
              {!nick.trim() && <small>Preencha seu nick acima para entrar.</small>}
              {joining.hasPassword && (
                <label className="lobby-field">
                  Senha da sala
                  <input
                    autoFocus
                    type="password"
                    value={joinPassword}
                    onChange={(event) => setJoinPassword(event.target.value)}
                    maxLength={64}
                    required
                    disabled={busy}
                  />
                </label>
              )}
              <button
                className="primary-button"
                disabled={busy || !nick.trim() || (joining.hasPassword && !joinPassword)}
              >
                Confirmar entrada
              </button>
            </form>
          )}
          <details className="lobby-invite">
            <summary>Entrar por código</summary>
            <form
              className="lobby-toolbar"
              onSubmit={(event) => {
                event.preventDefault();
                const form = new FormData(event.currentTarget);
                join(roomCode, String(form.get('password') ?? ''));
              }}
            >
              <label className="lobby-field">
                Código da sala
                <input
                  value={roomCode}
                  onChange={(event) => setRoomCode(event.target.value)}
                  maxLength={64}
                  required
                  disabled={busy}
                />
              </label>
              <label className="lobby-field">
                Senha, se houver
                <input type="password" name="password" maxLength={64} disabled={busy} />
              </label>
              <button
                className="outline-button"
                disabled={busy || !nick.trim() || !roomCode.trim()}
              >
                Entrar
              </button>
            </form>
          </details>
        </>
      )}
      {(page === 'local' || page === 'create') && (
        <form
          className="lobby-setup"
          onSubmit={(event) => {
            event.preventDefault();
            if (page === 'local') onStart({ mode: 'local', side, battlefield });
            else if (nick.trim() && (!protectedRoom || password.trim()))
              onStart({
                mode: 'create',
                side,
                battlefield,
                nick: nick.trim(),
                password: protectedRoom ? password : undefined,
              });
          }}
        >
          {page === 'create' && nickField}
          <h3>
            <Flag /> Facção
          </h3>
          <div className="faction-choices">
            {(['left', 'right'] as const).map((value) => (
              <button
                type="button"
                key={value}
                className={`${value} ${side === value ? 'chosen' : ''}`}
                aria-pressed={side === value}
                disabled={busy}
                onClick={() => setSide(value)}
              >
                <Flag weight="fill" />
                <strong>{FACTIONS[value].name}</strong>
                <small>{FACTIONS[value].motto}</small>
              </button>
            ))}
          </div>
          <h3>
            <MapTrifold /> Cenário
          </h3>
          <div className="lobby-maps" aria-label="Cenários">
            {lobbyMaps.map((kind) => (
              <button
                type="button"
                key={kind}
                aria-pressed={battlefield === kind}
                disabled={busy}
                onClick={() => setBattlefield(kind)}
              >
                <img src={mapPortrait(kind)} alt="" />
                <strong>{BATTLEFIELDS[kind]}</strong>
              </button>
            ))}
          </div>
          {page === 'create' && (
            <div className="lobby-password">
              <button
                type="button"
                className="lobby-lock-toggle"
                aria-label="Proteger sala com senha"
                aria-pressed={protectedRoom}
                disabled={busy}
                onClick={() => setProtectedRoom(!protectedRoom)}
              >
                {protectedRoom ? <LockSimple /> : <LockSimpleOpen />}
                {protectedRoom ? 'Com senha' : 'Sala aberta'}
              </button>
              <label className="lobby-field">
                Senha da sala
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  maxLength={64}
                  required={protectedRoom}
                  disabled={busy || !protectedRoom}
                  placeholder={protectedRoom ? 'Digite a senha' : 'Opcional'}
                />
              </label>
            </div>
          )}
          <button
            className="primary-button"
            disabled={
              busy || (page === 'create' && (!nick.trim() || (protectedRoom && !password.trim())))
            }
          >
            {page === 'local' ? <Sword /> : <Plus />}
            {busy ? 'Preparando…' : page === 'local' ? 'Batalha contra IA' : 'Criar sala'}
          </button>
        </form>
      )}
      {error && (
        <p className="lobby-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
