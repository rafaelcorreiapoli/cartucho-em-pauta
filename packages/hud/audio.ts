export interface AudioPreferences {
  musicVolume: number;
  sfxVolume: number;
  muted: boolean;
}

interface AudioStorage {
  read(): unknown;
  write(preferences: Readonly<AudioPreferences>, previous: Readonly<AudioPreferences>): void;
}

export function sanitizeAudioPreferences(
  value: unknown,
  defaults: AudioPreferences,
): AudioPreferences {
  const data = value && typeof value === 'object' ? (value as Partial<AudioPreferences>) : {};
  const volume = (input: unknown, fallback: number) =>
    typeof input === 'number' && Number.isFinite(input)
      ? Math.max(0, Math.min(1, input))
      : fallback;

  return {
    musicVolume: volume(data.musicVolume, defaults.musicVolume),
    sfxVolume: volume(data.sfxVolume, defaults.sfxVolume),
    muted: typeof data.muted === 'boolean' ? data.muted : defaults.muted,
  };
}

export function effectiveVolume(
  preferences: AudioPreferences,
  channel: 'music' | 'effects',
): number {
  if (preferences.muted) return 0;
  return channel === 'music' ? preferences.musicVolume : preferences.sfxVolume;
}

export function createAudioPreferences(
  defaults: AudioPreferences,
  storage: string | AudioStorage,
) {
  const adapter: AudioStorage =
    typeof storage === 'string'
      ? {
          read: () => JSON.parse(localStorage.getItem(storage) ?? 'null'),
          write: (preferences) => localStorage.setItem(storage, JSON.stringify(preferences)),
        }
      : storage;
  const listeners = new Set<() => void>();
  let preferences = { ...defaults };
  try {
    preferences = sanitizeAudioPreferences(adapter.read(), defaults);
  } catch {
    // The current session can still control audio if storage is unavailable.
  }

  return {
    getSnapshot: (): Readonly<AudioPreferences> => preferences,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    update(changes: Partial<AudioPreferences>) {
      const previous = preferences;
      preferences = sanitizeAudioPreferences({ ...previous, ...changes }, defaults);
      try {
        adapter.write(preferences, previous);
      } catch {
        // Keep the change in memory when storage is blocked.
      }
      listeners.forEach((listener) => listener());
    },
  };
}
