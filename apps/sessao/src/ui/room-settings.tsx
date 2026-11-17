import {DialogHeader} from './dialog-header';
import {useRef,useSyncExternalStore} from 'react';
import {useDialogKeys} from './use-dialog-keys';
import {flushSync} from 'react-dom';
import {createRoot} from 'react-dom/client';
import type {createAudioPreferences} from '../../../../packages/hud/audio';

type Preferences = ReturnType<typeof createAudioPreferences>;
type SettingsState = {
  roomLabel:string;
  microphone:'off'|'starting'|'live'|'muted';
  voiceMessage:string;
  voiceDescription?:string;
};
type SettingsActions = {leave:()=>void; toggleVoice:()=>void; leaveVoice:()=>void};

export function RoomSettings({preferences,state,actions}:{
  preferences:Preferences;state:SettingsState;actions:SettingsActions;
}) {
  const sound = useSyncExternalStore(preferences.subscribe,preferences.getSnapshot,preferences.getSnapshot);
  const {microphone} = state;
  const voiceLabel = microphone==='live' ? 'Silenciar microfone' : microphone==='muted' ? 'Ativar microfone' : 'Ativar voz';
  const music = useRef<HTMLInputElement>(null);
  const effects = useRef<HTMLInputElement>(null);
  const section = useDialogKeys<HTMLElement>(()=>undefined,[
    {name:'Fechar configurações',activate:()=>section.current?.closest('dialog')?.close()},
    {name:'Sair',activate:actions.leave},
    {name:'Música',activate:()=>music.current?.focus()},
    {name:'Efeitos e passos',activate:()=>effects.current?.focus()},
    {name:sound.muted ? 'Ativar som do jogo' : 'Silenciar som do jogo',
      activate:()=>preferences.update({muted:!sound.muted})},
    ...(microphone==='starting' ? [] : [{name:voiceLabel,activate:actions.toggleVoice}]),
    ...(microphone==='live' || microphone==='muted' ? [{name:'Sair da voz',activate:actions.leaveVoice}] : []),
  ]);
  return <>
    <DialogHeader id="settings-title" title="Configurações" dismissLabel="Fechar configurações"/>
    <section ref={section} aria-label="Sala">
      <div id="room-bar">
        <span id="room-label" role="status">{state.roomLabel}</span>
        <button id="leave" className="hud-button hud-button--secondary" type="button" onClick={actions.leave}>Sair</button>
      </div>
    </section>
    <section aria-label="Som do jogo">
      <h3>Som do jogo</h3>
      <label htmlFor="music-volume">Música</label>
      <input ref={music} id="music-volume" className="hud-range" type="range" min="0" max="100" step="1" value={Math.round(sound.musicVolume*100)}
        onChange={event=>preferences.update({musicVolume:event.currentTarget.valueAsNumber/100})}/>
      <label htmlFor="effects-volume">Efeitos e passos</label>
      <input ref={effects} id="effects-volume" className="hud-range" type="range" min="0" max="100" step="1" value={Math.round(sound.sfxVolume*100)}
        onChange={event=>preferences.update({sfxVolume:event.currentTarget.valueAsNumber/100})}/>
      <label className="mute-option"><input id="sound-mute" type="checkbox" checked={sound.muted}
        onChange={event=>preferences.update({muted:event.currentTarget.checked})}/> Silenciar som do jogo</label>
    </section>
    <section aria-label="Microfone">
      <h3>Microfone</h3>
      <button className="hud-button" id="voice-toggle" type="button" disabled={microphone==='starting'}
        data-voice={microphone==='starting' ? 'off' : microphone} title={voiceLabel} aria-description={state.voiceDescription}
        onClick={actions.toggleVoice}>
        <svg className="hud-glyph" aria-hidden="true"><use href="#icon-mic"/></svg><span>{voiceLabel}</span>
      </button>
      <button className="hud-button hud-button--secondary" id="voice-leave" type="button"
        hidden={microphone!=='live' && microphone!=='muted'} onClick={actions.leaveVoice}>Sair da voz</button>
      <p id="voice-status" role="status">{state.voiceMessage}</p>
    </section>
  </>;
}

export function mountRoomSettings(dialog:HTMLDialogElement,preferences:Preferences,actions:SettingsActions) {
  const root = createRoot(dialog);
  let state:SettingsState = {roomLabel:'',microphone:'off',voiceMessage:''};
  const render = ()=>root.render(<RoomSettings preferences={preferences} state={state} actions={actions}/>);
  // Keyboard shortcuts and the app launcher bind to these controls during room setup.
  flushSync(render);
  return {
    update(changes:Partial<SettingsState>) {
      if ((Object.keys(changes) as (keyof SettingsState)[]).every(key=>changes[key]===state[key])) return;
      state = {...state,...changes};
      render();
    },
    close:()=>dialog.close(),
    open:()=>{ if (!dialog.open) dialog.showModal(); },
  };
}
