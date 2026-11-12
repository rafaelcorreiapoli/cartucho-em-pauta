import { Client, type Room } from '@colyseus/sdk';
import { createElectionPanel } from './election-panel';
import { createGame } from './game';
import { createPoliticsPanel } from './politics-panel';
import { createPlenaryPanel } from './plenary-panel';
import { MAX_PLAYERS, type PlenaryView } from './plenary';
import type { ControlState } from './movement';
import { NAMES, playerName, type Player } from './map';
import type { Disguise } from './live-disguise';
import { RoomVoice } from './voice';
import '../../../packages/hud/styles.css';
import './style.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const lobby = document.querySelector<HTMLFormElement>('#lobby')!;
const landing = document.querySelector<HTMLElement>('#landing')!;
const roomLabel = document.querySelector<HTMLElement>('#room-label')!;
const setup = document.querySelector<HTMLElement>('#room-setup')!;
const roster = document.querySelector<HTMLUListElement>('#room-roster')!;
const voiceSettings = document.querySelector<HTMLDetailsElement>('#voice-settings')!;
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
  button.type = 'button';
  button.className = 'hud-option character-option';
  const portrait = document.createElement('span');
  portrait.className = 'portrait';
  portrait.style.setProperty('--portrait-row',String(index*3));
  portrait.setAttribute('aria-hidden','true');
  button.append(portrait,name);
  button.setAttribute('aria-pressed','false');
  button.onclick = () => {
    room?.send('character',index);
  };
  characters.append(button);
  return button;
});
const voiceToggle = document.querySelector<HTMLButtonElement>('#voice-toggle')!;
const voiceLabel = voiceToggle.querySelector('span')!;
const voiceLeave = document.querySelector<HTMLButtonElement>('#voice-leave')!;
const voiceStatus = document.querySelector<HTMLElement>('#voice-status')!;
const voiceSpeaking = document.querySelector<HTMLElement>('#voice-speaking')!;
const liveEnabled = document.querySelector<HTMLInputElement>('#live-disguise-enabled')!;
const livePitch = document.querySelector<HTMLInputElement>('#live-pitch')!;
const livePitchValue = document.querySelector<HTMLOutputElement>('#live-pitch-value')!;
const liveStyle = document.querySelector<HTMLSelectElement>('#live-style')!;
const liveStatus = document.querySelector<HTMLElement>('#live-disguise-status')!;
let disguiseRevision = 0;
let voice: RoomVoice | undefined;
let playersInRoom: Player[] = [];
let speaking = new Set<string>();
let broadcaster: {id:string; name:string} | undefined;
let matchRunning = false;
let voiceIsLocal = false;
let room: Room | undefined;
let game: ReturnType<typeof createGame> | undefined;
code.value = new URL(location.href).searchParams.get('sala') || '';

function updateSpeaking() {
  const names = playersInRoom.filter(player => speaking.has(player.id)).map(player =>
    player.id === room?.sessionId ? 'Você' : playerName(player,playersInRoom,matchRunning));
  if (broadcaster && speaking.has(broadcaster.id) && !playersInRoom.some(player => player.id===broadcaster!.id)) names.push(broadcaster.name);
  if ([...speaking].some(id => id!==broadcaster?.id && !playersInRoom.some(player => player.id===id))) names.push(voiceIsLocal ? 'voz próxima' : 'voz na sessão');
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
  voiceLabel.textContent = 'Ativar voz';
  voiceSettings.hidden = true;
  voiceSettings.open = false;
  voiceStatus.textContent = '';
  ++disguiseRevision;
  liveEnabled.checked = false;
  livePitch.disabled = liveStyle.disabled = true;
  liveStatus.textContent = '';
}

voiceToggle.onclick = async () => {
  const current = voice;
  if (!current) return;
  if (current.active) {
    current.toggleMute();
    voiceLabel.textContent = current.muted ? 'Ativar microfone' : 'Silenciar microfone';
    return;
  }
  voiceToggle.disabled = true;
  voiceStatus.textContent = 'Ativando microfone…';
  try {
    await current.start();
    if (current !== voice || !current.active) return;
    voiceLabel.textContent = 'Silenciar microfone';
    voiceSettings.hidden = false;
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
  landing.hidden = false;
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
    landing.hidden = true;
    session.dataset.phase = 'lobby';
    voiceIsLocal = false;
    session.hidden = false;
    setup.hidden = false;
    roster.replaceChildren();
    document.querySelector<HTMLElement>('#politics-dock')!.hidden = true;
    roomLabel.textContent = `Sala ${joined.roomId}`;
    game = createGame(map,joined.sessionId,input => joined.send('input',input));
    const election = createElectionPanel(joined.sessionId,action => joined.send('election',action),() => voice?.active ?? false);
    const political = createPoliticsPanel(joined.sessionId,action => joined.send('politics',action),() => map.focus({preventScroll:true}));
    const panel = createPlenaryPanel(joined.sessionId,(type,data) => {
      joined.send(type,data);
      if (type!=='bill-vote') map.focus({preventScroll:true});
    });
    let phase: PlenaryView['phase'] = 'lobby';
    let rosterKey = '';
    joined.onMessage('plenary',(view: PlenaryView) => {
      panel.render(view);
      political.render(view);
      election.render(view);
      broadcaster = view.election?.broadcast;
      const label = `Sala ${joined.roomId} · ${view.players}/${MAX_PLAYERS}`;
      if (roomLabel.textContent!==label) roomLabel.textContent = label;
      if (phase===view.phase) return;
      phase = view.phase;
      session.dataset.phase = phase;
      const negotiating = phase==='negotiation';
      voiceIsLocal = negotiating;
      voiceToggle.title = negotiating ? 'Voz por proximidade' : 'Voz geral da sala';
      voice?.setRange(negotiating ? new Map() : undefined);
      matchRunning = negotiating || phase==='ballot' || phase==='hearing';
      game?.setMatchPhase(phase);
      setup.hidden = matchRunning;
      if (negotiating) map.focus({preventScroll:true});
    });
    joined.onMessage('control',(snapshot: ControlState) => game?.reconcile(snapshot));
    joined.onMessage('players',(players: Player[]) => {
      playersInRoom = players;
      panel.players(players);
      political.players(players);
      election.players(players);
      game?.update(players);
      updateSpeaking();
      const self = players.find(player => player.id===joined.sessionId);
      for (const [index,button] of buttons.entries()) {
        const pressed = String(index===self?.character);
        if (button.getAttribute('aria-pressed')!==pressed) button.setAttribute('aria-pressed',pressed);
      }
      if (matchRunning) return;
      const names = players.map(player => playerName(player,players)+(player.id===joined.sessionId ? ' (você)' : ''));
      const key = names.join('|');
      if (rosterKey===key) return;
      rosterKey = key;
      roster.replaceChildren(...names.map(name => {
        const slot = document.createElement('li');
        slot.textContent = name;
        return slot;
      }));
    });
    joined.onLeave((closeCode,reason) => {
      election.destroy();
      if (room!==joined) return;
      broadcaster = undefined;
      const outdated = closeCode===4002 && reason?.includes('not registered');
      showLobby(outdated ? 'O servidor da sala está desatualizado. Atualize o servidor e crie outra sala.' : 'Você saiu da sala.');
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
