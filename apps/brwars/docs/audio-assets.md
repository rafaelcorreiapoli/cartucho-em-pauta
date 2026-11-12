# Music and sound effects

All audio ships locally; no runtime requests to third-party services, subscription, attribution screen requirement or API key. All sources below are **CC0 1.0**. We retain the creator credits and Kenney's original license in `apps/web/public/audio/licenses/`.

| Local files | Original | Author / source |
| --- | --- | --- |
| `bossa-town.mp3` | `Bossa Town.wav_2.flac`, full 100.35-second instrumental | **Karate Studios** — [Bossa Town](https://opengameart.org/content/bossa-town) |
| `select.mp3` | `select_001.ogg` | **Kenney** — [Interface Sounds](https://kenney.nl/assets/interface-sounds), [creator's OpenGameArt upload](https://opengameart.org/content/interface-sounds) |
| `build.mp3` | `click_003.ogg` | Kenney, same pack |
| `complete.mp3` | `confirmation_002.ogg` | Kenney, same pack |
| `upgrade.mp3` | `maximize_008.ogg` | Kenney, same pack |
| `victory.mp3`, `defeat.mp3` | `confirmation_004.ogg`, `minimize_008.ogg` | Kenney, same pack |
| `error.mp3`, `popularity.mp3` | `error_003.ogg`, `pluck_001.ogg` | Kenney, same pack |
| `melee-1.mp3`, `melee-2.mp3` | `NPC/beetle/bite-small.wav`, `bite-small2.wav` | **artisticdude** — [RPG Sound Pack](https://opengameart.org/content/rpg-sound-pack) |
| `ranged-1.mp3`, `ranged-2.mp3` | `battle/swing.wav`, `swing2.wav` | artisticdude, same pack |
| `death.mp3` | `inventory/cloth-heavy.wav` (body/fabric fall, no voice) | artisticdude, same pack |
| `global-power.mp3` | `battle/magic1.wav` | artisticdude, same pack |

Downloaded 2026-11-05 from creator uploads. Original download URLs are retained in `licenses/cc0-assets.txt`. Modifications: FFmpeg MP3 transcoding (music stereo 160 kbps; SFX mono 44.1 kHz 96 kbps). No composition edits or speech. At runtime combat effects vary playback speed by ±6%; individual effects use conservative gains. The full music repeats with HTMLAudio loop; its original arrangement includes an ending, so this is not an authored seamless stem.

## Integration

```tsx
import { AudioControls, gameAudio } from './audio';
// Render exactly once in the top rail:
<AudioControls />
// Invoke only when a real event happens, never once per render/tick:
gameAudio.play('select');
```

The component installs gesture unlock and visibility cleanup. It has a fixed 42×38 button and an absolutely positioned panel. Music starts after the first pointer/key gesture. Add `gameAudio.attach()` yourself only if you do not mount the controls; call its returned disposer at teardown.

Events: `select`, `build` (accepted command), `complete` (building becomes ready), `upgrade`, `melee`, `ranged`, `death`, `globalPower`, `victory`, `defeat`, `error`, `popularity`. Trigger combat from actual hit/attack transitions, not every snapshot. Trigger results once on the transition to game-over. `startMusic()` / `stopMusic()` control the background independently; `unlock()` and alias `resume()` can be called from a user gesture. `setPreferences({ musicVolume, sfxVolume, muted })` accepts volumes 0–1, persists validated values locally, and fails safely if storage is unavailable.

SFX use native Web Audio with buffer caching, shared combat throttling, per-event cooldowns, at most 12 voices and a compressor. Events before unlock are discarded; hidden tabs pause music and discard effects. Muting/teardown cancels pending effects. Asset/network/device failures never block gameplay. Music and effects have independent volumes; all files are same-origin.

## Chegada divina do herói
`hero-arrival.mp3`: composição procedural original do projeto, sinos em acorde maior, camada harmônica suave e ecos estéreo; sem samples externos ou fala. Gerada por `python3 scripts/generate-hero-arrival.py` e convertida com FFmpeg para MP3 estéreo 128 kbps. Reproduzida uma vez na conclusão do recrutamento de herói, respeitando desbloqueio por gesto, mute e volume de efeitos. Não toca para heróis já presentes ao carregar o renderer. FX Phaser acompanha o personagem em coordenadas do mundo, com feixe, auréola, anel e partículas douradas; possui limpeza de tweens/listeners e modo de movimento reduzido.

## Falas de memes

O catálogo, a fonte e o disparo da fala solicitada para o primeira entrada em campo do Lula estão em [meme-audio-catalog.md](meme-audio-catalog.md). Esse upload não faz parte dos assets CC0 descritos acima.
