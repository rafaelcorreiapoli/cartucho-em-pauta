import {expect,test} from 'bun:test';
import {renderToStaticMarkup} from 'react-dom/server';
import {createAudioPreferences} from '../../../../packages/hud/audio';
import {RoomSettings} from './room-settings';

test('settings reflects stored audio preferences and each microphone state',()=>{
  const preferences = createAudioPreferences({musicVolume:.24,sfxVolume:.52,muted:false},{
    read:()=>({musicVolume:.15,sfxVolume:.8,muted:true}),write:()=>{},
  });
  const actions = {leave:()=>{},toggleVoice:()=>{},leaveVoice:()=>{}};
  const render = (microphone:'off'|'starting'|'live'|'muted')=>renderToStaticMarkup(
    <RoomSettings preferences={preferences} actions={actions} state={{roomLabel:'Sala QA',microphone,voiceMessage:'',voiceDescription:'Voz por proximidade'}}/>);
  const off = render('off');
  expect(off).toContain('method="dialog"');
  expect(off).toContain('value="15"');
  expect(off).toContain('value="80"');
  expect(off).toMatch(/id="sound-mute"[^>]*checked/);
  expect(off).toContain('aria-description="Voz por proximidade"');
  expect(off).toMatch(/id="voice-leave"[^>]*hidden/);
  expect(render('starting')).toMatch(/id="voice-toggle"[^>]*disabled/);
  expect(render('live')).toContain('Silenciar microfone');
  expect(render('muted')).toContain('Ativar microfone');
  expect(render('muted')).not.toMatch(/id="voice-leave"[^>]*hidden/);
});
