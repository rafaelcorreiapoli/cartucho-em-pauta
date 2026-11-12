import { Client, type Room } from '@colyseus/sdk';
import { createGame } from './game';
import { createPlenaryPanel } from './plenary-panel';
import { MAX_PLAYERS, type PlenaryView } from './plenary';
import type { ControlState } from './movement';
import { NAMES, playerName, type Player } from './map';
import type { Disguise } from './live-disguise';
import { RoomVoice } from './voice';
import './style.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const lobby = document.querySelector<HTMLFormElement>('#lobby')!;
const code = document.querySelector<HTMLInputElement>('#room-id')!;
const status = document.querySelector<HTMLElement>('#connection')!;
const session = document.querySelector<HTMLElement>('#session')!;
const map = document.querySelector<HTMLElement>('#map')!;
const create = document.querySelector<HTMLButtonElement>('#create')!;
const invite = document.querySelector<HTMLButtonElement>('#invite')!;
const leave = document.querySelector<HTMLButtonElement>('#leave')!;
const characters = document.querySelector<HTMLElement>('#characters')!;
const buttons = NAMES.map((name,index) => {
  const button = document.createElement('button');
  button.textContent = name;
  button.type = 'button';
  button.setAttribute('aria-pressed','false');
  button.onclick = () => {
    room?.send('character',index);
    map.focus({preventScroll:true});
  };
  characters.append(button);
  return button;
});
const voiceToggle = document.querySelector<HTMLButtonElement>('#voice-toggle')!;
const voiceLeave = document.querySelector<HTMLButtonElement>('#voice-leave')!;
const voiceStatus = document.querySelector<HTMLElement>('#voice-status')!;
const voiceSpeaking = document.querySelector<HTMLElement>('#voice-speaking')!;
const livePanel = document.querySelector<HTMLFieldSetElement>('#live-disguise')!;
const liveEnabled = document.querySelector<HTMLInputElement>('#live-disguise-enabled')!;
const livePitch = document.querySelector<HTMLInputElement>('#live-pitch')!;
const livePitchValue = document.querySelector<HTMLOutputElement>('#live-pitch-value')!;
const liveStyle = document.querySelector<HTMLSelectElement>('#live-style')!;
const liveStatus = document.querySelector<HTMLElement>('#live-disguise-status')!;
let disguiseRevision = 0;
let voice: RoomVoice | undefined;
let playersInRoom: Player[] = [];
let speaking = new Set<string>();
let matchRunning = false;
let room: Room | undefined;
let game: ReturnType<typeof createGame> | undefined;
code.value = new URL(location.href).searchParams.get('sala') || '';

function updateSpeaking() {
  const names = playersInRoom.filter(player => speaking.has(player.id)).map(player =>
    player.id === room?.sessionId ? 'Você' : playerName(player,playersInRoom,matchRunning));
  if ([...speaking].some(id => !playersInRoom.some(player => player.id===id))) names.push('voz próxima');
  const label = names.length ? 'Falando: '+names.join(', ') : '';
  if (voiceSpeaking.textContent !== label) voiceSpeaking.textContent = label;
}

async function updateDisguise() {
  const current = voice;
  if (!current?.active) return;
  const revision = ++disguiseRevision;
  const pitch = livePitch.valueAsNumber;
  livePitchValue.value = `${pitch>0 ? '+' : ''}${pitch} ${Math.abs(pitch)===1 ? 'semitom' : 'semitons'}`;
  livePitch.disabled = liveStyle.disabled = !liveEnabled.checked;
  liveStatus.textContent = liveEnabled.checked ? 'Aplicando disfarce…' : '';
  try {
    await current.setDisguise(liveEnabled.checked ? {pitch,style:liveStyle.value as Disguise['style']} : undefined);
    if (revision===disguiseRevision) liveStatus.textContent = liveEnabled.checked ? 'Disfarce ativo' : '';
  } catch {
    if (revision===disguiseRevision) liveStatus.textContent = 'Falha no disfarce. Desative para voltar à voz original.';
  }
}
liveEnabled.onchange = liveStyle.onchange = () => void updateDisguise();
livePitch.oninput = () => void updateDisguise();

function resetVoiceButtons() {
  voiceToggle.disabled = false;
  voiceToggle.textContent = 'Ativar voz';
  voiceLeave.hidden = true;
  voiceStatus.textContent = '';
  ++disguiseRevision;
  livePanel.hidden = true;
  liveEnabled.checked = false;
  livePitch.disabled = liveStyle.disabled = true;
  liveStatus.textContent = '';
}

voiceToggle.onclick = async () => {
  const current = voice;
  if (!current) return;
  if (current.active) {
    current.toggleMute();
    voiceToggle.textContent = current.muted ? 'Ativar microfone' : 'Silenciar microfone';
    return;
  }
  voiceToggle.disabled = true;
  voiceStatus.textContent = 'Ativando microfone…';
  try {
    await current.start();
    if (current !== voice || !current.active) return;
    voiceToggle.textContent = 'Silenciar microfone';
    voiceLeave.hidden = false;
    livePanel.hidden = false;
  } catch (error) {
    if (current !== voice) return;
    voiceStatus.textContent = !window.isSecureContext ? 'O microfone precisa de HTTPS ou localhost.' :
      error instanceof DOMException && error.name === 'NotAllowedError' ?
        'Permita o microfone no navegador e tente novamente.' : 'Não foi possível abrir o microfone.';
  } finally {
    if (current === voice) voiceToggle.disabled = false;
  }
};

voiceLeave.onclick = () => {
  voice?.stop();
  resetVoiceButtons();
};

function showLobby(message: string) {
  voice?.stop(false);
  voice = undefined;
  playersInRoom = [];
  matchRunning = false;
  resetVoiceButtons();
  game?.destroy();
  game = undefined;
  room = undefined;
  session.hidden = true;
  lobby.hidden = false;
  status.textContent = message;
}

async function connect(join: () => Promise<Room>) {
  if (room || create.disabled) return;
  create.disabled = true;
  status.textContent = 'Conectando…';
  try {
    const joined = await join();
    room = joined;
    voice = new RoomVoice(joined, ids => {
      speaking = ids;
      game?.setSpeaking(ids);
      updateSpeaking();
    }, (connected, peers) => {
      voiceStatus.textContent = peers === 0 ? 'Voz ativa · aguardando outras pessoas' :
        `Voz ativa · ${connected}/${peers} conexões`;
    });
    code.value = joined.roomId;
    lobby.hidden = true;
    session.hidden = false;
    characters.hidden = false;
    status.textContent = `Sala ${joined.roomId}`;
    game = createGame(map,joined.sessionId,input => joined.send('input',input));
    const panel = createPlenaryPanel(joined.sessionId,(type,data) => {
      joined.send(type,data);
      if (type!=='bill-vote') map.focus({preventScroll:true});
    });
    let phase: PlenaryView['phase'] = 'lobby';
    let count = 1;
    const updateRoomLabel = () => {
      const label = `Sala ${joined.roomId} · ${count}/${MAX_PLAYERS} jogadores`;
      if (status.textContent!==label) status.textContent = label;
    };
    joined.onMessage('plenary',(view: PlenaryView) => {
      panel.render(view);
      count = view.players;
      updateRoomLabel();
      if (phase===view.phase) return;
      phase = view.phase;
      const negotiating = phase==='negotiation';
      voice?.setRange(negotiating ? new Map() : undefined);
      matchRunning = negotiating || phase==='ballot';
      game?.setMatchPhase(phase);
      characters.hidden = negotiating || phase==='ballot';
    });
    joined.onMessage('control',(snapshot: ControlState) => game?.reconcile(snapshot));
    joined.onMessage('players',(players: Player[]) => {
      playersInRoom = players;
      panel.players(players);
      game?.update(players);
      updateSpeaking();
      const self = players.find(player => player.id===joined.sessionId);
      buttons.forEach((button,index) => button.setAttribute('aria-pressed',String(index===self?.character)));
    });
    joined.onLeave(() => {
      if (room===joined) showLobby('Você saiu da sala.');
    });
    map.focus({preventScroll:true});
  } catch {
    showLobby('Não foi possível conectar. Confira o código e se o servidor está rodando.');
  } finally {
    create.disabled = false;
  }
}

create.onclick = () => void connect(() => client.create('plenary'));
lobby.onsubmit = event => {
  event.preventDefault();
  const roomId = code.value.trim();
  if (roomId) void connect(() => client.joinById(roomId));
};
leave.onclick = () => void room?.leave();
invite.onclick = async () => {
  if (!room) return;
  const url = new URL(location.href);
  url.searchParams.set('sala',room.roomId);
  try {
    await navigator.clipboard.writeText(url.href);
    invite.textContent = 'Link copiado';
    setTimeout(() => { invite.textContent = 'Copiar link'; },1500);
  } catch {
    window.prompt('Link da sala',url.href);
  }
};

if (import.meta.env.DEV) void import('./voice-test').then(({mountVoiceTest}) => mountVoiceTest());
