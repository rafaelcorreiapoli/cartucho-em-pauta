import {mountTutorial} from './ui/tutorial';
import {investmentAreas,type InvestmentAnnouncement} from './public-investments';
import {mountAssetLoading} from './ui/asset-loading';
import {rewardGains} from './ui/reward-effects';
import {mountConnectionLatency} from './ui/connection-latency';
import { mountBallotCountdown } from './ui/ballot-countdown';
import { mountRoomSettings } from './ui/room-settings';
import { type CampaignBroadcast } from './elections';
import { bindFloorPlan } from './ui/floor-plan';
import {money} from './politics';
import { mountProjectPicker } from './ui/project-picker';
import { mailPublicationFee } from './market-catalog';
import { mountInternalMail } from './ui/internal-mail';
import type { InternalNotice, ForensicReport } from './internal-mail';
import { hudAppStatus, launchHudApp, type HudApp, type HudAppStatus } from './hud-apps';
import { mountAppLauncher } from './ui/app-launcher';
import { mountReactHud } from './ui/hud';
import { createProgressionHud } from './progression-hud';
import './progression-hud.css';
import { bindActionShortcuts } from './action-shortcuts';
import { type GameplayAction } from './gameplay';
import { createMarketPanel } from './market-panel';
import type { PhotoAccessView } from './photography';
import { createSecurityPanel } from './security-panel';
import { createSurveillancePanel } from './surveillance-panel';
import type { SpyCameraFrame } from './surveillance';
import { createGameplayPanel } from './gameplay-panel';
import { mountResults } from './results';
import { mountCharacterPicker } from './ui/character-picker';
import type { RoomActivityResult } from './room-activities';
import { createMatchHud } from './match-hud';
import { Client, type Room } from '@colyseus/sdk';
import { createElectionPanel } from './election-panel';
import { createCampaignTv } from './campaign-tv';
import { GameAudio } from './game-audio';
import { createGame } from './game';
import { createRoomCommandSender } from './room-commands';
import { createPoliticsPanel } from './politics-panel';
import { createPlenaryPanel } from './plenary-panel';
import {mountRoomEntrance} from './ui/room-entrance';
import {mountLobbyInvite} from './ui/lobby-invite';
import { bills, MAX_PLAYERS, stabilityRules, type PlenaryView } from './plenary';
import type { ControlState } from './movement';
import { inPlenary, type Player } from './map';
import { RoomVoice } from './voice';
import {voiceModulatorDisguise} from './live-disguise';
import { INVALID_NICK, NICK_TAKEN, nickHint } from './nick';
import '../../../packages/hud/styles.css';
import './style.css';
import './match-hud.css';
import './session-finale.css';
import './rts-hud.css';
import './ui/congress-overlay.css';

const server = import.meta.env.VITE_GAME_SERVER || `http://${location.hostname}:2568`;
const client = new Client(server);
const audio = new GameAudio();
const landing = document.querySelector<HTMLElement>('#landing')!;
const setup = document.querySelector<HTMLElement>('#room-setup')!;
const session = document.querySelector<HTMLElement>('#session')!;
const map = document.querySelector<HTMLElement>('#map')!;
const ballotCountdown = mountBallotCountdown(document.querySelector<HTMLDialogElement>('#ballot-countdown')!);
const roleIntro = document.querySelector<HTMLDialogElement>('#role-intro')!;
const roleTitle = document.querySelector<HTMLElement>('#role-intro-title')!;
const roleObjective = document.querySelector<HTMLElement>('#role-intro-objective')!;
let voice: RoomVoice | undefined;
let disguiseActive = false;

function applyVoiceEquipment(current:RoomVoice|undefined) {
  void current?.setDisguise(disguiseActive ? voiceModulatorDisguise : undefined)?.catch(()=>{
    if (current===voice) settings.update({voiceMessage:'Não foi possível ativar o modulador.'});
  });
}
let matchRunning = false;
let room: Room | undefined;
let game: ReturnType<typeof createGame> | undefined;
const nicknameStorage = 'cartuchao.sessao.nick';
let initialNick = '';
try { initialNick = localStorage.getItem(nicknameStorage) ?? ''; } catch {}
const entrance = mountRoomEntrance(document.querySelector<HTMLElement>('#room-entrance')!,initialNick,
  new URL(location.href).searchParams.get('sala') ?? '',(nick,roomId,tutorial)=>{
    try { localStorage.setItem(nicknameStorage,nick); } catch {}
    audio.unlock();
    void connect(()=>roomId ? client.joinById(roomId,{nick}) : client.create('plenary',{nick,tutorial}));
  });
let connecting = false;
const renderLoading = mountAssetLoading(document.getElementById('asset-loading-mount')!,()=>void room?.leave());
renderLoading();

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
  roleIntro.close();
  audio.leave();
  voice?.stop(false);
  voice = undefined;
  disguiseActive = false;
  matchRunning = false;
  settings.update({microphone:'off',voiceMessage:'',voiceDescription:undefined,roomLabel:''});
  game?.destroy();
  game = undefined;
  room = undefined;
  settings.close();
  session.hidden = true;
  renderLoading();
  landing.hidden = false;
  entrance.update({message});
}

async function connect(join: () => Promise<Room>) {
  if (room || connecting) return;
  connecting = true;
  entrance.update({busy:true,message:'Conectando…'});
  try {
    const joined = await join();
    room = joined;
    const sendCommand = createRoomCommandSender((channel,command)=>{
      if (!ballotCountdown.open) joined.send(channel,command);
    });
    const tutorialHud = mountTutorial(action=>joined.send("tutorial",action));
    const characterPicker = mountCharacterPicker(document.querySelector<HTMLElement>('#characters')!,joined.sessionId,
      character=>sendCommand('character',{character}));
    voice = new RoomVoice(joined, ids => {
      audio.setSpeaking(ids.size>0);
    });
    entrance.setRoomCode(joined.roomId);
    landing.hidden = true;
    session.dataset.phase = 'lobby';
    delete session.dataset.inPlenary;
    session.hidden = false;
    setup.hidden = false;
    const closeDetails = () => {
      for (const panel of session.querySelectorAll<HTMLDetailsElement>('details[name="game-panels"][open]')) panel.open = false;
    };
    closeDetails();
    const hudListeners = new AbortController();
    const floorPlan = bindFloorPlan(session,hudListeners.signal);
    mountConnectionLatency(document.getElementById('connection-latency-mount')!,joined,hudListeners.signal);
    document.addEventListener('keydown',event=>{
      if (event.defaultPrevented || event.key!=='Escape' || document.querySelector('dialog:modal') ||
        !session.querySelector('details[name="game-panels"][open]')) return;
      closeDetails();
      map.focus({preventScroll:true});
    },{signal:hudListeners.signal});
    settings.update({roomLabel:`Sala ${joined.roomId}`});
    const inviteUrl = new URL('https://cartuchao.io/infiltrados-no-congresso/jogar');
    inviteUrl.searchParams.set('sala',joined.roomId);
    const destroyInvite = mountLobbyInvite(document.getElementById('lobby-invite-mount')!,inviteUrl.href,settings.open);
    hudListeners.signal.addEventListener('abort',destroyInvite,{once:true});
    let loadingProgress = 0;
    let assetError = false;
    renderLoading({progress:loadingProgress});

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
          renderLoading({progress:loadingProgress,failed:true});
        } else if (!assetError) {
          loadingProgress = progress*.95;
          renderLoading({progress:loadingProgress});
          if (progress===1) void Promise.resolve(audioReady).then(()=>{
            if (room!==joined || assetError) return;
            assetsReady = true;
            renderLoading();
            if (previousView) {
              panel.render(previousView);
              renderApps(previousView);
              revealRole(previousView);
            }
          });
        }
      });
    joined.onMessage('security-frame',security.frame);
    joined.onDrop(()=>security.render());
    const surveillance = createSurveillancePanel(action=>sendCommand('spy',action));
    joined.onMessage('spy-frame',(frame:SpyCameraFrame)=>surveillance.frame(frame));
    joined.onDrop(()=>{ surveillance.render(undefined); game?.clearPrivateVision(); });
    const market = createMarketPanel(sendGameplay,()=>{
      const voted = new Set(previousView?.outcomes.flatMap(outcome=>outcome.project===undefined ? [] : [outcome.project]));
      projectPicker.open('Solicitar documento',index=>{
        sendGameplay({kind:'supply',place:'secretary',target:'project-'+index});
        sendGameplay({kind:'dialogue-close'});
      },undefined,voted,previousView?.gameMode!=='calote');
    });
    const gameplay = createGameplayPanel(sendGameplay,joined.sessionId,message=>hud.notify('Objetos e celular',message),(canvas,photo)=>game?.drawPhoto(canvas,photo),
      option=>sendCommand('spy',option),action=>sendCommand('politics',action),()=>mail.open([
        ...(previousView?.gameplay?.inventory ?? []).flatMap(item=>item.document?.project===undefined ? [] :
          [{kind:'document' as const,id:item.id,label:item.document.title}]),
        ...(previousView?.photosEnabled===false ? [] : mailPhotos.map(({photo})=>({kind:'photo' as const,id:photo.id,label:'Fotografia #'+photo.id,photo}))),
      ],{photosEnabled:previousView?.photosEnabled!==false,documentsEnabled:previousView?.projectVotingEnabled!==false}),width=>game?.setPhoneInset(width),
      proof=>sendCommand('complaint-submit',proof.kind==='phone-game' ? {target:proof.target,photo:proof.photo} : {id:proof.id,photo:proof.photo}));
    const political = createPoliticsPanel(joined.sessionId,action => sendCommand('politics',action),() => map.focus({preventScroll:true}));
    const hud = createMatchHud(joined.sessionId,station => {
      audio.stationClick();
      game?.pulseStation(station);
      map.focus({preventScroll:true});
    },activity => sendCommand('room-activity',{activity}),{...gameplay.nearbyActions,render:gameplay.nearby},action=>{
      if (action.kind!=='attack' && action.kind!=='install' && action.kind!=='uninstall') audio.stationClick();
      if (action.kind==='npc-deal') { sendCommand('npc-deal',action.request); return; }
      if (action.kind==='power') { sendCommand('power-action',action.option); return; }
      if (action.kind==='fire') { sendCommand('fire-action',action.option); return; }
      if (action.kind==='open-security') { security.open(); return; }
      if (action.kind==='spy') { sendCommand('spy',action.option); return; }
      if (action.kind==='edit-document') {
        projectPicker.open('Adulterar documento',index=>sendGameplay({kind:'edit',item:action.item,target:String(index)}),action.project,undefined,previousView?.gameMode!=='calote');
        return;
      }
      if (action.kind==='offer-item') { gameplay.openOffer(action.target); return; }
      if (action.kind==='inspect-stash') { gameplay.openStash(); return; }
      if (action.kind==='cross-door') game?.crossDoor(action.door);
      else sendGameplay(action);
      map.focus({preventScroll:true});
    },political,action=>action==='denounce' ? gameplay.openComplaint() : sendCommand('plenary-action',{action}),{
      send:action=>sendCommand('election',action),hasVoice:()=>voice?.active ?? false,
    },gameplay.inspectBriefcase);
    const reactHud = mountReactHud(settings.open);
    const progression = createProgressionHud(request=>{ if (!ballotCountdown.open) joined.send('allocate-attribute',request); },cue=>audio.progression(cue),reactHud.profileReward);
    let mailPhotos:PhotoAccessView['album'] = [];
    joined.onMessage('photo-state',(photos:PhotoAccessView)=>{
      mailPhotos = photos.album;
      if (gameplay.photoState(photos)) audio.cue('shutter');
    });
    joined.onDrop(()=>reactHud.broadcast(false));
    joined.onMessage('gear-purchased',market.purchased);
    joined.onMessage('consumable-purchased',gameplay.purchasedConsumable);
    joined.onMessage('interaction-cue',(cue:unknown)=>{
      if (cue==='cash' || cue==='stamp' || cue==='lock' || cue==='pickup') audio.cue(cue);
    });
    joined.onMessage('food-consumed',(cue:unknown)=>{
      if (cue==='eat' || cue==='drink') audio.cue(cue);
    });
    joined.onMessage('item-obtained',(pickup:boolean)=>{
      gameplay.itemObtained(pickup);
      if (pickup) hud.refreshActions();
      audio.cue('pickup');
    });
    joined.onMessage('public-investment',({author,area,amount}:InvestmentAnnouncement)=>
      hud.notify('Verba aplicada',`${author} aplicou ${money(amount)} em ${investmentAreas[area]}.`,true));
    joined.onMessage('pix-sent',({amount}:{amount:number})=>{
      audio.cue('cash');
      hud.showReward('expense',amount,game?.playerHead());
    });
    joined.onMessage('pix-received',({from,amount}:{from:string;amount:number})=>{
      audio.cue('cash');
      hud.notify('Pix recebido',`${from} enviou ${money(amount)}.`);
    });
    joined.onMessage('fire-extinguished',({actor,room,effect}:import('./fire').FireExtinguished)=>{
      hud.notify('Incêndio apagado',`${actor} apagou o incêndio em ${room}.`);
      if (effect) game?.showExtinguishEffect(effect);
    });
    const actionFeedback = document.querySelector<HTMLElement>('#map-action-feedback')!;
    let actionFeedbackTimer:ReturnType<typeof setTimeout>|undefined;
    const clearActionFeedback = () => {
      clearTimeout(actionFeedbackTimer);
      actionFeedback.hidePopover();
      actionFeedback.textContent = '';
    };
    hudListeners.signal.addEventListener('abort',clearActionFeedback,{once:true});
    joined.onMessage('map-action-failed',(message:string)=>{
      if (room!==joined) return;
      gameplay.resetPendingPickup();
      const repeated = actionFeedback.textContent===message;
      if (!repeated) {
        actionFeedback.showPopover();
        actionFeedback.textContent = message;
        audio.actionFailed();
      }
      clearTimeout(actionFeedbackTimer);
      actionFeedbackTimer = setTimeout(clearActionFeedback,2500);
    });
    joined.onMessage('gameplay-feedback',(message:string)=>{
      if (message.includes('Megafone')) { audio.cue(message.includes('ocupado') ? 'alert' : 'vote'); hud.notify('Megafone',message); }
      else if (message==='Raio X ativado.') audio.cue('vote');
      else if (message.startsWith('Raio X sem cargas')) { audio.cue('alert'); hud.notify('Raio X',message); }
      else if (market.isOpen()) hud.notify(previousView?.gameplay?.dialogue?.npc==='protocol' ? 'Protocolo' : previousView?.gameplay?.dialogue?.npc==='secretary' ? 'Secretaria' : 'Loja',message);
      else gameplay.feedback(message);
    });
    const campaignTv = createCampaignTv(session,joined.sessionId);
    joined.onMessage('campaign-advertisement',(ad:CampaignBroadcast)=>{
      campaignTv.enqueue(ad);
      if (ad.advertiserId===joined.sessionId) {
        hud.notify('Propaganda no ar','Sua campanha está na TV do Congresso.');
      }
    });
    hudListeners.signal.addEventListener('abort',campaignTv.destroy,{once:true});
    const election = createElectionPanel(joined.sessionId,()=>joined.send("tutorial","next"));
    let appStatus:HudAppStatus = {};
    const appCommands:Record<HudApp,()=>void> = {
      bag:gameplay.openBag,equipment:gameplay.openEquipment,phone:gameplay.openPhone,
      attributes:progression.open,surveillance:surveillance.open,settings:settings.open,
      microphone:()=>void toggleVoice(),
    };
    const launchApp = (app:HudApp)=>launchHudApp(appStatus,appCommands,app);
    const appLauncher = mountAppLauncher(launchApp);
    function renderApps(view:PlenaryView) {
      appStatus = hudAppStatus(view,assetsReady);
      appLauncher.render(appStatus);
    }
    const mail = mountInternalMail(message=>sendCommand('mail-publish',message),hud.notify,notice=>sendCommand('mail-examine',{notice}),(canvas,photo)=>game?.drawPhoto(canvas,photo),
      (id,photo)=>sendCommand('complaint-submit',{id,photo}),gameplay.closePhoneApp);
    joined.onMessage('mail-reports',(reports:ForensicReport[])=>mail.reports(reports));
    joined.onMessage('mail-state',(notices:InternalNotice[])=>mail.receive(notices));
    joined.onMessage('mail-result',(message:string|null)=>mail.result(message));
    joined.send('mail-read');
    const projectPicker = mountProjectPicker();
    const results = mountResults(gameplay.close);
    const panel = createPlenaryPanel(joined.sessionId,(channel,action)=>{
      sendCommand(channel,action);
      if (channel!=='bill-vote' && channel!=='cassation-vote') map.focus({preventScroll:true});
    },()=>assetsReady,()=>void joined.leave());
    let inVotingArea = false;
    bindActionShortcuts(session,hudListeners.signal,appLauncher.activate,{j:political.toggleDossier,l:election.showPolls,u:appLauncher.toggle,context:()=>[...gameplay.requestShortcuts(),...panel.votingShortcuts(()=>inVotingArea),...hud.contextualShortcuts(),...appLauncher.shortcuts(),...gameplay.hotbarShortcuts(),...gameplay.photoShortcuts(),...hud.equippedShortcuts()],dialog:scope=>progression.shortcuts(scope) ?? market.shortcuts(scope),vote:key=>inVotingArea && panel.voteByKey(key)});
    let phase: PlenaryView['phase'] = 'lobby';
    let previousView:PlenaryView | undefined;
    let roleRevealed = false;
    function revealRole(view:PlenaryView) {
      if (view.tutorial) { roleRevealed = true; roleIntro.close(); return; }
      if (view.phase==='lobby' || view.phase==='finished') {
        roleRevealed = false;
        roleIntro.close();
      } else if (assetsReady && !roleRevealed && view.role) {
        roleRevealed = true;
        roleIntro.dataset.role = view.role;
        roleTitle.textContent = view.role;
        roleObjective.textContent = view.gameMode==='calote'
          ? view.role==='Infiltrado' ? 'Mantenha o orçamento negativo por 30 segundos seguidos para provocar o calote.' : 'Evite 30 segundos seguidos no vermelho. Sobreviva até o fim da sessão ou elimine todos os infiltrados.'
          : view.role==='Infiltrado'
          ? `Sabote o Congresso sem revelar seu papel. Faça a estabilidade cair a zero ou terminar a sessão abaixo de ${stabilityRules.target}.`
          : `Proteja o Congresso. Termine a sessão com pelo menos ${stabilityRules.target} de estabilidade ou tire de jogo todos os infiltrados.`;
        roleIntro.showModal();
      }
    }
    let suppressXpEffect = false;
    joined.onMessage('plenary',(view: PlenaryView) => {
      tutorialHud.render(view.phase==='lobby' ? undefined : view.tutorial,!!view.gameplay?.binocularSeconds);
      ballotCountdown.update(view.ballotCountdown);
      floorPlan.track(view.gameplay?.briefcaseTracking);
      const scan = view.gameplay?.xrayVision;
      const previousTargets = previousView?.gameplay?.xrayVision?.targets ?? [];
      if (scan?.targets.some(target=>!previousTargets.some(previous=>previous.id===target.id))) audio.cue('pickup');
      const cassationAnnounced = !!view.cassationIn && !previousView?.cassationIn;
      const projectAnnounced = !!view.projectWarning && !previousView?.projectWarning;
      if (view.phase==='negotiation' && view.project!==undefined && view.proposer && view.project!==previousView?.project) {
        hud.notify('Projeto em pauta',`${view.proposer} protocolou ${bills[view.project].name}. Votação em ${Math.ceil(view.remaining/60)} min.`);
      }
      if (view.phase==='negotiation' && (cassationAnnounced || projectAnnounced)) audio.cue('summons');
      if (view.vote && view.vote!==previousView?.vote || view.cassation?.choice!==undefined && view.cassation.choice!==previousView?.cassation?.choice) audio.cue('vote');
      if (view.reportedFraud && !previousView?.reportedFraud) audio.cue('alert');
      const gains = rewardGains(previousView,view,suppressXpEffect);
      const rewardHead = gains.income || gains.xp || gains.popularity ? game?.playerHead() : undefined;
      if (gains.income) {
        audio.cue('cash');
        hud.showReward('income',gains.income,rewardHead);
      }
      panel.render(view);
      const previousOffers = previousView?.politics?.incoming ?? [];
      if (view.politics?.incoming.some(offer=>!previousOffers.some(previous=>previous.id===offer.id))) {
        hud.notify('Oferta de documento','Abra o Dossiê com J.');
      }
      political.render(view);
      election.render(view);
      gameplay.render(view);
      surveillance.render(view.gameplay?.surveillance,view.photosEnabled!==false);
      security.render(view.gameplay?.security);
      market.render(view);
      const disguise = view.gameplay?.modulator?.active ?? false;
      if (disguiseActive!==disguise) {
        disguiseActive = disguise;
        applyVoiceEquipment(voice);
      }
      hud.render(view);
      reactHud.render(view);
      mail.complaints(view.complaints);
      mail.price(mailPublicationFee(view.policies));
      mail.phase(view.phase==='negotiation');
      if (gains.xp) hud.showReward('xp',gains.xp,rewardHead);
      if (gains.popularity) hud.showReward('popularity',gains.popularity,rewardHead);
      suppressXpEffect = false;
      progression.render(view);
      if (view.phase!==previousView?.phase && (view.phase==='ballot' || view.phase==='hearing')) appLauncher.close();
      renderApps(view);
      const resultSound = results.render(view,previousView);
      if (resultSound) audio.cue(resultSound);
      previousView = view;
      game?.setPlenaryView(view);
      const label = `Sala ${joined.roomId} · ${view.players}/${MAX_PLAYERS}`;
      settings.update({roomLabel:label});
      if (phase===view.phase) {
        revealRole(view);
        return;
      }
      if ((phase==='lobby' || phase==='finished') && view.phase==='negotiation') audio.cue('session');
      else if (view.phase==='ballot' || view.phase==='hearing') audio.cue('ballot');
      else if (view.phase==='finished') audio.cue('end');
      phase = view.phase;
      audio.setScore(phase==='hearing' ? 'hearingMusic' : 'music');
      closeDetails();
      session.dataset.phase = phase;
      const negotiating = phase==='negotiation';
      settings.update({voiceDescription:negotiating ? 'Voz por proximidade' :
        phase==='ballot' || phase==='hearing' ? 'Voz geral no Plenário' : 'Voz geral da sala'});
      if (phase==='ballot' || phase==='hearing') gameplay.close();
      voice?.setRange(negotiating ? new Map() : undefined);
      matchRunning = negotiating || phase==='ballot' || phase==='hearing';
      setup.hidden = matchRunning;
      if (negotiating) map.focus({preventScroll:true});
      revealRole(view);
    });
    joined.onMessage('room-activity-result',(result:RoomActivityResult) => hud.activityResult(result));
    joined.onMessage('audit-result',({text,critical}:{text:string;critical:boolean}) => {
      hud.notify('Corregedoria',text,critical);
    });
    joined.onMessage('control',(snapshot: ControlState) => {
      inVotingArea = inPlenary(snapshot.player) && !snapshot.isolated;
      const inside = String(inVotingArea);
      if (session.dataset.inPlenary!==inside) session.dataset.inPlenary = inside;
      progression.player(snapshot.player);
      reactHud.player(snapshot.player);
      floorPlan.player(snapshot.player);
      game?.reconcile(snapshot);
    });
    joined.onMessage('players',(players: Player[]) => {
      political.players(players);
      hud.players(players);
      game?.update(players);
      if (!matchRunning) characterPicker.render(players);
    });
    joined.onReconnect(() => { joined.send('mail-read'); suppressXpEffect = true; progression.reconnect(); gameplay.restorePhoneActivity(); if (voice?.active) joined.send('voice-join'); });
    joined.onLeave((closeCode,reason) => {
      hudListeners.abort();
      panel.destroy();
      tutorialHud.destroy();
      characterPicker.destroy();
      election.destroy();
      political.destroy();
      hud.destroy();
      appLauncher.destroy();
      progression.destroy();
      reactHud.destroy();
      results.destroy();
      projectPicker.destroy();
      mail.destroy();
      surveillance.destroy();
      security.destroy();
      gameplay.destroy();
      market.destroy();
      if (room!==joined) return;
      const outdated = closeCode===4002 && reason?.includes('not registered');
      showLobby(outdated ? 'O servidor da sala está desatualizado. Atualize o servidor e crie outra sala.' : 'Você saiu da sala.');
    });
    map.focus({preventScroll:true});
  } catch (error) {
    const reason = error && typeof error==='object' && 'code' in error ? error.code : undefined;
    showLobby(reason===NICK_TAKEN ? 'Esse nick já está em uso nesta sala. Escolha outro.' :
      reason===INVALID_NICK ? nickHint : 'Não foi possível conectar. Confira o código e se o servidor está rodando.');
    if (reason===NICK_TAKEN || reason===INVALID_NICK) entrance.focusNick();
  } finally {
    connecting = false;
    entrance.update({busy:false});
  }
}

if (import.meta.env.DEV) void import('./voice-test').then(({mountVoiceTest}) => mountVoiceTest());
