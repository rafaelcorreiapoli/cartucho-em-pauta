import {expect,test} from 'bun:test';
import {GameAudio} from './game-audio';
import {sessionVerdict} from './session-verdict';

function fixture() {
  const sources:{buffer?:unknown;loop:boolean;starts:number[][];stopTimes:(number|undefined)[];start:(...args:number[])=>void;stop:(time?:number)=>void;connect:(node:unknown)=>unknown}[] = [];
  const gain = ()=>({gain:{value:1,events:[] as {kind:string;value:number;time:number}[],setTargetAtTime(){},
    setValueAtTime(value:number,time:number){this.events.push({kind:'set',value,time});},
    linearRampToValueAtTime(value:number,time:number){this.events.push({kind:'ramp',value,time});},
    cancelScheduledValues(){}},connect(){},disconnect(){}});
  const audio = new GameAudio();
  Reflect.set(audio,'context',{
    currentTime:1,createGain:gain,
    createBufferSource() {
      const source = {loop:false,playbackRate:{value:1},stops:0,starts:[] as number[][],stopTimes:[] as (number|undefined)[],
        connected:undefined as unknown,connect(node:unknown){this.connected = node;return node;},disconnect(){},
        start(...args:number[]){this.starts.push(args);},stop(time?:number){this.stops++;this.stopTimes.push(time);}};
      sources.push(source);
      return source;
    },
  });
  Reflect.set(audio,'musicGain',gain());
  Reflect.set(audio,'effectsGain',gain());
  Reflect.set(audio,'playing',true);
  Reflect.set(audio,'score','music');
  Reflect.set(audio,'matchTrack','covertAffair');
  const buffers = new Map(['music','covertAffair','spyGlass','lobbyMusic','hearingMusic','caloteMusic','cassationMusic','cassationSummons','victory','defeat','federalCaught','federalIsolation'].map(key=>[key,{key,duration:120}]));
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

test.each(['applause','powerDown'] as const)('%s plays once as an effect and respects mute and SFX volume',cue=>{
  const {audio,sources,buffers} = fixture();
  buffers.set(cue,{key:cue,duration:1});
  Reflect.set(audio,'effectsGain',{gain:{setTargetAtTime(){}},connect(){},disconnect(){}});
  const context = Reflect.get(audio,'context');
  const createSource = context.createBufferSource.bind(context);
  context.createBufferSource = ()=>Object.assign(createSource(),{playbackRate:{value:1}});
  context.createGain = ()=>({gain:{value:1},connect(){},disconnect(){}});
  audio.cue(cue);
  expect(sources).toHaveLength(1);
  expect(sources[0].buffer).toBe(buffers.get(cue));
  expect(sources[0].loop).toBe(false);
  audio.preferences.update({muted:true});
  audio.cue(cue);
  expect(sources).toHaveLength(1);
  audio.preferences.update({muted:false,sfxVolume:0});
  audio.cue(cue);
  expect(sources).toHaveLength(1);
  audio.preferences.update({sfxVolume:.5});
  audio.cue(cue);
  expect(sources).toHaveLength(2);
});

test('lobby music is separate and a match keeps its random track across phases and danger',()=>{
  const {audio,sources,buffers} = fixture();
  const random = Math.random;
  try {
    for (const [index,track] of ['covertAffair','spyGlass'].entries()) {
      audio.setScore('lobbyMusic');
      expect(sources.at(-1)?.buffer).toBe(buffers.get('lobbyMusic'));
      Math.random = ()=> (index+.5)/2;
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
  buffers.set('covertAffair',{key:'covertAffair',duration:120});
  Reflect.get(audio,'startMusic').call(audio);
  expect(sources.at(-1)?.buffer).toBe(buffers.get('covertAffair'));
});

test.each(['covertAffair','spyGlass'] as const)('%s resumes after repeated Calote warnings while Calote restarts',track=>{
  const {audio,sources} = fixture();
  const context = Reflect.get(audio,'context');
  Reflect.set(audio,'matchTrack',track);
  Reflect.get(audio,'startMusic').call(audio);
  expect(sources[0].starts).toEqual([[1,0]]);
  context.currentTime = 11;
  audio.setCaloteDanger(20);
  expect(sources[0].stopTimes).toEqual([11.7]);
  expect(sources[1].starts).toEqual([[11.7,0]]);
  context.currentTime = 21;
  audio.setCaloteDanger(undefined);
  expect(sources[2].starts[0][0]).toBeCloseTo(21.7);
  expect(sources[2].starts[0][1]).toBeCloseTo(10.7);
  context.currentTime = 31;
  audio.setCaloteDanger(20);
  expect(sources[3].starts[0][1]).toBe(0);
  context.currentTime = 41;
  audio.setCaloteDanger(undefined);
  expect(sources[4].starts[0][1]).toBeCloseTo(20.7);
});

test('lobby fades out completely before the match fades in',()=>{
  const {audio,sources} = fixture();
  const context = Reflect.get(audio,'context');
  audio.setScore('lobbyMusic');
  context.currentTime = 8;
  audio.setScore('music');
  expect(sources[0].stopTimes).toEqual([8.7]);
  const outgoing = Reflect.get(sources[0],'connected').gain.events;
  expect(outgoing.slice(-2)).toEqual([{kind:'set',value:1,time:8},{kind:'ramp',value:0,time:8.7}]);
  expect(sources[1].starts).toEqual([[8.7,0]]);
  const incoming = Reflect.get(sources[1],'connected').gain.events;
  expect(incoming.at(-2)).toEqual({kind:'set',value:0,time:8.7});
  expect(incoming.at(-1).kind).toBe('ramp');
  expect(incoming.at(-1).value).toBe(1);
  expect(incoming.at(-1).time).toBeCloseTo(9.4);
});

test('rapid reversals cancel a pending track and preserve the outgoing fade',()=>{
  const {audio,sources} = fixture();
  const context = Reflect.get(audio,'context');
  Reflect.get(audio,'startMusic').call(audio);
  context.currentTime = 11;
  audio.setCaloteDanger(20);
  context.currentTime = 11.2;
  audio.setCaloteDanger(undefined);
  expect(sources[1].stopTimes).toEqual([11.2]);
  expect(sources[2].starts[0][0]).toBeCloseTo(11.7);
  expect(sources[2].starts[0][1]).toBeCloseTo(10.7);
  const events = Reflect.get(sources[1],'connected').gain.events;
  expect(events.at(-2).value).toBe(0);
});

test('resuming wraps at the track duration and a new match clears the saved position',()=>{
  const {audio,sources,buffers} = fixture();
  const context = Reflect.get(audio,'context');
  buffers.set('covertAffair',{key:'covertAffair',duration:10});
  Reflect.get(audio,'startMusic').call(audio);
  context.currentTime = 26;
  audio.setCaloteDanger(20);
  context.currentTime = 30;
  audio.setCaloteDanger(undefined);
  expect(sources.at(-1)!.starts[0][1]).toBeCloseTo(5.7);
  context.currentTime = 35;
  audio.setScore('lobbyMusic');
  context.currentTime = 40;
  audio.setScore('music');
  expect(sources.at(-1)!.starts[0][1]).toBe(0);
});

test('leaving fades the music out instead of forcing an immediate stop',()=>{
  const {audio,sources} = fixture();
  Reflect.get(audio,'startMusic').call(audio);
  Reflect.get(audio,'context').currentTime = 5;
  audio.leave();
  expect(sources[0].stopTimes).toEqual([5.7]);
  expect(Reflect.get(audio,'positions').size).toBe(0);
});

test('cassation music loops through the summons and ballot, restores gameplay, and yields to the finale',()=>{
  const {audio,sources,buffers} = fixture();
  Reflect.get(audio,'startMusic').call(audio);
  Reflect.get(audio,'context').currentTime = 12;
  audio.setScore('cassationMusic');
  expect(sources.at(-1)?.buffer).toBe(buffers.get('cassationMusic'));
  expect(sources.at(-1)?.loop).toBe(true);
  const count = sources.length;
  audio.setScore('cassationMusic');
  audio.setCaloteDanger(5);
  expect(sources).toHaveLength(count);
  audio.setCaloteDanger(undefined);
  audio.setScore('music');
  expect(sources.at(-1)?.buffer).toBe(buffers.get('covertAffair'));
  expect(sources.at(-1)?.starts[0][1]).toBeGreaterThan(0);
  audio.setScore('cassationMusic');
  expect(sources.at(-1)?.starts[0][1]).toBe(0);
  audio.setScore('victory');
  expect(sources.at(-1)?.buffer).toBe(buffers.get('victory'));
  expect(sources.at(-1)?.loop).toBe(false);
});

test('dramatic cassation cue uses effects volume and respects mute',()=>{
  const {audio,sources,buffers} = fixture();
  audio.cue('cassationSummons');
  expect(sources.at(-1)?.buffer).toBe(buffers.get('cassationSummons'));
  expect(sources.at(-1)?.loop).toBe(false);
  audio.preferences.update({muted:true});
  audio.cue('cassationSummons');
  expect(sources).toHaveLength(1);
});
