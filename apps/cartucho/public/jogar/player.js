import { registerOpening } from '../ranking-api.js';

const player = document.querySelector('.player');
const button = player.querySelector('button');
const label = button.querySelector('[data-screen-label]');

function syncFullscreen() {
  const nativeFullscreen = document.fullscreenElement === player;
  const expanded = player.classList.contains('is-expanded');
  button.setAttribute('aria-pressed', String(nativeFullscreen || expanded));
  if (nativeFullscreen) {
    label.textContent = 'Sair da tela cheia';
  } else if (expanded) {
    label.textContent = 'Restaurar';
  } else {
    label.textContent = document.fullscreenEnabled ? 'Tela cheia' : 'Expandir';
  }
}

button.addEventListener('click', async () => {
  if (document.fullscreenElement === player) {
    await document.exitFullscreen();
  } else if (player.classList.contains('is-expanded')) {
    player.classList.remove('is-expanded');
  } else {
    try {
      await player.requestFullscreen();
    } catch {
      player.classList.add('is-expanded');
    }
  }
  syncFullscreen();
});

document.addEventListener('fullscreenchange', syncFullscreen);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && player.classList.contains('is-expanded')) {
    player.classList.remove('is-expanded');
    syncFullscreen();
    button.focus();
  }
});

syncFullscreen();
button.hidden = false;
registerOpening(player.dataset.game).catch(() => {});
