import { useEffect, useState, useSyncExternalStore } from 'react';
import './audio.css';
import { gameAudio } from './gameAudio';

export function AudioControls() {
  const prefs = useSyncExternalStore(gameAudio.subscribe, gameAudio.getSnapshot);
  const [open, setOpen] = useState(false);
  useEffect(() => gameAudio.attach(), []);
  return (
    <div
      className="game-audio"
      onKeyDown={(event) => {
        if (event.key === 'Escape') setOpen(false);
      }}
    >
      <button
        className="game-audio-toggle"
        type="button"
        aria-label="Configurações de áudio"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        title="Áudio"
      >
        {prefs.muted ? '♪̸' : '♫'}
      </button>
      {open && (
        <section className="game-audio-panel" aria-label="Áudio">
          <header>
            ÁUDIO
            <button type="button" aria-label="Fechar áudio" onClick={() => setOpen(false)}>
              ×
            </button>
          </header>
          <label>
            Música <output>{Math.round(prefs.musicVolume * 100)}%</output>
            <input
              aria-label="Volume da música"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={prefs.musicVolume}
              onChange={(event) =>
                gameAudio.setPreferences({ musicVolume: Number(event.target.value) })
              }
            />
          </label>
          <label>
            Efeitos <output>{Math.round(prefs.sfxVolume * 100)}%</output>
            <input
              aria-label="Volume dos efeitos"
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={prefs.sfxVolume}
              onChange={(event) =>
                gameAudio.setPreferences({ sfxVolume: Number(event.target.value) })
              }
            />
          </label>
          <button
            className="game-audio-mute"
            type="button"
            aria-pressed={prefs.muted}
            onClick={() => gameAudio.setPreferences({ muted: !prefs.muted })}
          >
            {prefs.muted ? 'ATIVAR SOM' : 'SILENCIAR'}
          </button>
        </section>
      )}
    </div>
  );
}
