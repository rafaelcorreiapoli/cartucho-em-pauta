import { mountBallotCountdown } from './ui/ballot-countdown';
import { mountRoomSettings } from './ui/room-settings';
import { ELECTION_RULES, type CampaignAdvertisement } from './elections';
import { bindFloorPlan } from './ui/floor-plan';
import {money} from './politics';
import { mountProjectPicker } from './ui/project-picker';
import { discountedPrice } from './market-catalog';
import { internalMailRules } from './internal-mail';
import { mountInternalMail } from './ui/internal-mail';
import type { InternalNotice, ForensicReport } from './internal-mail';
import { hudAppStatus, launchHudApp, type HudApp, type HudAppStatus } from './hud-apps';
import { mountAppLauncher } from './ui/app-launcher';
import { mountReactHud } from './ui/hud';
import { createParliamentarianPanel } from './parliamentarian-panel';
import { createProgressionHud } from './progression-hud';
import './progression-hud.css';
import { bindActionShortcuts } from './action-shortcuts';
import { type GameplayAction } from './gameplay';
import { characterStats } from './character-stats';
import { createMarketPanel } from './market-panel';
import type { PhotoAccessView } from './photography';
import { createSecurityPanel } from './security-panel';
import { createSurveillancePanel } from './surveillance-panel';
import type { PhotoScene } from './photography';
import { createGameplayPanel } from './gameplay-panel';
import { mountResults } from './results';
import { setCharacterPortrait } from './character-art';
import type { RoomActivityResult } from './room-activities';
import { createMatchHud } from './match-hud';
import { Client, type Room } from '@colyseus/sdk';
import { createElectionPanel } from './election-panel';
import { createCampaignTv } from './campaign-tv';
import { GameAudio } from './game-audio';
import { installHudHelp } from './hud-help';
import { createGame } from './game';
import { createRoomCommandSender } from './room-commands';
import { createPoliticsPanel } from './politics-panel';
import { createPlenaryPanel } from './plenary-panel';
import { MAX_PLAYERS, type PlenaryView } from './plenary';
import type { ControlState } from './movement';
import { inPlenary, NAMES, type Player } from './map';
import { RoomVoice } from './voice';
import { INVALID_NICK, NICK_TAKEN, nickHint, readNick } from './nick';
import '../../../packages/hud/styles.css';
import './style.css';
import './match-hud.css';
import './session-finale.css';
import './rts-hud.css';
import './ui/congress-overlay.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const audio = new GameAudio();
installHudHelp(document.querySelector('main')!);
const lobby = document.querySelector<HTMLFormElement>('#lobby')!;
const landing = document.querySelector<HTMLElement>('#landing')!;
const setup = document.querySelector<HTMLElement>('#room-setup')!;
const loadingScreen = document.querySelector<HTMLElement>('#asset-loading')!;
const loadingProgress = document.querySelector<HTMLProgressElement>('#asset-loading-progress')!;
const loadingStatus = document.querySelector<HTMLElement>('#asset-loading-status')!;
const loadingBack = document.querySelector<HTMLButtonElement>('#asset-loading-back')!;
const lobbyInvite = document.querySelector<HTMLInputElement>('#lobby-invite-url')!;
const copyLobbyInvite = document.querySelector<HTMLButtonElement>('#lobby-copy-invite')!;
const portraitPlayers:HTMLElement[] = [];
const nickInput = document.querySelector<HTMLInputElement>('#nick')!;
const code = document.querySelector<HTMLInputElement>('#room-id')!;
const status = document.querySelector<HTMLElement>('#connection')!;
const session = document.querySelector<HTMLElement>('#session')!;
const map = document.querySelector<HTMLElement>('#map')!;
const ballotCountdown = mountBallotCountdown(document.querySelector<HTMLDialogElement>('#ballot-countdown')!);
const create = document.querySelector<HTMLButtonElement>('#create')!;
const characters = document.querySelector<HTMLElement>('#characters')!;
const buttons = NAMES.map((name,index) => {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'hud-option character-option';
  const portrait = document.createElement('span');
  portrait.className = 'portrait';
  setCharacterPortrait(portrait,index);
  portrait.setAttribute('aria-hidden','true');
  const caption = document.createElement('span');
  caption.className = 'character-name';
  caption.textContent = name;
  const players = document.createElement('span');
  players.className = 'character-players';
  portraitPlayers.push(players);
  button.append(portrait,players,caption);
  const stats = characterStats[index];
  button.title = `${stats.hp} PV · Força ${stats.attack} · Velocidade ${stats.speed}`;
  button.setAttribute('aria-pressed','false');
  button.onclick = () => {
    roomCommand?.('character',{character:index});
  };
  characters.append(button);
  return button;
});
let voice: RoomVoice | undefined;
let disguiseActive = false;

function applyVoiceEquipment(current:RoomVoice|undefined) {
  void current?.setDisguise(disguiseActive ? {pitch:-6,style:'radio'} : undefined)?.catch(()=>{
    if (current===voice) settings.update({voiceMessage:'Não foi possível ativar o modulador.'});
  });
}
let matchRunning = false;
let room: Room | undefined;
let roomCommand:ReturnType<typeof createRoomCommandSender>|undefined;
let game: ReturnType<typeof createGame> | undefined;
const nicknameStorage = 'cartuchao.sessao.nick';
try { nickInput.value = localStorage.getItem(nicknameStorage) ?? ''; } catch {}
nickInput.oninput = () => nickInput.setCustomValidity('');
code.value = new URL(location.href).searchParams.get('sala') || '';

const settings = mountRoomSettings(document.querySelector<HTMLDialogElement>('#room-settings')!,audio.preferences,{
  leave:()=>void room?.leave(),
  toggleVoice:()=>void toggleVoice(),
  leaveVoice:()=>{
    voice?.stop();
    settings.update({microphone:'off',voiceMessage:''});
  },
});

let startingVoice:RoomVoice|undefined;

async function toggleVoice() {
  const current = voice;
  if (!current || startingVoice===current) return;
  if (current.active) {
    current.toggleMute();
    settings.update({microphone:current.muted ? 'muted' : 'live'});
    return;
  }
  startingVoice = current;
  settings.update({microphone:'starting',voiceMessage:'Ativando microfone…'});
  try {
    await current.start();
    if (current !== voice) return;
    settings.update({microphone:current.active ? 'live' : 'off',voiceMessage:''});
    if (current.active) applyVoiceEquipment(current);
  } catch (error) {
    if (current !== voice) return;
    settings.update({microphone:'off',voiceMessage:!window.isSecureContext ? 'O microfone precisa de HTTPS ou localhost.' :
      error instanceof DOMException && error.name === 'NotAllowedError' ?
        'Permita o microfone no navegador e tente novamente.' : 'Não foi possível abrir o microfone.'});
  } finally {
    if (startingVoice===current) startingVoice = undefined;
  }
}

function showLobby(message: string) {
  ballotCountdown.update();
  audio.leave();
  voice?.stop(false);
  voice = undefined;
  disguiseActive = false;
  matchRunning = false;
  settings.update({microphone:'off',voiceMessage:'',voiceDescription:undefined,roomLabel:''});
  game?.destroy();
  game = undefined;
  room = undefined;
  roomCommand = undefined;
  settings.close();
  document.querySelector<HTMLDialogElement>('#result-dialog')?.close();
  document.querySelector<HTMLDialogElement>('#session-finale')?.close();
  session.hidden = true;
  loadingScreen.hidden = true;
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
    const sendCommand = createRoomCommandSender((channel,command)=>{
      if (!ballotCountdown.open) joined.send(channel,command);
    });
    roomCommand = sendCommand;
    voice = new RoomVoice(joined, ids => {
      audio.setSpeaking(ids.size>0);
    });
    code.value = joined.roomId;
    landing.hidden = true;
    session.dataset.phase = 'lobby';
    delete session.dataset.inPlenary;
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
    const updateFloorPlan = bindFloorPlan(session,hudListeners.signal);
    const latency = document.querySelector<HTMLElement>('#connection-latency')!;
    let latencyGeneration = 0;
    const measureLatency = () => {
      const generation = latencyGeneration;
      joined.ping(ms=>{
        if (hudListeners.signal.aborted || generation!==latencyGeneration) return;
        const label = `${Math.round(ms)} ms`;
        if (latency.textContent!==label) latency.textContent = label;
        latency.hidden = false;
      });
    };
    measureLatency();
    const pingTimer = window.setInterval(measureLatency,3000);
    hudListeners.signal.addEventListener('abort',()=>{
      clearInterval(pingTimer);
      latency.hidden = true;
    },{once:true});
    joined.onDrop(()=>{
      latencyGeneration++;
      latency.hidden = true;
    });
    joined.onReconnect(measureLatency);
    document.addEventListener('keydown',event=>{
      if (event.defaultPrevented || event.key!=='Escape' || document.querySelector('dialog:modal') ||
        !session.querySelector('details[name="game-panels"][open]')) return;
      closeDetails();
      map.focus({preventScroll:true});
    },{signal:hudListeners.signal});
    for (const labels of portraitPlayers) labels.replaceChildren();
    document.querySelector<HTMLElement>('#politics-dock')!.hidden = true;
    document.querySelector<HTMLElement>('#institutional-dock')!.hidden = true;
    settings.update({roomLabel:`Sala ${joined.roomId}`});
    const inviteUrl = new URL(location.href);
    inviteUrl.searchParams.set('sala',joined.roomId);
    lobbyInvite.value = inviteUrl.href;
    loadingProgress.value = 0;
    loadingStatus.textContent = 'Carregando o Congresso…';
    loadingBack.hidden = true;
    loadingScreen.hidden = false;
    let assetError = false;

    const audioReady = audio.enter();
    let assetsReady = false;
    const security = createSecurityPanel(action=>sendCommand('security-camera',action));
    const sendGameplay = (action:GameplayAction) => sendCommand('gameplay',{action});
    game = createGame(map,joined.sessionId,input => joined.send('input',input),
      (level,pan) => audio.footstep(level,pan),(cue,level,pan)=>audio.combat(cue,level,pan),
      sendGameplay,action=>sendCommand('fire-action',action),action=>sendCommand('power-action',action),id=>gameplay.inspectDecoration(id),()=>gameplay.openStash(),security.open,progress=>{
        if (room!==joined) return;
        if (progress<0) {
          assetError = true;
          loadingStatus.textContent = 'Falha ao carregar o cenário. Volte e tente novamente.';
          loadingBack.hidden = false;
        } else if (!assetError) {
          loadingProgress.value = progress*.95;
          if (progress===1) void Promise.resolve(audioReady).then(()=>{
            if (room!==joined) return;
            assetsReady = true;
            loadingProgress.value = 1;
            loadingScreen.hidden = true;
            if (previousView) panel.render(previousView);
          });
        }
      });
    joined.onMessage('security-frame',security.frame);
    joined.onDrop(()=>security.render());
    const surveillance = createSurveillancePanel(action=>sendCommand('spy',action));
    joined.onMessage('spy-frame',(frame:PhotoScene)=>surveillance.frame(frame));
    joined.onDrop(()=>{ surveillance.render(undefined); game?.clearPrivateVision(); });
    const npcPanel = createParliamentarianPanel(action=>sendCommand('npc-deal',action));
    const market = createMarketPanel(sendGameplay);
    const gameplay = createGameplayPanel(sendGameplay,joined.sessionId,message=>hud.notify('Objetos e celular',message),(canvas,photo)=>game?.drawPhoto(canvas,photo),
      option=>sendCommand('spy',option),action=>sendCommand('politics',action),()=>mail.open([
        ...(previousView?.gameplay?.inventory ?? []).flatMap(item=>item.document?.project===undefined ? [] :
          [{kind:'document' as const,id:item.id,label:item.document.title}]),
        ...mailPhotos.map(({photo})=>({kind:'photo' as const,id:photo.id,label:'Fotografia #'+photo.id})),
      ]));
    const political = createPoliticsPanel(joined.sessionId,action => sendCommand('politics',action),() => map.focus({preventScroll:true}));
    const hud = createMatchHud(joined.sessionId,station => {
      audio.stationClick();
      game?.pulseStation(station);
      map.focus({preventScroll:true});
    },activity => sendCommand('room-activity',{activity}),gameplay.nearby,action=>{
      if (action.kind!=='attack') audio.stationClick();
      if (action.kind==='npc-deal') { sendCommand('npc-deal',{kind:action.command,target:action.target}); return; }
      if (action.kind==='power') { sendCommand('power-action',action.option); return; }
      if (action.kind==='fire') { sendCommand('fire-action',action.option); return; }
      if (action.kind==='open-security') { security.open(); return; }
      if (action.kind==='spy') { sendCommand('spy',action.option); return; }
      if (action.kind==='edit-document') {
        projectPicker.open('Adulterar documento',index=>sendGameplay({kind:'edit',item:action.item,target:String(index)}),action.project);
        return;
      }
      if (action.kind==='request-document') {
        projectPicker.open('Solicitar documento',index=>sendGameplay({kind:'supply',place:'secretary',target:'project-'+index}));
        return;
      }
      if (action.kind==='inspect-stash') { gameplay.openStash(); return; }
      if (action.kind==='cross-door') game?.crossDoor(action.door);
      else sendGameplay(action);
      map.focus({preventScroll:true});
    },political);
    const progression = createProgressionHud(request=>{ if (!ballotCountdown.open) joined.send('allocate-attribute',request); },cue=>audio.progression(cue));
    let mailPhotos:PhotoAccessView['album'] = [];
    joined.onMessage('photo-state',(photos:PhotoAccessView)=>{
      mailPhotos = photos.album;
      if (gameplay.photoState(photos)) audio.cue('shutter');
    });
    joined.onMessage('megaphone-active',(active:boolean)=>reactHud.broadcast(active));
    joined.onDrop(()=>reactHud.broadcast(false));
    joined.onMessage('gear-purchased',market.purchased);
    joined.onMessage('consumable-purchased',gameplay.purchasedConsumable);
    joined.onMessage('interaction-cue',(cue:unknown)=>{
      if (cue==='cash' || cue==='stamp' || cue==='lock') audio.cue(cue);
    });
    joined.onMessage('food-consumed',(cue:unknown)=>{
      if (cue==='eat' || cue==='drink') audio.cue(cue);
    });
    joined.onMessage('item-obtained',(pickup:boolean)=>{
      gameplay.itemObtained(pickup);
      audio.cue('pickup');
    });
    joined.onMessage('pix-received',({from,amount}:{from:string;amount:number})=>hud.notify('Pix recebido',`${from} enviou ${money(amount)}.`));
    joined.onMessage('fire-extinguished',({actor,room}:import('./fire').FireExtinguished)=>
      hud.notify('Incêndio apagado',`${actor} apagou o incêndio em ${room}.`));
    joined.onMessage('gameplay-feedback',(message:string)=>{
      if (message.includes('Megafone')) { audio.cue(message.includes('ocupado') ? 'alert' : 'vote'); hud.notify('Megafone',message); }
      else if (message==='Raio X ativado.') audio.cue('vote');
      else if (message.startsWith('Raio X sem cargas')) { audio.cue('alert'); hud.notify('Raio X',message); }
      else if (market.isOpen()) hud.notify('Loja',message);
      else gameplay.feedback(message);
    });
    const campaignTv = createCampaignTv(session,joined.sessionId);
    joined.onMessage('campaign-advertisement',(ad:CampaignAdvertisement & {advertiserId:string})=>{
      campaignTv.enqueue(ad);
      if (ad.advertiserId===joined.sessionId) {
        hud.notify('Propaganda no ar',`+${ELECTION_RULES.advertisementStrength} de força eleitoral neste ciclo.`);
      }
    });
    hudListeners.signal.addEventListener('abort',campaignTv.destroy,{once:true});
    const election = createElectionPanel(joined.sessionId,action => sendCommand('election',action),() => voice?.active ?? false);
    const reactHud = mountReactHud();
    let appStatus:HudAppStatus = {};
    const appCommands:Record<HudApp,()=>void> = {
      bag:gameplay.openBag,equipment:gameplay.openEquipment,phone:gameplay.openPhone,
      attributes:progression.open,surveillance:surveillance.open,settings:settings.open,
      microphone:()=>void toggleVoice(),
    };
    const launchApp = (app:HudApp)=>launchHudApp(appStatus,appCommands,app);
    const appLauncher = mountAppLauncher(launchApp);
    bindActionShortcuts(session,hudListeners.signal,launchApp,{j:political.toggleDossier,l:election.showPolls});
    const mail = mountInternalMail(message=>sendCommand('mail-publish',message),hud.notify,notice=>sendCommand('mail-examine',{notice}),(canvas,photo)=>game?.drawPhoto(canvas,photo),
      (id,photo)=>sendCommand('complaint-submit',{id,photo}));
    joined.onMessage('mail-reports',(reports:ForensicReport[])=>mail.reports(reports));
    joined.onMessage('mail-state',(notices:InternalNotice[])=>mail.receive(notices));
    joined.onMessage('mail-result',(message:string|null)=>mail.result(message));
    joined.send('mail-read');
    const projectPicker = mountProjectPicker();
    const results = mountResults();
    const panel = createPlenaryPanel(joined.sessionId,(channel,action)=>{
      sendCommand(channel,action);
      if (channel!=='bill-vote' && channel!=='cassation-vote') map.focus({preventScroll:true});
    },()=>assetsReady);
    let phase: PlenaryView['phase'] = 'lobby';
    let rosterKey = '';
    let previousView:PlenaryView | undefined;
    let suppressXpEffect = false;
    joined.onMessage('plenary',(view: PlenaryView) => {
      ballotCountdown.update(view.ballotCountdown);
      const scan = view.gameplay?.xrayVision;
      const previousTargets = previousView?.gameplay?.xrayVision?.targets ?? [];
      if (scan?.targets.some(target=>!previousTargets.some(previous=>previous.id===target.id))) audio.cue('pickup');
      const cassationAnnounced = !!view.cassationIn && !previousView?.cassationIn;
      const projectAnnounced = !view.cassationIn && view.remaining<=30 &&
        ((previousView?.remaining ?? 0)>30 || !!previousView?.cassation);
      if (view.phase==='negotiation' && (cassationAnnounced || projectAnnounced)) audio.cue('summons');
      if (view.vote && view.vote!==previousView?.vote || view.cassation?.choice!==undefined && view.cassation.choice!==previousView?.cassation?.choice) audio.cue('vote');
      if (view.reportedFraud && !previousView?.reportedFraud) audio.cue('alert');
      const pastIncome = previousView?.politics?.walletIncome ?? 0;
      const income = (view.politics?.walletIncome ?? 0)-pastIncome;
      if (previousView?.politics && income>0) {
        audio.cue('cash');
        hud.showIncome(income,game?.playerHead());
      }
      panel.render(view);
      const previousOffers = previousView?.politics?.incoming ?? [];
      if (view.politics?.incoming.some(offer=>!previousOffers.some(previous=>previous.id===offer.id))) {
        hud.notify('Oferta de documento','Abra o Dossiê com J.');
      }
      political.render(view);
      election.render(view);
      gameplay.render(view);
      surveillance.render(view.gameplay?.surveillance);
      security.render(view.gameplay?.security);
      market.render(view);
      npcPanel.update(view);
      const disguise = view.gameplay?.modulator?.active ?? false;
      if (disguiseActive!==disguise) {
        disguiseActive = disguise;
        applyVoiceEquipment(voice);
      }
      hud.render(view);
      reactHud.render(view);
      mail.complaints(view.complaints);
      mail.price(view.policies?.mail ? discountedPrice(internalMailRules.fee) : internalMailRules.fee);
      mail.phase(view.phase==='negotiation');
      const priorProgress = previousView?.politics?.progression;
      const currentProgress = view.politics?.progression;
      if (!suppressXpEffect && priorProgress && currentProgress &&
          priorProgress.matchId===currentProgress.matchId && currentProgress.xp>priorProgress.xp) {
        hud.showXp(currentProgress.xp-priorProgress.xp,game?.playerHead());
      }
      suppressXpEffect = false;
      progression.render(view);
      appStatus = hudAppStatus(view,assetsReady);
      appLauncher.render(appStatus);
      game?.setGroundItems(view.gameplay?.ground ?? [],view.gameplay?.decorations ?? []);
      const resultSound = results.render(view,previousView);
      if (resultSound) audio.cue(resultSound);
      const nextBallot = phase==='ballot' && view.phase===phase && previousView?.round!==view.round;
      previousView = view;
      game?.setPlenaryView(view);
      game?.setOffices(view.election?.offices ?? []);
      const label = `Sala ${joined.roomId} · ${view.players}/${MAX_PLAYERS}`;
      settings.update({roomLabel:label});
      if (phase===view.phase) {
        if (nextBallot) audio.cue('ballot');
        return;
      }
      if ((phase==='lobby' || phase==='finished') && view.phase==='negotiation') audio.cue('session');
      else if (view.phase==='ballot' || view.phase==='hearing') audio.cue('ballot');
      else if (view.phase==='finished') audio.cue('end');
      phase = view.phase;
      audio.setScore(phase==='ballot' ? 'ballotMusic' : phase==='hearing' ? 'hearingMusic' : 'music');
      closeDetails();
      session.dataset.phase = phase;
      const negotiating = phase==='negotiation';
      settings.update({voiceDescription:negotiating ? 'Voz por proximidade' :
        phase==='ballot' || phase==='hearing' ? 'Voz geral no Plenário' : 'Voz geral da sala'});
      if (phase==='ballot' || phase==='hearing') document.querySelector<HTMLDialogElement>('#gameplay-dialog')?.close();
      voice?.setRange(negotiating ? new Map() : undefined);
      matchRunning = negotiating || phase==='ballot' || phase==='hearing';
      game?.setMatchPhase(phase);
      setup.hidden = matchRunning;
      const voiceMount = matchRunning ? voiceHost : voiceLobby;
      if (voiceDock.parentElement!==voiceMount) voiceMount.append(voiceDock);
      if (negotiating) map.focus({preventScroll:true});
    });
    joined.onMessage('room-activity-result',(result:RoomActivityResult) => hud.activityResult(result));
    joined.onMessage('audit-result',({text,critical}:{text:string;critical:boolean}) => {
      hud.notify('Corregedoria',text,critical);
    });
    joined.onMessage('control',(snapshot: ControlState) => {
      const inside = String(inPlenary(snapshot.player) && !snapshot.isolated);
      if (session.dataset.inPlenary!==inside) session.dataset.inPlenary = inside;
      progression.player(snapshot.player);
      reactHud.player(snapshot.player);
      updateFloorPlan(snapshot.player);
      game?.reconcile(snapshot);
    });
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
      const key = JSON.stringify(players.map(({id,nick,character})=>[id,nick,character]));
      if (rosterKey===key) return;
      rosterKey = key;
      for (const labels of portraitPlayers) labels.replaceChildren();
      for (const player of players) {
        const label = document.createElement('span');
        label.textContent = player.nick;
        label.title = player.nick;
        portraitPlayers[player.character]?.append(label);
      }
    });
    joined.onReconnect(() => { joined.send('mail-read'); suppressXpEffect = true; progression.reconnect(); if (voice?.active) joined.send('voice-join'); });
    joined.onLeave((closeCode,reason) => {
      hudListeners.abort();
      panel.destroy();
      election.destroy();
      political.destroy();
      hud.destroy();
      appLauncher.destroy();
      reactHud.destroy();      results.destroy();
      projectPicker.destroy();
      mail.destroy();
      progression.destroy();
      surveillance.destroy();
      security.destroy();
      gameplay.destroy();
      market.destroy();
      npcPanel.destroy();
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
document.querySelector<HTMLButtonElement>('#lobby-back')!.onclick = () => void room?.leave();
loadingBack.onclick = () => void room?.leave();
for (const id of ['lobby-settings','plenary-settings']) {
  document.getElementById(id)!.onclick = settings.open;
}
lobbyInvite.onclick = () => lobbyInvite.select();
async function copyInvite(button:HTMLButtonElement, label:string) {
  if (!room) return;
  const url = new URL(location.href);
  url.searchParams.set('sala',room.roomId);
  try {
    await navigator.clipboard.writeText(url.href);
    button.textContent = 'Link copiado';
    setTimeout(() => { button.textContent = label; },1500);
  } catch {
    window.prompt('Link da sala',url.href);
  }
}
copyLobbyInvite.onclick = () => void copyInvite(copyLobbyInvite,'Copiar link');

if (import.meta.env.DEV) void import('./voice-test').then(({mountVoiceTest}) => mountVoiceTest());
