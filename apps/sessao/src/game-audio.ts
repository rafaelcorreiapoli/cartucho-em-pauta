import type {Role} from './plenary';
import type {FederalAudioStage} from './federal-patrol';
import { createAudioPreferences, effectiveVolume } from '../../../packages/hud/audio';

const files = {
  victory:'vitoria.mp3', defeat:'derrota.mp3', rescue:'salvou-a-patria.wav', cassationCaught:'cassacao-infiltrado.mp3', firstBlood:'first-blood.mp3',
  lobbyMusic:'corredores-de-brasilia.mp3',
  covertAffair:'covert-affair.mp3', spyGlass:'spy-glass.mp3',
  hearingMusic:'plenario-em-ebulicao.m4a',
  caloteMusic:'hitman.mp3', cassationMusic:'the-escalation.mp3', cassationSummons:'cassation-summons.mp3',
  session:'sessao.wav', ballot:'votacao.wav', vote:'voto.wav',
  summons:'convocacao.wav', approved:'aprovado.wav', rejected:'rejeitado.wav',
  election:'eleicao.wav', alert:'alerta.wav', end:'fim.wav', cash:'caixa.wav', pickup:'item-obtido.wav',
  explosion:'explosao-cofre.wav', powerDown:'pane-eletrica.wav',
  federalCaught:'federal-siren.mp3', federalIsolation:'federal-trombone.mp3',
  applause:'aplausos.wav',
  eat:'comer.wav', drink:'beber.wav',
  stamp:'carimbo.wav', lock:'fechadura.wav', shutter:'obturador.wav',
  swing:'porrete-golpe.wav', impact:'porrete-impacto.wav', fall:'personagem-queda.wav',
  foot1:'passo-carpete-1.wav', foot2:'passo-carpete-2.wav', foot3:'passo-carpete-3.wav', foot4:'passo-carpete-4.wav',
} as const;
type Sample = keyof typeof files;
export type CombatCue = 'swing'|'impact'|'fall';
type Score = 'lobbyMusic'|'music'|'hearingMusic'|'caloteMusic'|'cassationMusic'|'victory'|'defeat';
const matchTracks = ['covertAffair','spyGlass'] as const;
type MatchTrack = typeof matchTracks[number];
type MusicTrack = Score | MatchTrack;
const isFinalScore = (score:MusicTrack) => score==='victory' || score==='defeat';
export type Cue = Exclude<Sample,MusicTrack | `foot${number}`>;
const MUSIC_FADE = .7;
const footsteps = ['foot1','foot2','foot3','foot4'] as const;

export class GameAudio {
  readonly preferences = createAudioPreferences({musicVolume:.24,sfxVolume:.52,muted:false},'cartuchao.sessao.audio');
  private context?: AudioContext;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private score:Score = 'lobbyMusic';
  private matchTrack?:MatchTrack;
  private music?: {score:MusicTrack;source:AudioBufferSourceNode;gain:GainNode;started:number;offset:number};
  private positions = new Map<MusicTrack,number>();
  private fadeUntil = 0;
  private buffers = new Map<Sample,AudioBuffer>();
  private loading?:Promise<void>;
  private playing = false;
  private caloteDanger = 0;
  private speaking = false;
  private lastFootIndex = 0;
  private lastCashCue = -Infinity;
  private federalEffect?:AudioBufferSourceNode;
  private eliminationEffect?:AudioBufferSourceNode;
  private revealingCassation = false;

  constructor() {
    this.preferences.subscribe(() => this.updateGain());
  }

  unlock() {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.musicGain = this.context.createGain();
        this.effectsGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
        this.effectsGain.connect(this.context.destination);
        this.updateGain();
      }
      void this.context.resume().catch(() => {});
    } catch {
      // Audio support is optional; play remains available without it.
    }
  }

  private updateGain() {
    if (!this.context || !this.musicGain || !this.effectsGain) return;
    const preferences = this.preferences.getSnapshot();
    const now = this.context.currentTime;
    this.musicGain.gain.setTargetAtTime(effectiveVolume(preferences,'music')*(this.speaking ? .36 : 1),now,.12);
    this.effectsGain.gain.setTargetAtTime(effectiveVolume(preferences,'effects'),now,.08);
  }

  setSpeaking(speaking:boolean) {
    if (speaking===this.speaking) return;
    this.speaking = speaking;
    this.updateGain();
  }

  enter() {
    const context = this.context;
    if (!context) return;
    this.playing = true;
    this.loading ??= Promise.all((Object.keys(files) as Sample[]).map(async key => {
      try {
        const response = await fetch(`${import.meta.env.BASE_URL}assets/audio/${files[key]}`);
        if (!response.ok) return;
        this.buffers.set(key,await context.decodeAudioData(await response.arrayBuffer()));
        this.startMusic();
      } catch {}
    })).then(() => {});
    this.startMusic();
    return this.loading;
  }

  setScore(score:Score) {
    if (this.score===score) return;
    if (score==='lobbyMusic' || isFinalScore(score)) {
      this.matchTrack = undefined;
      this.positions.clear();
    }
    else this.matchTrack ??= matchTracks[Math.floor(Math.random()*matchTracks.length)];
    this.score = score;
    this.startMusic();
  }

  setCaloteDanger(seconds:number|undefined) {
    const danger = seconds===undefined ? 0 : seconds<=10 ? 2 : 1;
    if (danger===this.caloteDanger) return;
    this.caloteDanger = danger;
    if (danger) this.cue('alert');
    this.startMusic();
  }

  leave() {
    this.eliminationEffect?.stop();
    this.eliminationEffect = undefined;
    this.revealingCassation = false;
    this.playing = false;
    this.federalEffect?.stop();
    this.federalEffect = undefined;
    this.lastCashCue = -Infinity;
    this.matchTrack = undefined;
    this.positions.clear();
    this.stopMusic(MUSIC_FADE);
    this.score = 'lobbyMusic';
    this.caloteDanger = 0;
    this.setSpeaking(false);
  }

  private stopMusic(fade:number) {
    const track = this.music;
    if (!track || !this.context) return;
    this.music = undefined;
    const now = this.context.currentTime;
    // A replacement may still be waiting for the previous fade-out to finish.
    const audible = now>track.started;
    const end = audible ? now+fade : now;
    if (this.matchTrack && (track.score===this.matchTrack || track.score==='hearingMusic')) {
      const duration = track.source.buffer!.duration;
      this.positions.set(track.score,(track.offset+Math.max(0,end-track.started))%duration);
    }
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(Math.max(0,Math.min(1,(now-track.started)/MUSIC_FADE)),now);
    track.gain.gain.linearRampToValueAtTime(0,end);
    track.source.stop(end);
    this.fadeUntil = Math.max(this.fadeUntil,end);
  }

  private startMusic() {
    if (this.revealingCassation) return;
    const requested = this.score==='lobbyMusic' || isFinalScore(this.score) ? this.score :
      this.score==='cassationMusic' ? 'cassationMusic' : this.caloteDanger ? 'caloteMusic' : this.score==='music' ? this.matchTrack ?? 'covertAffair' : this.score;
    // Wait for the selected track instead of briefly playing a different one while loading.
    const score = requested;
    if (!this.buffers.has(requested) && this.music?.score!==requested) this.stopMusic(MUSIC_FADE);
    const buffer = this.buffers.get(score);
    if (!this.playing || this.music?.score===score || !buffer || !this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    this.stopMusic(MUSIC_FADE);
    const started = Math.max(now,this.fadeUntil);
    const offset = this.positions.get(score) ?? 0;
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = !isFinalScore(score);
    gain.gain.setValueAtTime(0,now);
    gain.gain.setValueAtTime(0,started);
    gain.gain.linearRampToValueAtTime(1,started+MUSIC_FADE);
    source.connect(gain).connect(this.musicGain);
    source.onended = () => { source.disconnect(); gain.disconnect(); };
    this.music = {score,source,gain,started,offset};
    source.start(started,offset);
  }

  cue(name:Cue) {
    if (name==='cash') {
      // A treasury delivery can also pay a mission reward in the next snapshot.
      const now = performance.now();
      if (now-this.lastCashCue<200) return;
      this.lastCashCue = now;
    }
    this.play(name,.62,0,1);
  }
  progression(cue:'levelUp'|'attribute') {
    if (cue==='levelUp') this.playNotes([523.25,659.25,783.99,1046.5],.086,.28,.19);
    else this.playNotes([659.25,880],.055,.12,.085);
  }

  actionFailed() { this.playNotes([392,294],.066,.105,.085); }

  private playNotes(notes:number[],spacing:number,duration:number,level:number) {
    const {context,effectsGain} = this;
    if (!this.playing || !context || !effectsGain) return;
    notes.forEach((frequency,index)=>{
      const start = context.currentTime+index*spacing;
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = index===0 ? 'triangle' : 'sine';
      tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001,start);
      envelope.gain.exponentialRampToValueAtTime(level,start+.014);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      tone.connect(envelope).connect(effectsGain);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
      tone.start(start);
      tone.stop(start+duration);
    });
  }

  federal(stage:FederalAudioStage) {
    this.federalEffect?.stop();
    this.federalEffect = stage==='cancelled' ? undefined : this.play(stage==='caught' ? 'federalCaught' : 'federalIsolation',.62,0,1);
  }

  cassationResult(role:Role|undefined) {
    this.eliminationEffect?.stop();
    this.eliminationEffect = undefined;
    this.revealingCassation = role!==undefined;
    if (role) {
      this.stopMusic(.25);
      this.eliminationEffect = this.play(role==='Infiltrado' ? 'cassationCaught' : 'federalIsolation',.7,0,1);
    } else this.startMusic();
  }

  stationClick() { this.play('vote',.75,0,1.35); }
  footstep(level:number,pan:number) {
    const offset = 1 + Math.floor(Math.random() * (footsteps.length - 1));
    this.lastFootIndex = (this.lastFootIndex + offset) % footsteps.length;
    this.play(footsteps[this.lastFootIndex],level,pan,.97+Math.random()*.06);
  }

  combat(name:CombatCue,level:number,pan:number) {
    const volumes = {swing:.54,impact:.73,fall:.78};
    this.play(name,level*volumes[name],pan,.97+Math.random()*.06);
  }

  private play(name:Sample, level:number, pan:number, rate:number) {
    const {context,effectsGain} = this;
    const buffer = this.buffers.get(name);
    if (!this.playing || !context || !effectsGain || !buffer || !effectiveVolume(this.preferences.getSnapshot(),'effects')) return;
    const source = context.createBufferSource();
    source.buffer = buffer;
    source.playbackRate.value = rate;
    const gain = context.createGain();
    gain.gain.value = level;
    const panner = typeof context.createStereoPanner==='function' ? context.createStereoPanner() : undefined;
    source.connect(gain);
    if (panner) {
      panner.pan.value = pan;
      gain.connect(panner);
      panner.connect(effectsGain);
    } else gain.connect(effectsGain);
    source.onended = () => {
      source.disconnect();
      gain.disconnect();
      panner?.disconnect();
    };
    source.start();
    return source;
  }
}
