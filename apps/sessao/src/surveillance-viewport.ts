import Phaser from 'phaser';
import { preloadWorldArt, createWorldAnimations } from './world-art';
import { WorldView } from './world-view';
import type { PhotoScene } from './photography';
import { spyRules } from './surveillance';

export function createSurveillanceViewport(parent: HTMLElement, onFirstDraw?: () => void) {
  let latest: PhotoScene | undefined;
  let waitingForFrame = true;
  const density = 4;
  class Viewport extends Phaser.Scene {
    private world!: WorldView;
    preload() {
      preloadWorldArt(this);
    }
    create() {
      createWorldAnimations(this);
      this.world = new WorldView(this);
      this.cameras.main.setZoom(density).setVisible(false);
    }
    update(time: number) {
      if (!latest?.camera) return;
      const area=latest.camera.area;
      const width=(area?.[2] ?? spyRules.range*2)*density;
      const height=(area?.[3] ?? spyRules.range*2)*density;
      if (this.scale.width!==width || this.scale.height!==height) this.scale.resize(width,height);
      parent.style.aspectRatio=String(width/height);
      parent.style.setProperty('--camera-aspect',String(width/height));
      this.cameras.main.setVisible(true).centerOn(latest.camera.x, latest.camera.y);
      this.world.render(latest, time);
      if (waitingForFrame) {
        waitingForFrame = false;
        if (onFirstDraw) this.game.events.once(Phaser.Core.Events.POST_RENDER, onFirstDraw);
      }
    }
  }
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    antialias: true,
    roundPixels: false,
    parent,
    width: spyRules.range * 2 * density,
    height: spyRules.range * 2 * density,
    scene: Viewport,
    backgroundColor: '#101d19',
    autoFocus: false,
    input: { keyboard: false, mouse: false, touch: false },
    audio: { noAudio: true },
  });
  return {
    receive(frame: PhotoScene) {
      latest = frame;
    },
    clear() {
      latest = undefined;
      waitingForFrame = true;
      for (const scene of game.scene.scenes) scene.cameras.main.setVisible(false);
    },
    destroy() {
      game.destroy(true);
    },
  };
}
