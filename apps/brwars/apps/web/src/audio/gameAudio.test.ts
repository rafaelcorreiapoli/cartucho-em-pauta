import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio, sanitizePreferences } from './gameAudio';

let created: FakeContext[];
class FakeSource {
  buffer: unknown;
  playbackRate = { value: 1 };
  onended?: () => void;
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn(() => this.onended?.());
}
class FakeContext {
  state = 'running';
  destination = {};
  sources: FakeSource[] = [];
  constructor() {
    created.push(this);
  }
  createGain() {
    return { gain: { value: 1 }, connect: vi.fn(), disconnect: vi.fn() };
  }
  createDynamicsCompressor() {
    return { connect: vi.fn() };
  }
  createBufferSource() {
    const source = new FakeSource();
    this.sources.push(source);
    return source;
  }
  decodeAudioData = vi.fn(async () => ({}));
  resume = vi.fn(async () => {});
  close = vi.fn(async () => {});
}
class FakeMusic {
  loop = false;
  preload = '';
  volume = 1;
  play = vi.fn(async () => {});
  pause = vi.fn();
  load = vi.fn();
  removeAttribute = vi.fn();
}
const flush = async () => {
  await new Promise((resolve) => setTimeout(resolve, 0));
};
beforeEach(() => {
  created = [];
  vi.stubGlobal('AudioContext', FakeContext);
  vi.stubGlobal('Audio', FakeMusic);
  vi.stubGlobal('document', { hidden: false });
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: vi.fn() });
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(8) })),
  );
});
afterEach(() => vi.unstubAllGlobals());
describe('audio boundary', () => {
  it('validates stored preferences without allowing NaN or out-of-range volumes', () => {
    expect(sanitizePreferences({ musicVolume: 2, sfxVolume: NaN, muted: 'false' })).toEqual({
      musicVolume: 1,
      sfxVolume: 0.5,
      muted: false,
    });
    expect(sanitizePreferences(null).musicVolume).toBe(0.22);
  });
  it('does not fetch or create audio before a gesture, and coalesces combat spam', async () => {
    const audio = new GameAudio();
    audio.play('melee');
    expect(created).toHaveLength(0);
    expect(fetch).not.toHaveBeenCalled();
    await audio.unlock();
    for (let i = 0; i < 100; i++) audio.play(i % 2 ? 'melee' : 'ranged');
    await flush();
    expect(created[0].sources).toHaveLength(1);
    audio.dispose();
    expect(created[0].close).toHaveBeenCalled();
  });
  it('cancels pending effects when muted or disposed', async () => {
    const audio = new GameAudio();
    await audio.unlock();
    audio.play('globalPower');
    audio.setPreferences({ muted: true });
    await flush();
    expect(created[0].sources).toHaveLength(0);
    audio.setPreferences({ muted: false });
    audio.play('build');
    audio.dispose();
    await flush();
    expect(created[0].sources).toHaveLength(0);
  });
  it('isolates unavailable assets from gameplay', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('offline');
      }),
    );
    const audio = new GameAudio();
    await audio.unlock();
    audio.play('build');
    await flush();
    expect(created[0].sources).toHaveLength(0);
    audio.dispose();
  });
});

it('hero arrival uses its own celestial asset and respects mute', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  audio.play('heroArrival');
  await flush();
  expect(fetch).toHaveBeenCalledWith(expect.stringContaining('hero-arrival.mp3'));
  expect(created[0].sources).toHaveLength(1);
  audio.setPreferences({ muted: true });
  expect(created[0].sources[0].stop).toHaveBeenCalled();
  audio.dispose();
});

it('usa o MP3 local da entrada em campo sem alterar o pitch', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  audio.play('lulaEntry');
  await flush();
  expect(fetch).toHaveBeenCalledWith('/audio/lula-entry.mp3');
  expect(created[0].sources[0].playbackRate.value).toBe(1);
  audio.dispose();
});

it.each(['jones', 'stalin', 'trump', 'bolsonaro', 'che', 'mamaefalei', 'marcal'] as const)(
  'usa o arquivo de %s no mixer sem alterar pitch',
  async (hero) => {
    const audio = new GameAudio();
    await audio.unlock();
    audio.play(`${hero}Entry`);
    await flush();
    expect(fetch).toHaveBeenCalledWith(`/audio/${hero}-entry.mp3`);
    expect(created[0].sources[0].playbackRate.value).toBe(1);
    audio.dispose();
  },
);

it('morte de herói tem um arquivo dramático próprio', async () => {
  const audio = new GameAudio();
  await audio.unlock();
  audio.play('heroDeath');
  await flush();
  expect(fetch).toHaveBeenCalledWith('/audio/hero-death.mp3');
  expect(created[0].sources[0].playbackRate.value).toBe(1);
  audio.dispose();
});

it('pré-carrega sons sem autoplay e reutiliza os downloads depois do gesto', async () => {
  const audio = new GameAudio(),
    progress: number[] = [];
  await audio.prepare((value) => progress.push(value));
  expect(created).toHaveLength(0);
  expect(fetch).toHaveBeenCalledWith('/audio/bossa-town.mp3');
  expect(fetch).toHaveBeenCalledWith('/audio/jones-entry.mp3');
  expect(fetch).toHaveBeenCalledWith('/audio/hero-death.mp3');
  expect(progress.at(-1)).toBe(1);
  const downloads = vi.mocked(fetch).mock.calls.length;
  await audio.unlock();
  audio.play('jonesEntry');
  await flush();
  expect(vi.mocked(fetch).mock.calls).toHaveLength(downloads);
  expect(created[0].sources).toHaveLength(1);
  expect(created[0].decodeAudioData).toHaveBeenCalled();
  audio.dispose();
});
it('falha de download é reportada no preparo, sem guardar uma resposta inválida', async () => {
  const audio = new GameAudio();
  vi.mocked(fetch).mockResolvedValueOnce({ ok: false } as Response);
  await expect(audio.prepare(() => {})).rejects.toThrow('Audio asset unavailable');
  await expect(audio.prepare(() => {})).resolves.toBeUndefined();
  audio.dispose();
});
