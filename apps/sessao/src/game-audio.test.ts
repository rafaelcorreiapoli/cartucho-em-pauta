import {expect,test} from 'bun:test';
import {GameAudio} from './game-audio';
import {sessionVerdict} from './session-verdict';

function fixture() {
  const sources:{buffer?:unknown;loop:boolean;start:()=>void;stop:()=>void;connect:(node:unknown)=>unknown}[] = [];
  const gain = ()=>({gain:{value:1,setTargetAtTime(){},setValueAtTime(){},linearRampToValueAtTime(){},cancelScheduledValues(){}},connect(){},disconnect(){}});
  const audio = new GameAudio();
  Reflect.set(audio,'context',{
    currentTime:1,createGain:gain,
    createBufferSource() {
      const source = {loop:false,playbackRate:{value:1},stops:0,connect(node:unknown){return node;},disconnect(){},start(){},stop(){this.stops++;}};
      sources.push(source);
      return source;
    },
  });
  Reflect.set(audio,'musicGain',gain());
  Reflect.set(audio,'effectsGain',gain());
  Reflect.set(audio,'playing',true);
  Reflect.set(audio,'score','music');
  Reflect.set(audio,'matchTrack','music');
  const buffers = new Map(['music','covertAffair','spyGlass','lobbyMusic','hearingMusic','caloteMusic','victory','defeat','federalCaught','federalIsolation'].map(key=>[key,{key}]));
  Reflect.set(audio,'buffers',buffers);
  return {audio,sources,buffers};
}

test.each(['Parlamentar','Infiltrado'] as const)('final music follows the %s player, overrides calote and plays once',role=>{
  for (const winner of ['Parlamentar','Infiltrado'] as const) {
    const {audio,sources,buffers} = fixture();
    audio.setCaloteDanger(5);
    expect(sources[0].buffer).toBe(buffers.get('caloteMusic'));
    audio.setScore(sessionVerdict({role,winner})!);
    expect(sources.at(-1)?.buffer).toBe(buffers.get(role===winner ? 'victory' : 'defeat'));
    expect(sources.at(-1)?.loop).toBe(false);
    audio.setScore(sessionVerdict({role,winner})!);
    expect(sources).toHaveLength(2);
    audio.setCaloteDanger(undefined);
    expect(sources).toHaveLength(2);
    audio.setScore('music');
    expect(sources.at(-1)?.loop).toBe(true);
  }
});

test('a missing finale track does not resume the gameplay music',()=>{
  const {audio,sources,buffers} = fixture();
  audio.setCaloteDanger(5);
  buffers.delete('victory');
  audio.setScore('victory');
  expect(sources).toHaveLength(1);
  expect(Reflect.get(audio,'music')).toBeUndefined();
});

test('the Federal siren stops before the trombone and sounds are cleared on leaving',()=>{
  const {audio,sources,buffers}=fixture();
  audio.federal('caught');
  expect(sources[0].buffer).toBe(buffers.get('federalCaught'));
  audio.federal('isolated');
  expect(Reflect.get(sources[0],'stops')).toBe(1);
  expect(sources[1].buffer).toBe(buffers.get('federalIsolation'));
  audio.leave();
  expect(Reflect.get(sources[1],'stops')).toBe(1);
});

test('cancelling a Federal transfer stops the siren without playing arrival audio',()=>{
  const {audio,sources}=fixture();
  audio.federal('caught');
  audio.federal('cancelled');
  expect(sources).toHaveLength(1);
  expect(Reflect.get(sources[0],'stops')).toBe(1);
});

test('campaign applause plays as an effect and respects mute and SFX volume',()=>{
  const {audio,sources,buffers} = fixture();
  buffers.set('applause',{key:'applause'});
  Reflect.set(audio,'effectsGain',{gain:{setTargetAtTime(){}},connect(){},disconnect(){}});
  const context = Reflect.get(audio,'context');
  const createSource = context.createBufferSource.bind(context);
  context.createBufferSource = ()=>Object.assign(createSource(),{playbackRate:{value:1}});
  context.createGain = ()=>({gain:{value:1},connect(){},disconnect(){}});
  audio.cue('applause');
  expect(sources).toHaveLength(1);
  expect(sources[0].buffer).toBe(buffers.get('applause'));
  expect(sources[0].loop).toBe(false);
  audio.preferences.update({muted:true});
  audio.cue('applause');
  expect(sources).toHaveLength(1);
  audio.preferences.update({muted:false,sfxVolume:0});
  audio.cue('applause');
  expect(sources).toHaveLength(1);
  audio.preferences.update({sfxVolume:.5});
  audio.cue('applause');
  expect(sources).toHaveLength(2);
});

test('lobby music is separate and a match keeps its random track across phases and danger',()=>{
  const {audio,sources,buffers} = fixture();
  const random = Math.random;
  try {
    for (const [index,track] of ['music','covertAffair','spyGlass'].entries()) {
      audio.setScore('lobbyMusic');
      expect(sources.at(-1)?.buffer).toBe(buffers.get('lobbyMusic'));
      Math.random = ()=> (index+.5)/3;
      audio.setScore('music');
      expect(sources.at(-1)?.buffer).toBe(buffers.get(track));
      expect(sources.at(-1)?.loop).toBe(true);
      Math.random = ()=> .99;
      const count = sources.length;
      audio.setScore('music');
      expect(sources).toHaveLength(count);
      audio.setScore('hearingMusic');
      expect(sources.at(-1)?.buffer).toBe(buffers.get('hearingMusic'));
      audio.setScore('music');
      expect(sources.at(-1)?.buffer).toBe(buffers.get(track));
      audio.setCaloteDanger(5);
      expect(sources.at(-1)?.buffer).toBe(buffers.get('caloteMusic'));
      audio.setCaloteDanger(undefined);
      expect(sources.at(-1)?.buffer).toBe(buffers.get(track));
    }
    audio.leave();
    expect(Reflect.get(audio,'matchTrack')).toBeUndefined();
    expect(Reflect.get(audio,'score')).toBe('lobbyMusic');
  } finally { Math.random = random; }
});

test('a selected track still loading does not fall back to the old music',()=>{
  const {audio,sources,buffers} = fixture();
  audio.setScore('lobbyMusic');
  buffers.delete('covertAffair');
  Reflect.set(audio,'matchTrack','covertAffair');
  audio.setScore('music');
  expect(sources).toHaveLength(1);
  expect(Reflect.get(audio,'music')).toBeUndefined();
  buffers.set('covertAffair',{key:'covertAffair'});
  Reflect.get(audio,'startMusic').call(audio);
  expect(sources.at(-1)?.buffer).toBe(buffers.get('covertAffair'));
});
