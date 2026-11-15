import { createAudioPreferences, effectiveVolume } from '../../../packages/hud/audio';

const files = {
  music:'corredores-de-brasilia.mp3',
  ballotMusic:'plenario-em-ebulicao.m4a',
  session:'sessao.wav', ballot:'votacao.wav', vote:'voto.wav',
  summons:'convocacao.wav', approved:'aprovado.wav', rejected:'rejeitado.wav',
  election:'eleicao.wav', alert:'alerta.wav', end:'fim.wav', cash:'caixa.wav', pickup:'item-obtido.wav',
  eat:'comer.wav', drink:'beber.wav',
  stamp:'carimbo.wav', lock:'fechadura.wav', shutter:'obturador.wav',
  swing:'porrete-golpe.wav', impact:'porrete-impacto.wav', fall:'personagem-queda.wav',
  foot1:'passo-1.wav', foot2:'passo-2.wav', foot3:'passo-3.wav', foot4:'passo-4.wav',
} as const;
type Sample = keyof typeof files;
export type CombatCue = 'swing'|'impact'|'fall';
type Score = 'music'|'ballotMusic';
export type Cue = Exclude<Sample,Score | `foot${number}`>;
const footsteps = ['foot1','foot2','foot3','foot4'] as const;

export class GameAudio {
  readonly preferences = createAudioPreferences({musicVolume:.24,sfxVolume:.52,muted:false},'cartuchao.sessao.audio');
  private context?: AudioContext;
  private musicGain?: GainNode;
  private effectsGain?: GainNode;
  private score:Score = 'music';
  private music?: {score:Score;source:AudioBufferSourceNode;gain:GainNode;started:number};
  private fading = new Set<AudioBufferSourceNode>();
  private buffers = new Map<Sample,AudioBuffer>();
  private loading?:Promise<void>;
  private playing = false;
  private speaking = false;
  private footIndex = 0;
  private lastCashCue = -Infinity;

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
        if (key==='music' || key==='ballotMusic') this.startMusic();
      } catch {}
    })).then(() => {});
    this.startMusic();
    return this.loading;
  }

  setBallotMusic(voting:boolean) {
    const score = voting ? 'ballotMusic' : 'music';
    if (this.score===score) return;
    this.score = score;
    this.startMusic();
  }

  leave() {
    this.playing = false;
    this.lastCashCue = -Infinity;
    this.stopMusic(0);
    for (const source of this.fading) source.stop();
    this.score = 'music';
    this.setSpeaking(false);
  }

  private stopMusic(fade:number) {
    const track = this.music;
    if (!track || !this.context) return;
    this.music = undefined;
    const now = this.context.currentTime;
    track.gain.gain.cancelScheduledValues(now);
    track.gain.gain.setValueAtTime(Math.min(1,(now-track.started)/.7),now);
    track.gain.gain.linearRampToValueAtTime(0,now+fade);
    this.fading.add(track.source);
    track.source.stop(now+fade);
  }

  private startMusic() {
    const score = this.buffers.has(this.score) ? this.score : 'music';
    const buffer = this.buffers.get(score);
    if (!this.playing || this.music?.score===score || !buffer || !this.context || !this.musicGain) return;
    const now = this.context.currentTime;
    this.stopMusic(.7);
    const source = this.context.createBufferSource();
    const gain = this.context.createGain();
    source.buffer = buffer;
    source.loop = true;
    gain.gain.setValueAtTime(0,now);
    gain.gain.linearRampToValueAtTime(1,now+.7);
    source.connect(gain).connect(this.musicGain);
    source.onended = () => { this.fading.delete(source); source.disconnect(); gain.disconnect(); };
    this.music = {score,source,gain,started:now};
    source.start(now);
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
    const {context,effectsGain} = this;
    if (!this.playing || !context || !effectsGain) return;
    const notes = cue==='levelUp' ? [523.25,659.25,783.99,1046.5] : [659.25,880];
    notes.forEach((frequency,index)=>{
      const start = context.currentTime+index*(cue==='levelUp' ? .086 : .055);
      const duration = cue==='levelUp' ? .28 : .12;
      const tone = context.createOscillator();
      const envelope = context.createGain();
      tone.type = index===0 ? 'triangle' : 'sine';
      tone.frequency.value = frequency;
      envelope.gain.setValueAtTime(.0001,start);
      envelope.gain.exponentialRampToValueAtTime(cue==='levelUp' ? .19 : .085,start+.014);
      envelope.gain.exponentialRampToValueAtTime(.0001,start+duration);
      tone.connect(envelope).connect(effectsGain);
      tone.onended = () => { tone.disconnect(); envelope.disconnect(); };
      tone.start(start);
      tone.stop(start+duration);
    });
  }

  stationClick() { this.play('vote',.75,0,1.35); }
  footstep(level:number,pan:number) {
    this.play(footsteps[this.footIndex++ % footsteps.length],level*.5,pan,.94+Math.random()*.12);
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
  }
}
