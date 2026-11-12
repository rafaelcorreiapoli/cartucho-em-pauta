import { LoadingScreen } from './LoadingScreen';
import type { LoadingState } from './loading-assets';
import { bindSessionPageLifecycle } from './session-lifecycle';
import { trackHeroDeploymentAudio } from './audio/heroDeploymentAudio';
import {
  battlefieldLayout,
  usesPaulistaLayout,
  debtService,
  employment,
  GLOBAL_POWERS,
  unemploymentRate,
  unemploymentPopularityRate,
  income,
  ownsPlot,
  opposite,
  populationCapacity,
  populationUsed,
  type GlobalPowerKind,
} from '@brwars/simulation';
import {
  ArrowRight,
  ArrowsClockwise,
  Broadcast,
  ChartLineUp,
  Check,
  Coins,
  Copy,
  Flag,
  Info,
  List,
  Trophy,
  UsersThree,
  UserGear,
  X,
} from '@phosphor-icons/react';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { AudioControls, gameAudio } from './audio';
import { Battlefield } from './Battlefield';
import { homeCamera, type CameraView } from './camera';
import { FinanceHUD, TaxControl } from './FinanceHUD';
import { GlobalPowers } from './GlobalPowers';
import { GlobalUpgradeHUD } from './GlobalUpgradeHUD';
import { BuildingUpgradeBatches } from './hud/BuildingUpgradeBatches';
import { MatchChat } from './hud/MatchChat';
import { HeroRosterHUD } from './HeroRosterHUD';
import { HudTooltip } from './HudTooltip';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  basePosition,
  buildingPosition,
  laneX,
  laneY,
  mapPoint,
} from './map-layout';
import { PopularityMeter } from './PopularityMeter';
import {
  controlGroupMembers,
  nextFreePlot,
  resolveSelection,
  type ControlGroupMember,
  type MapSelection,
} from './selection';
import { workerPose } from './workers';
import { SelectionHUD } from './SelectionHUD';
import { Lobby } from './Lobby';
import { localSession, onlineSession, type MatchRequest, type Session } from './session';
const GROUP_DOUBLE_PRESS_MS = 350;
const money = (value: number) => `R$ ${Math.floor(value).toLocaleString('pt-BR')}`;
const clock = (seconds: number) =>
  `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
export default function App() {
  const [loading, setLoading] = useState<LoadingState>({
    progress: 0,
    ready: false,
    phase: 'Carregando recursos…',
  });
  const onLoadingChange = useCallback((state: LoadingState) => setLoading(state), []);
  const [started, setStarted] = useState(false);
  const [starting, setStarting] = useState(false);
  const [inMatch, setInMatch] = useState(false);
  const startBattle = async () => {
    setStarting(true);
    await gameAudio.unlock();
    setModal('new');
    setStarted(true);
    setStarting(false);
  };
  const [selectedPower, setSelectedPower] = useState<GlobalPowerKind>('bills');
  const [session, setSession] = useState<Session>(() => localSession('left', 'paulista'));
  const [, refresh] = useState(0);
  const [cameraView, setCameraView] = useState<CameraView>(() =>
    homeCamera('left', undefined, 'left', 'paulista'),
  );
  const updateCamera = useCallback(
    (view: CameraView) =>
      setCameraView((previous) =>
        Math.abs(previous.x - view.x) < 0.1 &&
        Math.abs(previous.y - view.y) < 0.1 &&
        previous.width === view.width &&
        previous.height === view.height
          ? previous
          : view,
      ),
    [],
  );
  const [cameraTarget, setCameraTarget] = useState<{ x: number; y: number; serial: number } | null>(
    null,
  );
  const navigateMap = (event: React.PointerEvent<HTMLDivElement>) => {
    const bounds = event.currentTarget.getBoundingClientRect();
    setCameraTarget({
      x: ((event.clientX - bounds.left) / bounds.width) * MAP_WIDTH,
      y: ((event.clientY - bounds.top) / bounds.height) * MAP_HEIGHT,
      serial: performance.now(),
    });
  };
  const [selection, setSelection] = useState<MapSelection>(null);
  const controlGroups = useRef(new Map<string, ControlGroupMember[]>());
  const lastGroupPress = useRef<{ digit: string; time: number } | null>(null);
  const [invitation, setInvitation] = useState(
    () => new URLSearchParams(location.search).get('room')?.trim() ?? '',
  );
  const [modal, setModal] = useState<'new' | 'help' | null>(invitation ? 'new' : null);
  const [busy, setBusy] = useState(false);
  const [lobbyError, setLobbyError] = useState('');
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    if (!loading.ready || !started || !inMatch) return;
    const deploymentSounds = trackHeroDeploymentAudio(
      session.getState().players[session.side].heroes ?? [],
    );
    const enemyDeaths = trackHeroDeploymentAudio(
      session.getState().players[opposite(session.side)].heroes ?? [],
      { entryQuotes: false },
    );
    const unsubscribe = session.subscribe(() => {
      for (const sound of [
        ...deploymentSounds(session.getState().players[session.side].heroes ?? []),
        ...enemyDeaths(session.getState().players[opposite(session.side)].heroes ?? []),
      ])
        gameAudio.play(sound);
      refresh((n) => n + 1);
    });
    const unbindLifecycle = bindSessionPageLifecycle(window, session);
    return () => {
      unsubscribe();
      unbindLifecycle();
    };
  }, [session, loading.ready, started, inMatch]);
  useEffect(() => {
    if (!notice) return;
    const timer = setTimeout(() => setNotice(''), 5000);
    return () => clearTimeout(timer);
  }, [notice]);
  const game = session.getState();
  const preMatch = !inMatch || game.status === 'waiting';
  const playing = loading.ready && started && inMatch && game.status === 'playing' && !modal;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!playing || event.metaKey || document.querySelector('[role="dialog"]')) return;
      const typing =
        event.target instanceof HTMLElement &&
        (event.target.isContentEditable ||
          event.target.closest('[data-match-chat]') ||
          ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName));
      if (event.key === 'Tab' && !event.ctrlKey && !event.altKey) {
        event.preventDefault();
        if (event.repeat || typing) return;
      } else if (event.repeat || typing) return;
      const key = event.key.toLowerCase();
      const assigningGroup = event.ctrlKey || event.altKey;
      const previousPress = lastGroupPress.current;
      lastGroupPress.current = null;
      if (!assigningGroup && key === 'escape') {
        setSelection(null);
        return;
      }
      if (!assigningGroup && key === 'tab') {
        const plot = nextFreePlot(session.getState(), session.side, selection, event.shiftKey);
        if (!plot) return;
        setSelection({ kind: 'plot', side: session.side, slot: plot.slot });
        setCameraTarget({
          ...buildingPosition(session.side, plot.slot, session.side, session.battlefield),
          serial: performance.now(),
        });
        gameAudio.play('select');
        return;
      }
      const digit = /^[0-9]$/.test(key) ? key : /^(?:Digit|Numpad)([0-9])$/.exec(event.code)?.[1];
      if (digit && !event.shiftKey) {
        event.preventDefault();
        const game = session.getState();
        const groups = controlGroups.current;
        if (assigningGroup) {
          const members = controlGroupMembers(game, session.side, [selection]);
          if (members.length) {
            groups.set(digit, members);
            setNotice(`Grupo ${digit} salvo.`);
          } else setNotice('Selecione uma unidade ou construção aliada para salvar o grupo.');
        } else {
          const group = groups.get(digit);
          if (!group) return;
          const members = controlGroupMembers(game, session.side, group);
          if (members.length) groups.set(digit, members);
          else groups.delete(digit);
          const member = members[0];
          setSelection(member ?? null);
          if (!member) return;
          if (
            previousPress?.digit === digit &&
            event.timeStamp - previousPress.time <= GROUP_DOUBLE_PRESS_MS
          ) {
            const { side: viewer, battlefield } = session;
            const entity = resolveSelection(game, member);
            let position;
            switch (entity.kind) {
              case 'unit':
                position = {
                  x: laneX(entity.unit.x, viewer, battlefield),
                  y: laneY(entity.unit.row, battlefield, entity.unit.x, viewer),
                };
                break;
              case 'worker':
                position = workerPose(entity.side, entity.index, game.time, viewer, battlefield);
                break;
              case 'base':
                position = basePosition(entity.side, viewer, battlefield);
                break;
              case 'plot':
                position = buildingPosition(entity.side, entity.slot, viewer, battlefield);
                break;
            }
            if (position)
              setCameraTarget({ x: position.x, y: position.y, serial: performance.now() });
          } else lastGroupPress.current = { digit, time: event.timeStamp };
        }
        return;
      }
      if (assigningGroup) return;
      const powerKey =
        event.shiftKey &&
        digit &&
        Number(digit) > 0 &&
        Number(digit) <= Object.keys(GLOBAL_POWERS).length
          ? digit
          : undefined;
      const scope = powerKey ? '.global-spellbar' : '.contextual-commands';
      const button = Array.from(
        document.querySelectorAll<HTMLButtonElement>(`${scope} button[data-command-hotkey]`),
      ).find((button) => button.dataset.commandHotkey === (powerKey ?? key));
      if (button) {
        event.preventDefault();
        if (!button.disabled) button.click();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [playing, selection, session]);
  const layout = battlefieldLayout(session.battlefield);
  const { route } = layout;
  const road = mapPoint(layout.road);
  const own = game.players[session.side];
  useEffect(() => {
    if (game.status === 'finished' && game.winner !== 'draw')
      gameAudio.play(game.winner === session.side ? 'victory' : 'defeat');
  }, [game.status, game.winner, session]);
  const send: Session['send'] = (command) => {
    try {
      session.send(command);
      if (command.type === 'build') gameAudio.play('build');
      if (command.type === 'upgrade' || command.type === 'upgrade-batch') gameAudio.play('upgrade');
    } catch (error) {
      setNotice((error as Error).message);
    }
  };
  async function start(request: MatchRequest) {
    setBusy(true);
    setLobbyError('');
    try {
      if (!started) {
        await gameAudio.unlock();
        setStarted(true);
      }
      const next =
        request.mode === 'local'
          ? localSession(request.side, request.battlefield)
          : await onlineSession(request, setNotice);
      session.close();
      controlGroups.current.clear();
      lastGroupPress.current = null;
      setSession(next);
      setInMatch(true);
      setSelection(null);
      setCameraTarget(null);
      setModal(null);
      setInvitation('');
      setNotice(
        request.mode === 'local'
          ? 'Batalha iniciada. Prepare suas forças.'
          : 'Sala conectada. Compartilhe o convite.',
      );
      history.replaceState(null, '', location.pathname);
    } catch (error) {
      setLobbyError(error instanceof Error ? error.message : 'Não foi possível iniciar a partida.');
    } finally {
      setBusy(false);
    }
  }
  async function copyInvite() {
    try {
      await navigator.clipboard.writeText(
        `${location.origin}${location.pathname}?room=${session.roomId}`,
      );
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setNotice(`Código da sala: ${session.roomId}`);
    }
  }
  return (
    <div
      className={`rts-game faction-${session.side} economy-enabled`}
      data-pre-match={preMatch}
      data-playing={playing}
    >
      {(!loading.ready || (!started && !invitation)) && (
        <LoadingScreen state={loading} onStart={() => void startBattle()} starting={starting} />
      )}
      <header className="resource-rail">
        <div className="game-logo">
          <Flag weight="fill" />
          <b>
            BASE <span>ALIADA</span>
          </b>
        </div>
        <div className="resource gold" data-hud-tooltip="Recursos disponíveis">
          <Coins weight="duotone" />
          <span>
            <b>{money(own.cash)}</b>
            <small>RECURSOS</small>
          </span>
        </div>
        <div className="resource income-resource" data-hud-tooltip="Renda líquida por segundo">
          <ChartLineUp />
          <span>
            <b>
              {income(own) - debtService(own) >= 0 ? '+' : '−'}
              {money(Math.abs(income(own) - debtService(own)))}/s
            </b>
            <small>RENDA</small>
          </span>
        </div>
        <div
          className="resource employment-resource"
          data-hud-tooltip={`${employment(own).employed} empregados · ${employment(own).unemployed} desempregados · ${employment(own).vacancies} vagas livres. Trabalhadores sem emprego não geram renda. Desemprego: ${(unemploymentRate(own) * 100).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% · ${unemploymentPopularityRate(own).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} POP/s.`}
        >
          <UserGear />
          <span>
            <b>
              {own.workers} / {employment(own).jobs}
            </b>
            <small>TRABALHO</small>
          </span>
        </div>
        <div
          className="resource"
          data-hud-tooltip="População ocupada: trabalhadores, tropas e vagas reservadas na produção"
        >
          <UsersThree />
          <span>
            <b>
              {populationUsed(game, session.side)}
              <em> / {populationCapacity(own)}</em>
            </b>
            <small>POPULAÇÃO</small>
          </span>
        </div>
        <PopularityMeter player={own} />
        <TaxControl player={own} playing={game.status === 'playing'} send={send} />
        <div className="rail-spacer" />
        {import.meta.env.DEV && session.dev && (
          <div className="dev-controls" role="group" aria-label="Ferramentas de desenvolvimento">
            <button
              type="button"
              className="menu-button"
              onClick={session.dev.addCash}
              disabled={game.status !== 'playing'}
              title="Adicionar R$ 10.000"
            >
              +R$ 10k
            </button>
            <button
              type="button"
              className="menu-button"
              onClick={session.dev.toggleTurbo}
              disabled={game.status !== 'playing'}
              aria-pressed={session.dev.turbo}
              title="Concluir obras e melhorias imediatamente"
            >
              Turbo {session.dev.turbo ? 'ligado' : 'desligado'}
            </button>
          </div>
        )}
        <AudioControls />
        <span className="game-timer">{clock(game.time)}</span>
        <button className="menu-button" onClick={() => setModal('help')} aria-label="Como jogar">
          <Info />
        </button>
        <button
          className="menu-button"
          onClick={() => {
            setLobbyError('');
            setModal('new');
          }}
        >
          <List /> MENU
        </button>
      </header>
      <HudTooltip />
      <GlobalPowers
        game={game}
        side={session.side}
        selected={selectedPower}
        onSelect={setSelectedPower}
        onCast={(kind) => send({ type: 'power', kind })}
      />
      <div className="world-status-hud">
        <FinanceHUD
          player={own}
          playing={game.status === 'playing'}
          send={send}
          onBank={() => {
            const bank = own.buildings.find((building) => building.kind === 'bank');
            const freePlots = layout.plots[session.side].filter(
              ({ slot }) => !own.buildings.some((building) => building.slot === slot),
            );
            const empty =
              freePlots.find(({ slot }) => ownsPlot(own, slot))?.slot ?? freePlots[0]?.slot;
            const slot = bank?.slot ?? empty;
            if (slot !== undefined) {
              setSelection({ kind: 'plot', side: session.side, slot });
              const position = buildingPosition(
                session.side,
                slot,
                session.side,
                session.battlefield,
              );
              setCameraTarget({ ...position, serial: performance.now() });
            }
          }}
        />
        <HeroRosterHUD
          game={game}
          side={session.side}
          onSelect={(hero, unit) => {
            setSelection({ kind: 'hero', side: session.side, hero });
            if (unit)
              setCameraTarget({
                x: laneX(unit.x, session.side, session.battlefield),
                y: laneY(unit.row, session.battlefield, unit.x, session.side),
                serial: performance.now(),
              });
            gameAudio.play('select');
          }}
        />
        <GlobalUpgradeHUD player={own} />
      </div>
      <main
        className="warzone"
        data-layout={usesPaulistaLayout(session.battlefield) ? 'paulista' : undefined}
        aria-label="Campo de batalha"
        onContextMenu={(event) => {
          if (
            playing &&
            !(event.target instanceof Element && event.target.closest('[data-match-chat]'))
          )
            event.preventDefault();
        }}
      >
        <Battlefield
          onLoadingChange={onLoadingChange}
          cameraTarget={cameraTarget}
          onCameraChange={updateCamera}
          session={session}
          selection={selection}
          onSelect={(next) => {
            setSelection(next);
            if (next) gameAudio.play('select');
          }}
          onUpgrade={(slot) => send({ type: 'upgrade', slot })}
        />
        {game.status === 'playing' && (
          <BuildingUpgradeBatches player={own} side={session.side} send={send} />
        )}
        {session.mode === 'online' && (
          <div className="match-state">
            <span className="live-dot" />
            1V1 · ONLINE
          </div>
        )}
        {game.status === 'playing' && session.chat && (
          <MatchChat key={session.roomId} channel={session.chat} side={session.side} />
        )}
        <div className="field-events" aria-live="polite">
          {game.log.slice(0, 3).map((event) => (
            <div key={event.id}>
              <Broadcast size={12} />
              {event.text}
            </div>
          ))}
        </div>
        {game.status === 'finished' && (
          <div className="arena-overlay">
            <section className="game-dialog">
              <Trophy size={42} weight="duotone" />
              <span className="eyebrow">BATALHA ENCERRADA</span>
              <h2>
                {game.winner === 'draw'
                  ? 'Empate'
                  : game.winner === session.side
                    ? 'Vitória!'
                    : 'Derrota'}
              </h2>
              <p>
                {game.winner === 'draw'
                  ? 'As duas bases foram destruídas ao mesmo tempo.'
                  : game.players.left.baseHp > 0 && game.players.right.baseHp > 0
                    ? 'Partida encerrada por abandono ou desconexão.'
                    : game.winner === session.side
                      ? 'A base inimiga foi destruída.'
                      : 'Sua base foi destruída. Reorganize suas forças.'}
              </p>
              <button
                className="primary-button"
                onClick={() => {
                  setLobbyError('');
                  setModal('new');
                }}
              >
                <ArrowsClockwise /> Nova batalha
              </button>
            </section>
          </div>
        )}
      </main>
      <section className="command-deck contextual-deck" aria-label="Centro de comando">
        <div className="minimap-panel metal-panel">
          <div
            className="minimap navigable-minimap"
            data-battlefield={session.battlefield}
            role="application"
            aria-label="Minimapa navegável. Clique ou arraste para mover a câmera."
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              navigateMap(event);
            }}
            onPointerMove={(event) => {
              if (event.buttons === 1) navigateMap(event);
            }}
          >
            {route.y !== route.endY ? (
              <svg
                className="minimap-diagonal-lane"
                viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <line
                  x1={road.x}
                  x2={road.x + road.width}
                  y1={road.y + road.height / 2}
                  y2={
                    road.y +
                    road.height / 2 +
                    (road.width * (route.endY - route.y)) / (route.to - route.from)
                  }
                  stroke="var(--minimap-road, #50514c)"
                  strokeWidth={road.height}
                />
              </svg>
            ) : (
              <div
                className="minimap-lane"
                style={{
                  left: `${(road.x / MAP_WIDTH) * 100}%`,
                  top: `${(road.y / MAP_HEIGHT) * 100}%`,
                  width: `${(road.width / MAP_WIDTH) * 100}%`,
                  height: `${(road.height / MAP_HEIGHT) * 100}%`,
                }}
              />
            )}
            <span
              className="mini-base left"
              style={{
                left: `${(basePosition('left', session.side, session.battlefield).x / MAP_WIDTH) * 100}%`,
                top: `${(basePosition('left', session.side, session.battlefield).y / MAP_HEIGHT) * 100}%`,
              }}
            />
            <span
              className="mini-base right"
              style={{
                left: `${(basePosition('right', session.side, session.battlefield).x / MAP_WIDTH) * 100}%`,
                top: `${(basePosition('right', session.side, session.battlefield).y / MAP_HEIGHT) * 100}%`,
              }}
            />
            {game.units.map((unit) => (
              <i
                key={unit.id}
                className={`mini-unit ${unit.side}`}
                style={{
                  left: `${(laneX(unit.x, session.side, session.battlefield) / MAP_WIDTH) * 100}%`,
                  top: `${(laneY(unit.row, session.battlefield, unit.x, session.side) / MAP_HEIGHT) * 100}%`,
                }}
              />
            ))}
            <div
              className="minimap-viewport"
              style={{
                left: `${(cameraView.x / MAP_WIDTH) * 100}%`,
                top: `${(cameraView.y / MAP_HEIGHT) * 100}%`,
                width: `${(cameraView.width / MAP_WIDTH) * 100}%`,
                height: `${(cameraView.height / MAP_HEIGHT) * 100}%`,
              }}
            />
          </div>
        </div>
        <SelectionHUD game={game} side={session.side} selection={selection} send={send} />
      </section>
      {game.status === 'waiting' && (
        <div className="arena-overlay lobby-waiting">
          <section className="game-dialog">
            <UsersThree size={36} />
            <span className="eyebrow">SALA 1V1</span>
            <h2>Aguardando o adversário</h2>
            <p>Compartilhe o convite para iniciar a guerra.</p>
            <button className="primary-button" onClick={copyInvite}>
              {copied ? <Check /> : <Copy />}
              {copied ? 'Convite copiado' : 'Copiar convite'}
            </button>
            <small>Código: {session.roomId}</small>
            <button
              className="outline-button"
              onClick={() => {
                setLobbyError('');
                setModal('new');
              }}
            >
              Abrir lobby
            </button>
          </section>
        </div>
      )}
      {notice && (
        <div className="toast" role="status">
          <Info size={18} />
          <span>{notice}</span>
          <button onClick={() => setNotice('')} aria-label="Fechar aviso">
            <X />
          </button>
        </div>
      )}
      {modal && loading.ready && (
        <div
          className={`modal-backdrop ${modal === 'new' ? 'lobby-backdrop' : ''}`}
          onClick={(event) => {
            if (event.target === event.currentTarget && !busy && (modal === 'help' || inMatch))
              setModal(null);
          }}
        >
          <section
            className={`game-dialog modal ${modal === 'new' ? 'lobby-dialog' : ''} ${modal === 'new' && invitation ? 'invitation-dialog' : ''}`}
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-title"
          >
            {(modal === 'help' || inMatch) && (
              <button
                className="modal-close"
                autoFocus
                aria-label="Fechar"
                disabled={busy}
                onClick={() => setModal(null)}
              >
                <X />
              </button>
            )}
            <span className="eyebrow">BASE ALIADA · V1</span>
            <h2 id="modal-title">
              {modal === 'new'
                ? invitation
                  ? 'Convite para partida'
                  : 'Lobby'
                : 'Manual de guerra'}
            </h2>
            {modal === 'new' ? (
              <Lobby
                invitation={invitation}
                busy={busy}
                error={lobbyError}
                onStart={(request) => void start(request)}
                onDismissInvitation={() => {
                  const url = new URL(location.href);
                  url.searchParams.delete('room');
                  history.replaceState(null, '', url);
                  setInvitation('');
                  setLobbyError('');
                  if (!started) void startBattle();
                }}
              />
            ) : (
              <>
                <p>Administre a civilização. Suas tropas fazem a guerra.</p>
                <p>
                  Câmera: dois dedos no trackpad, bordas do campo, setas ou arraste com o botão do
                  meio. Clique/arraste no minimapa. Home ou Espaço volta à base. Zoom: botões −/+,
                  slider ou pinça no trackpad; Shift + 0 restaura a visão inicial.
                </p>
                <ol className="instructions">
                  <li>
                    <b>Expanda sua base.</b> Clique em uma área demarcada no mapa. O HUD mostra o
                    que você pode construir naquele terreno. Clique em prédios, unidades e na base
                    para inspecionar e acessar suas ações.
                  </li>
                  <li>
                    <b>Combine seu exército.</b> Linha de frente protege. Ataques à distância
                    apoiam. Cerco causa dano dobrado à base.
                  </li>
                  <li>
                    <b>Sustente a produção.</b> Impostos acima de 10% reduzem popularidade; abaixo
                    disso ajudam a recuperar. Popularidade negativa reduz produtividade e, abaixo de
                    −100, atrasa unidades e obras. Feira e Estádio geram popularidade continuamente.
                    Construa um Banco para crédito e aplicações. Contratos, parcelas e vencimentos
                    ficam na faixa econômica.
                  </li>
                  <li>
                    <b>Recrute um herói.</b> Escolha na base. Adquira até três heróis diferentes,
                    uma vez cada. Abates próximos geram XP e níveis. Se morrerem, reviva no Hospital
                    preservando a progressão; o custo aumenta a cada recuperação. Aura de +20% não
                    acumula.
                  </li>
                  <li>
                    <b>Destrua a base inimiga.</b> A vitória acontece quando a base inimiga é
                    destruída. Não há derrota por limite de tempo nem desgaste automático.
                  </li>
                </ol>
                <p className="hotkey-guide">
                  Ctrl + 0–9 salva a unidade ou construção aliada em um grupo. Alt + número também
                  funciona. Pressione o número para selecionar o grupo ou duas vezes para
                  centralizar a câmera. Tab seleciona o próximo terreno livre e Shift + Tab volta ao
                  anterior. Shift + 1–{Object.keys(GLOBAL_POWERS).length} ativa magias globais. V
                  volta às categorias e Esc limpa a seleção.
                </p>
                <button className="primary-button" onClick={() => setModal(null)}>
                  Voltar à batalha <ArrowRight />
                </button>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
