import type { PhotoAccessView } from './photography';
import { createGameplayPanel } from './gameplay-panel';
import { showNewResults } from './results';
import { setCharacterPortrait } from './character-art';
import type { RoomActivityResult } from './room-activities';
import { createMatchHud } from './match-hud';
import { Client, type Room } from '@colyseus/sdk';
import { createElectionPanel } from './election-panel';
import { GameAudio } from './game-audio';
import { installHudHelp } from './hud-help';
import { createGame } from './game';
import { createPoliticsPanel } from './politics-panel';
import { createPlenaryPanel } from './plenary-panel';
import { MAX_PLAYERS, type PlenaryView } from './plenary';
import type { ControlState } from './movement';
import { NAMES, type Player } from './map';
import type { Disguise } from './live-disguise';
import { RoomVoice } from './voice';
import { INVALID_NICK, NICK_TAKEN, nickHint, readNick } from './nick';
import '../../../packages/hud/styles.css';
import './style.css';
import './match-hud.css';
import './rts-hud.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const audio = new GameAudio();
installHudHelp(document.querySelector('main')!);
const musicVolume = document.querySelector<HTMLInputElement>('#music-volume')!;
const effectsVolume = document.querySelector<HTMLInputElement>('#effects-volume')!;
const soundMute = document.querySelector<HTMLInputElement>('#sound-mute')!;
const soundPrefs = audio.preferences;
function syncSoundControls() {
  const prefs = soundPrefs.getSnapshot();
  musicVolume.value = String(Math.round(prefs.musicVolume*100));
  effectsVolume.value = String(Math.round(prefs.sfxVolume*100));
  soundMute.checked = prefs.muted;
}
musicVolume.oninput = () => soundPrefs.update({musicVolume:musicVolume.valueAsNumber/100});
effectsVolume.oninput = () => soundPrefs.update({sfxVolume:effectsVolume.valueAsNumber/100});
soundMute.onchange = () => soundPrefs.update({muted:soundMute.checked});
soundPrefs.subscribe(syncSoundControls);
syncSoundControls();
const lobby = document.querySelector<HTMLFormElement>('#lobby')!;
const landing = document.querySelector<HTMLElement>('#landing')!;
const roomLabel = document.querySelector<HTMLElement>('#room-label')!;
const setup = document.querySelector<HTMLElement>('#room-setup')!;
const roster = document.querySelector<HTMLUListElement>('#room-roster')!;
const voiceSettings = document.querySelector<HTMLDetailsElement>('#voice-settings')!;
const nickInput = document.querySelector<HTMLInputElement>('#nick')!;
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
  setCharacterPortrait(portrait,index);
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
const liveEnabled = document.querySelector<HTMLInputElement>('#live-disguise-enabled')!;
const livePitch = document.querySelector<HTMLInputElement>('#live-pitch')!;
const livePitchValue = document.querySelector<HTMLOutputElement>('#live-pitch-value')!;
const liveStyle = document.querySelector<HTMLSelectElement>('#live-style')!;
const disguiseIndicator = document.querySelector<HTMLElement>('#voice-disguise-indicator')!;
const liveStatus = document.querySelector<HTMLElement>('#live-disguise-status')!;
let disguiseRevision = 0;
let voice: RoomVoice | undefined;
let matchRunning = false;
let room: Room | undefined;
let game: ReturnType<typeof createGame> | undefined;
const nicknameStorage = 'cartuchao.sessao.nick';
try { nickInput.value = localStorage.getItem(nicknameStorage) ?? ''; } catch {}
nickInput.oninput = () => nickInput.setCustomValidity('');
code.value = new URL(location.href).searchParams.get('sala') || '';

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
    if (revision===disguiseRevision) {
      liveStatus.textContent = liveEnabled.checked ? 'Disfarce ativo' : '';
      disguiseIndicator.hidden = !liveEnabled.checked;
    }
  } catch {
    if (revision===disguiseRevision) liveStatus.textContent = 'Falha no disfarce. Desative para voltar à voz original.';
  }
}
liveEnabled.onchange = liveStyle.onchange = () => void updateDisguise();
livePitch.oninput = () => void updateDisguise();

function resetVoiceButtons() {
  voiceToggle.disabled = false;
  voiceToggle.dataset.voice = 'off';
  voiceLabel.textContent = voiceToggle.title = 'Ativar voz';
  voiceSettings.hidden = true;
  voiceSettings.open = false;
  voiceStatus.textContent = '';
  ++disguiseRevision;
  disguiseIndicator.hidden = true;
  liveEnabled.checked = false;
  livePitch.disabled = liveStyle.disabled = true;
  liveStatus.textContent = '';
}

voiceToggle.onclick = async () => {
  const current = voice;
  if (!current) return;
  if (current.active) {
    current.toggleMute();
    voiceToggle.dataset.voice = current.muted ? 'muted' : 'live';
    voiceLabel.textContent = voiceToggle.title = current.muted ? 'Ativar microfone' : 'Silenciar microfone';
    return;
  }
  voiceToggle.disabled = true;
  voiceStatus.textContent = 'Ativando microfone…';
  try {
    await current.start();
    if (current !== voice || !current.active) return;
    voiceToggle.dataset.voice = 'live';
    voiceLabel.textContent = voiceToggle.title = 'Silenciar microfone';
    voiceStatus.textContent = '';
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
  audio.leave();
  voice?.stop(false);
  voice = undefined;
  matchRunning = false;
  resetVoiceButtons();
  game?.destroy();
  game = undefined;
  room = undefined;
  document.querySelector<HTMLDialogElement>('#campaign-dialog')?.close();
  document.querySelector<HTMLDialogElement>('#result-dialog')?.close();
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
      audio.setSpeaking(ids.size>0);
    });
    code.value = joined.roomId;
    landing.hidden = true;
    session.dataset.phase = 'lobby';
    session.hidden = false;
    setup.hidden = false;
    const voiceDock = document.querySelector<HTMLElement>('#voice-dock')!;
    const voiceLobby = document.querySelector<HTMLElement>('#voice-lobby')!;
    const voiceHost = document.querySelector<HTMLElement>('#voice-host')!;
    voiceLobby.append(voiceDock);
    const closeDetails = () => {
      for (const panel of session.querySelectorAll<HTMLDetailsElement>('details[name="game-panels"][open]')) panel.open = false;
    };
    closeDetails();
    const hudListeners = new AbortController();
    document.addEventListener('keydown',event=>{
      if (event.defaultPrevented || event.key!=='Escape' || document.querySelector('dialog:modal') ||
        !session.querySelector('details[name="game-panels"][open]')) return;
      closeDetails();
      map.focus({preventScroll:true});
    },{signal:hudListeners.signal});
    const roomBar = document.querySelector<HTMLElement>('#room-bar')!;
    const roomSettings = document.querySelector<HTMLDetailsElement>('#room-settings')!;
    const roomSettingsContent = document.querySelector<HTMLElement>('#room-settings-content')!;
    roomSettings.hidden = true;
    roomSettings.open = false;
    setup.before(roomBar);
    roster.replaceChildren();
    document.querySelector<HTMLElement>('#politics-dock')!.hidden = true;
    document.querySelector<HTMLElement>('#trade-dock')!.hidden = true;
    roomLabel.textContent = `Sala ${joined.roomId}`;
    audio.enter();
    game = createGame(map,joined.sessionId,input => joined.send('input',input),(level,pan) => audio.footstep(level,pan));
    const gameplay = createGameplayPanel(action=>joined.send('gameplay',action),joined.sessionId,message=>hud.notify('Objetos e celular',message),(canvas,photo)=>game?.drawPhoto(canvas,photo));
    const hud = createMatchHud(joined.sessionId,station => {
      audio.stationClick();
      game?.pulseStation(station);
      map.focus({preventScroll:true});
    },activity => joined.send('room-activity',activity),drop => {
      joined.send('gameplay',{kind:'use',item:drop});
      map.focus({preventScroll:true});
    },gameplay.nearby);
    joined.onMessage('photo-state',(photos:PhotoAccessView)=>{
      if (gameplay.photoState(photos)) audio.shutter();
    });
    joined.onMessage('item-obtained',(pickup:boolean)=>{
      gameplay.itemObtained(pickup);
      audio.cue('pickup');
    });
    joined.onMessage('gameplay-feedback',(message:string)=>gameplay.feedback(message));
    const election = createElectionPanel(joined.sessionId,action => joined.send('election',action),() => voice?.active ?? false);
    const political = createPoliticsPanel(joined.sessionId,action => joined.send('politics',action),() => map.focus({preventScroll:true}));
    const panel = createPlenaryPanel(joined.sessionId,(type,data) => {
      joined.send(type,data);
      if (type!=='bill-vote') map.focus({preventScroll:true});
    });
    let phase: PlenaryView['phase'] = 'lobby';
    let rosterKey = '';
    let previousView:PlenaryView | undefined;
    joined.onMessage('plenary',(view: PlenaryView) => {
      if (view.phase==='negotiation' && view.remaining<=30 && (previousView?.remaining ?? 0)>30) audio.cue('summons');
      if (view.vote && view.vote!==previousView?.vote) audio.cue('vote');
      if (view.reportedFraud && !previousView?.reportedFraud) audio.cue('alert');
      const pastIncome = previousView?.politics?.walletIncome ?? 0;
      const income = (view.politics?.walletIncome ?? 0)-pastIncome;
      if (previousView?.politics && income>0) {
        audio.cue('cash');
        hud.showIncome(income,game?.playerHead());
      }
      panel.render(view);
      political.render(view);
      election.render(view);
      gameplay.render(view);
      hud.render(view);
      game?.setGroundItems(view.gameplay?.ground ?? [],view.gameplay?.decorations ?? []);
      const resultSound = showNewResults(view,previousView);
      if (resultSound) audio.cue(resultSound);
      previousView = view;
      game?.setPlenaryView(view);
      game?.setOffices(view.election?.offices ?? []);
      const label = `Sala ${joined.roomId} · ${view.players}/${MAX_PLAYERS}`;
      if (roomLabel.textContent!==label) roomLabel.textContent = label;
      if (phase===view.phase) return;
      if ((phase==='lobby' || phase==='finished') && view.phase==='negotiation') audio.cue('session');
      else if (view.phase==='ballot' || view.phase==='hearing') audio.cue('ballot');
      else if (view.phase==='finished') audio.cue('end');
      phase = view.phase;
      closeDetails();
      session.dataset.phase = phase;
      const negotiating = phase==='negotiation';
      voiceToggle.setAttribute('aria-description',negotiating ? 'Voz por proximidade' :
        phase==='ballot' ? 'Voz geral no Plenário' : 'Voz geral da sala');
      if (phase==='ballot' || phase==='hearing') document.querySelector<HTMLDialogElement>('#gameplay-dialog')?.close();
      voice?.setRange(negotiating ? new Map() : undefined);
      matchRunning = negotiating || phase==='ballot' || phase==='hearing';
      game?.setMatchPhase(phase);
      setup.hidden = matchRunning;
      if (matchRunning) {
        if (voiceDock.parentElement!==voiceHost) voiceHost.append(voiceDock);
        if (roomBar.parentElement!==roomSettingsContent) roomSettingsContent.append(roomBar);
        roomSettings.hidden = false;
      } else {
        voiceLobby.append(voiceDock);
        roomSettings.hidden = true;
        roomSettings.open = false;
        setup.before(roomBar);
      }
      if (negotiating) map.focus({preventScroll:true});
    });
    joined.onMessage('room-activity-result',(result:RoomActivityResult) => hud.activityResult(result));
    joined.onMessage('audit-result',({text,critical}:{text:string;critical:boolean}) => {
      hud.notify('Controladoria',text,critical);
    });
    joined.onMessage('control',(snapshot: ControlState) => game?.reconcile(snapshot));
    joined.onMessage('players',(players: Player[]) => {
      panel.players(players);
      political.players(players);
      election.players(players);
      hud.players(players);
      game?.update(players);
      const self = players.find(player => player.id===joined.sessionId);
      for (const [index,button] of buttons.entries()) {
        const pressed = String(index===self?.character);
        if (button.getAttribute('aria-pressed')!==pressed) button.setAttribute('aria-pressed',pressed);
      }
      if (matchRunning) return;
      const names = players.map(player => player.nick+(player.id===joined.sessionId ? ' (você)' : ''));
      const key = names.join('|');
      if (rosterKey===key) return;
      rosterKey = key;
      roster.replaceChildren(...names.map(name => {
        const slot = document.createElement('li');
        slot.textContent = name;
        return slot;
      }));
    });
    joined.onReconnect(() => { if (voice?.active) joined.send('voice-join'); });
    joined.onLeave((closeCode,reason) => {
      hudListeners.abort();
      panel.destroy();
      hud.destroy();
      gameplay.destroy();
      if (room!==joined) return;
      const outdated = closeCode===4002 && reason?.includes('not registered');
      showLobby(outdated ? 'O servidor da sala está desatualizado. Atualize o servidor e crie outra sala.' : 'Você saiu da sala.');
    });
    map.focus({preventScroll:true});
  } catch (error) {
    const reason = error && typeof error==='object' && 'code' in error ? error.code : undefined;
    showLobby(reason===NICK_TAKEN ? 'Esse nick já está em uso nesta sala. Escolha outro.' :
      reason===INVALID_NICK ? nickHint : 'Não foi possível conectar. Confira o código e se o servidor está rodando.');
    if (reason===NICK_TAKEN || reason===INVALID_NICK) nickInput.focus();
  } finally {
    create.disabled = false;
  }
}

function nickname() {
  const nick = readNick(nickInput.value);
  nickInput.setCustomValidity(nick ? '' : nickHint);
  if (!nickInput.reportValidity() || !nick) return;
  nickInput.value = nick;
  try { localStorage.setItem(nicknameStorage,nick); } catch {}
  return nick;
}

create.onclick = () => {
  const nick = nickname();
  if (nick) { audio.unlock(); void connect(() => client.create('plenary',{nick})); }
};
lobby.onsubmit = event => {
  event.preventDefault();
  const roomId = code.value.trim();
  const nick = nickname();
  if (roomId && nick) { audio.unlock(); void connect(() => client.joinById(roomId,{nick})); }
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
