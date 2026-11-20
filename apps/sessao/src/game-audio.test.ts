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
      const source = {loop:false,connect(node:unknown){return node;},disconnect(){},start(){},stop(){}};
      sources.push(source);
      return source;
    },
  });
  Reflect.set(audio,'musicGain',gain());
  Reflect.set(audio,'playing',true);
  const buffers = new Map(['music','caloteMusic','victory','defeat'].map(key=>[key,{key}]));
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
