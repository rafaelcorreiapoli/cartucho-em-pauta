export const soundNames = [
  'select',
  'build',
  'complete',
  'upgrade',
  'melee',
  'ranged',
  'death',
  'globalPower',
  'victory',
  'defeat',
  'error',
  'popularity',
  'heroArrival',
  'lulaEntry',
  'trumpEntry',
  'bolsonaroEntry',
  'cheEntry',
  'mamaefaleiEntry',
  'marcalEntry',
  'jonesEntry',
  'stalinEntry',
  'heroDeath',
] as const;
export type SoundEvent = (typeof soundNames)[number];
export interface AudioPreferences {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}
const defaults: AudioPreferences = { musicVolume: 0.22, sfxVolume: 0.5, muted: false };
const storageKey = 'brwars.audio.v1';
const files: Record<SoundEvent, string[]> = Object.fromEntries(
  soundNames.map((name) => [name, [name]]),
) as Record<SoundEvent, string[]>;
files.heroArrival = ['hero-arrival'];
files.lulaEntry = ['lula-entry'];
files.trumpEntry = ['trump-entry'];
files.bolsonaroEntry = ['bolsonaro-entry'];
files.cheEntry = ['che-entry'];
files.mamaefaleiEntry = ['mamaefalei-entry'];
files.marcalEntry = ['marcal-entry'];
files.jonesEntry = ['jones-entry'];
files.stalinEntry = ['stalin-entry'];
files.heroDeath = ['hero-death'];
files.melee = ['melee-1', 'melee-2'];
files.ranged = ['ranged-1', 'ranged-2'];
files.globalPower = ['global-power'];
const combat = new Set<SoundEvent>(['melee', 'ranged', 'death']);
const base = `${import.meta.env.BASE_URL}audio/`;
export function sanitizePreferences(value: unknown): AudioPreferences {
  const data = value && typeof value === 'object' ? (value as Partial<AudioPreferences>) : {};
  const volume = (v: unknown, fallback: number) =>
    typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
  return {
    musicVolume: volume(data.musicVolume, defaults.musicVolume),
    sfxVolume: volume(data.sfxVolume, defaults.sfxVolume),
    muted: typeof data.muted === 'boolean' ? data.muted : defaults.muted,
  };
}

export class GameAudio {
  private preferences: AudioPreferences = { ...defaults };
  private listeners = new Set<() => void>();
  private context?: AudioContext;
  private output?: GainNode;
  private music?: HTMLAudioElement;
  private encoded = new Map<string, Promise<ArrayBuffer>>();
  private buffers = new Map<string, Promise<AudioBuffer | undefined>>();
  private voices = new Set<AudioBufferSourceNode>();
  private lastPlayed = new Map<string, number>();
  private unlocked = false;
  private wantsMusic = true;
  private users = 0;
  private detach?: () => void;
  private generation = 0;

  constructor() {
    try {
      this.preferences = sanitizePreferences(
        JSON.parse(localStorage.getItem(storageKey) ?? 'null'),
      );
    } catch {
      /* Storage may be unavailable. */
    }
  }
  getSnapshot = () => this.preferences;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };
  setPreferences(update: Partial<AudioPreferences>) {
    this.preferences = sanitizePreferences({ ...this.preferences, ...update });
    try {
      localStorage.setItem(storageKey, JSON.stringify(this.preferences));
    } catch {
      /* Private mode can deny persistence. */
    }
    if (this.output)
      this.output.gain.value = this.preferences.muted ? 0 : this.preferences.sfxVolume;
    if (this.preferences.muted) this.stopVoices();
    this.syncMusic();
    this.listeners.forEach((listener) => listener());
  }
  /** Call from a pointer/key gesture. Audio is never started before this. */
  unlock = async () => {
    try {
      if (!this.context) {
        this.context = new AudioContext();
        this.output = this.context.createGain();
        const limiter = this.context.createDynamicsCompressor();
        this.output.connect(limiter);
        limiter.connect(this.context.destination);
        this.output.gain.value = this.preferences.muted ? 0 : this.preferences.sfxVolume;
      }
      this.unlocked = true;
      const resumed = this.context.resume();
      this.syncMusic();
      await resumed;
      await Promise.all(
        [...this.encoded.keys()]
          .filter((name) => name !== 'bossa-town')
          .map((name) => this.load(name)),
      );
    } catch {
      /* A blocked or unavailable audio device must not interrupt the game. */
    }
  };
  resume = this.unlock;
  startMusic() {
    this.wantsMusic = true;
    this.syncMusic();
  }
  stopMusic() {
    this.wantsMusic = false;
    this.music?.pause();
  }
  private syncMusic() {
    if (
      !this.unlocked ||
      !this.wantsMusic ||
      this.preferences.muted ||
      this.preferences.musicVolume === 0 ||
      document.hidden
    ) {
      this.music?.pause();
      return;
    }
    if (!this.music) {
      this.music = new Audio(`${base}bossa-town.mp3`);
      this.music.loop = true;
      this.music.preload = 'none';
    }
    this.music.volume = this.preferences.musicVolume;
    void this.music.play().catch(() => {
      /* Retry on the next gesture. */
    });
  }
  private fetchBytes(name: string) {
    let pending = this.encoded.get(name);
    if (!pending) {
      pending = fetch(`${base}${name}.mp3`)
        .then((response) => {
          if (!response.ok) throw new Error('Audio asset unavailable');
          return response.arrayBuffer();
        })
        .catch((error) => {
          this.encoded.delete(name);
          throw error;
        });
      this.encoded.set(name, pending);
    }
    return pending;
  }
  /** Download without playing or creating an AudioContext before a user gesture. */
  async prepare(onProgress: (progress: number) => void) {
    const names = [...new Set([...Object.values(files).flat(), 'bossa-town'])];
    let completed = 0;
    await Promise.all(
      names.map(async (name) => {
        await this.fetchBytes(name);
        onProgress(++completed / names.length);
      }),
    );
  }
  private load(name: string) {
    let pending = this.buffers.get(name);
    if (!pending) {
      const context = this.context!;
      pending = this.fetchBytes(name)
        .then((data) => context.decodeAudioData(data.slice(0)))
        .catch(() => {
          this.buffers.delete(name);
          return undefined;
        });
      this.buffers.set(name, pending);
    }
    return pending;
  }
  play(event: SoundEvent) {
    const context = this.context;
    if (
      !context ||
      !this.unlocked ||
      context.state !== 'running' ||
      this.preferences.muted ||
      !this.preferences.sfxVolume ||
      document.hidden
    )
      return;
    const now = performance.now();
    const cooldown = combat.has(event) ? 170 : event === 'select' ? 70 : 300;
    if (
      now - (this.lastPlayed.get(event) ?? -Infinity) < cooldown ||
      (combat.has(event) && now - (this.lastPlayed.get('combat') ?? -Infinity) < 90)
    )
      return;
    this.lastPlayed.set(event, now);
    if (combat.has(event)) this.lastPlayed.set('combat', now);
    const choices = files[event];
    const name = choices[Math.floor(Math.random() * choices.length)];
    const generation = this.generation;
    void this.load(name).then((buffer) => {
      if (
        !buffer ||
        generation !== this.generation ||
        context.state !== 'running' ||
        this.preferences.muted ||
        document.hidden ||
        performance.now() - now > 700
      )
        return;
      if (this.voices.size >= 12) {
        if (combat.has(event)) return;
        this.voices.values().next().value?.stop();
      }
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = buffer;
      source.playbackRate.value = combat.has(event) ? 0.94 + Math.random() * 0.12 : 1;
      gain.gain.value = combat.has(event)
        ? 0.34
        : event === 'globalPower'
          ? 0.65
          : event.endsWith('Entry')
            ? 0.55
            : 0.75;
      source.connect(gain);
      gain.connect(this.output!);
      this.voices.add(source);
      source.onended = () => {
        this.voices.delete(source);
        source.disconnect();
        gain.disconnect();
      };
      source.start();
    });
  }
  private stopVoices() {
    this.generation++;
    for (const source of this.voices) {
      try {
        source.stop();
      } catch {
        /* Already ended. */
      }
    }
    this.voices.clear();
  }
  /** Mount once with the game; returned cleanup handles StrictMode and hot reload. */
  attach() {
    this.users++;
    if (!this.detach) {
      const gesture = () => {
        void this.unlock();
      };
      const visibility = () => {
        if (document.hidden) this.stopVoices();
        this.syncMusic();
      };
      window.addEventListener('pointerdown', gesture, { passive: true });
      window.addEventListener('keydown', gesture);
      document.addEventListener('visibilitychange', visibility);
      this.detach = () => {
        window.removeEventListener('pointerdown', gesture);
        window.removeEventListener('keydown', gesture);
        document.removeEventListener('visibilitychange', visibility);
      };
    }
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (--this.users === 0) this.dispose();
    };
  }
  dispose() {
    this.detach?.();
    this.detach = undefined;
    this.users = 0;
    this.stopVoices();
    this.music?.pause();
    this.music?.removeAttribute('src');
    this.music?.load();
    this.music = undefined;
    if (this.context) void this.context.close().catch(() => {});
    this.context = undefined;
    this.output = undefined;
    this.buffers.clear();
    this.encoded.clear();
    this.lastPlayed.clear();
    this.unlocked = false;
  }
}
export const gameAudio = new GameAudio();
