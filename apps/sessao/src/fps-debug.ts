import type Phaser from 'phaser';
import {isEditingText} from './game-keys';

/** Use the engine's measurement without starting another render loop. */
export function createFpsDebug(parent:HTMLElement, game:Phaser.Game) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'fps-debug';
  button.title = 'Mostrar ou ocultar FPS (F8)';
  button.setAttribute('aria-keyshortcuts','F8');
  let visible = false;
  let nextUpdate = 0;
  const render = () => {
    button.textContent = visible ? `${Math.round(game.loop.actualFps)} FPS` : 'FPS';
    button.setAttribute('aria-pressed',String(visible));
    button.setAttribute('aria-label',`${visible ? 'Ocultar' : 'Mostrar'} FPS (F8)`);
  };
  const toggle = () => { visible = !visible; nextUpdate = 0; render(); };
  const onClick = () => { toggle(); parent.focus({preventScroll:true}); };
  const onKey = (event:KeyboardEvent) => {
    if (event.key!=='F8' || event.repeat || event.defaultPrevented || event.isComposing ||
      event.ctrlKey || event.altKey || event.metaKey || isEditingText(event.target)) return;
    event.preventDefault();
    toggle();
  };
  const onStep = () => {
    if (!visible || game.loop.now<nextUpdate) return;
    nextUpdate = game.loop.now+500;
    render();
  };
  render();
  parent.append(button);
  button.addEventListener('click',onClick);
  document.addEventListener('keydown',onKey);
  game.events.on('poststep',onStep);
  return {
    destroy() {
      game.events.off('poststep',onStep);
      document.removeEventListener('keydown',onKey);
      button.removeEventListener('click',onClick);
      button.remove();
    },
  };
}
