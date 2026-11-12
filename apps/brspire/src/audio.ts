import type { HeroId } from "./heroes";

const files = {
  music: "trilha.mp3",
  draw: "draw.wav",
  click: "ui-click.wav",
  attack: "attack.wav",
  hit: "hit.wav",
  guard: "guard.wav",
  block: "block.wav",
  break: "break.wav",
  exhaust: "exhaust.wav",
  eventSuccess: "event-success.wav",
  eventFailure: "event-failure.wav",
} as const;

type HeroVoice = `hero/${HeroId}/${string}.mp3`;
type VoiceMoment = "selection" | "entrar-o-grosso";
const heroVoices: Partial<Record<HeroId, Record<VoiceMoment, readonly HeroVoice[]>>> = {
  lula: {
    selection: ["hero/lula/01.mp3"],
    "entrar-o-grosso": ["hero/lula/07.mp3"],
  },
};
type Cue = keyof typeof files | HeroVoice;
export type AudioChannel = "music" | "effects";
const volumes = { music: 0.34, effects: 0.75 };

function loadPreference(channel: AudioChannel) {
  try {
    return localStorage.getItem(`plenario.audio.${channel}`) !== "off";
  } catch {
    return true;
  }
}

class GameAudio {
  private prefs = {
    music: loadPreference("music"),
    effects: loadPreference("effects"),
  };
  private context?: AudioContext;
  private gains?: Record<AudioChannel, GainNode>;
  private music?: AudioBufferSourceNode;
  private startingMusic = false;
  private voice?: AudioBufferSourceNode;
  private voiceRequest = 0;
  private bytes = new Map<Cue, Promise<ArrayBuffer | null>>();
  private buffers = new Map<Cue, Promise<AudioBuffer | null>>();

  enabled(channel: AudioChannel) {
    return this.prefs[channel];
  }

  toggle(channel: AudioChannel) {
    this.prefs[channel] = !this.prefs[channel];
    try {
      localStorage.setItem(
        `plenario.audio.${channel}`,
        this.prefs[channel] ? "on" : "off",
      );
    } catch {
      // The current session can still control audio if storage is unavailable.
    }
    this.syncVolumes();
    this.unlock();
  }

  prefetch() {
    const entries: [Cue, string][] = [
      ...Object.entries(files) as [keyof typeof files, string][],
      ...Object.values(heroVoices).flatMap((moments) =>
        Object.values(moments).flat().map((clip): [HeroVoice, string] => [clip, clip])),
    ];
    for (const [cue, file] of entries) {
      if (this.bytes.has(cue)) continue;
      this.bytes.set(
        cue,
        fetch(`${import.meta.env.BASE_URL}audio/${file}`, { signal: AbortSignal.timeout(15_000) })
          .then((response) => (response.ok ? response.arrayBuffer() : null))
          .catch(() => null),
      );
    }
    return [...this.bytes.values()];
  }

  unlock() {
    if (typeof AudioContext === "undefined") return;
    if (!this.context) {
      const context = new AudioContext();
      this.context = context;
      this.gains = {
        music: context.createGain(),
        effects: context.createGain(),
      };
      for (const channel of ["music", "effects"] as const) {
        this.gains[channel].gain.value = this.prefs[channel]
          ? volumes[channel]
          : 0;
        this.gains[channel].connect(context.destination);
      }
      this.prefetch();
      for (const [cue, bytes] of this.bytes)
        this.buffers.set(
          cue,
          bytes
            .then((data) => (data ? context.decodeAudioData(data) : null))
            .catch(() => null),
        );
    }
    if (this.context.state === "running") this.startMusic();
    else
      void this.context
        .resume()
        .then(() => this.startMusic())
        .catch(() => {});
  }

  play(
    cue: Exclude<Cue, "music">,
    options: { delay?: number; rate?: number; gain?: number } = {},
  ) {
    const context = this.context;
    const output = this.gains?.effects;
    if (!context || !output || !this.prefs.effects) return;
    const voiceRequest = this.voiceRequest;
    const isVoice = cue.startsWith("hero/");
    const at = context.currentTime + (options.delay ?? 0);
    void this.buffers.get(cue)?.then((buffer) => {
      if (!buffer || !this.prefs.effects || context.state === "closed") return;
      if (isVoice && voiceRequest !== this.voiceRequest) return;
      const source = context.createBufferSource();
      const level = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = options.rate ?? 1;
      level.gain.value = options.gain ?? 1;
      source.connect(level).connect(output);
      if (isVoice) this.voice = source;
      source.onended = () => {
        if (this.voice === source) this.voice = undefined;
        source.disconnect();
        level.disconnect();
      };
      source.start(Math.max(context.currentTime, at));
    });
  }

  stopHeroVoice() {
    this.voiceRequest++;
    this.voice?.stop();
    this.voice = undefined;
  }

  playHeroVoice(hero: HeroId, moment: VoiceMoment) {
    this.stopHeroVoice();
    const clips = heroVoices[hero]?.[moment];
    if (!clips?.length) return;
    this.play(clips[Math.floor(Math.random() * clips.length)], { gain: 0.85 });
  }

  draw(count: number) {
    for (let index = 0; index < count; index++)
      this.play("draw", {
        delay: index * 0.055,
        rate: 1 + index * 0.045,
        gain: 0.72,
      });
  }

  private syncVolumes() {
    if (!this.context || !this.gains) return;
    for (const channel of ["music", "effects"] as const)
      this.gains[channel].gain.setTargetAtTime(
        this.prefs[channel] ? volumes[channel] : 0,
        this.context.currentTime,
        0.04,
      );
  }

  private startMusic() {
    const context = this.context;
    const output = this.gains?.music;
    if (
      !context ||
      !output ||
      this.music ||
      this.startingMusic ||
      !this.prefs.music
    )
      return;
    this.startingMusic = true;
    void this.buffers.get("music")?.then((buffer) => {
      this.startingMusic = false;
      if (!buffer || !this.prefs.music || context.state !== "running") return;
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      source.connect(output);
      source.start();
      this.music = source;
    });
  }
}

export const gameAudio = new GameAudio();
