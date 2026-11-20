import Phaser from 'phaser';
import {spriteResolution, type SpriteResolution} from './sprite-resolution';

const stage = document.querySelector<HTMLDivElement>('#stage')!;
const tier = document.querySelector<HTMLSelectElement>('#tier')!;
const direction = document.querySelector<HTMLSelectElement>('#direction')!;
const size = document.querySelector<HTMLInputElement>('#size')!;
const status = document.querySelector<HTMLParagraphElement>('#status')!;
const density = window.devicePixelRatio || 1;
let paused = false;
let frame = 0;
let requested: SpriteResolution = 128;
let displayed: SpriteResolution = 128;
let failed = false;

class Comparison extends Phaser.Scene {
  private original!: Phaser.GameObjects.Sprite;
  private adaptive!: Phaser.GameObjects.Sprite;
  preload() { this.queue(128); }
  private queue(resolution: SpriteResolution) {
    this.load.spritesheet(`tiririca-${resolution}`, `${import.meta.env.BASE_URL}assets/tiririca-walk-${resolution}.png`, {
      frameWidth: resolution, frameHeight: resolution,
    });
  }
  create() {
    this.original = this.add.sprite(0, 0, 'tiririca-128');
    this.adaptive = this.add.sprite(0, 0, 'tiririca-128');
    this.load.on('loaderror', () => { failed = true; });
    this.load.on('complete', () => this.select());
    tier.addEventListener('change', () => { failed = false; this.select(); });
    size.addEventListener('input', () => { failed = false; this.select(); });
    this.select();
    this.time.addEvent({delay: 1000 / 9, loop: true, callback: () => { if (!paused) frame = (frame + 1) % 4; }});
  }
  private select() {
    requested = tier.value === 'auto' ? spriteResolution(Number(size.value), density) : Number(tier.value) as SpriteResolution;
    if (this.textures.exists(`tiririca-${requested}`)) {
      displayed = requested;
      this.adaptive.setTexture(`tiririca-${requested}`);
    } else if (!this.load.isLoading() && !failed) {
      this.queue(requested);
      this.load.start();
    }
  }
  update() {
    if (!this.original) return;
    const width = this.scale.width;
    const height = this.scale.height;
    const pixels = Number(size.value) * density;
    const index = Number(direction.value) * 4 + frame;
    this.original.setPosition(width * .25, height * .52).setFrame(index).setDisplaySize(pixels, pixels);
    this.adaptive.setPosition(width * .75, height * .52).setFrame(index).setDisplaySize(pixels, pixels);
    document.querySelector<HTMLOutputElement>('#size-label')!.value = `${size.value} px`;
    status.textContent = failed ? 'Falha ao carregar variante. Selecione outra resolução para tentar novamente.' :
      `Esquerda: 128 px · Direita: ${displayed} px${displayed !== requested ? ` (carregando ${requested})` : ''} · Tamanho: ${size.value} px · Densidade: ${density}× · Demanda: ${Math.ceil(pixels)} pixels físicos`;
  }
}
const game = new Phaser.Game({
  type: Phaser.AUTO, parent: stage, width: stage.clientWidth * density, height: stage.clientHeight * density,
  backgroundColor: '#22392c', antialias: true, scene: Comparison, scale: {mode: Phaser.Scale.NONE},
});
game.canvas.style.width = '100%';
game.canvas.style.height = '100%';
new ResizeObserver(() => game.scale.resize(stage.clientWidth * density, stage.clientHeight * density)).observe(stage);
document.querySelector<HTMLButtonElement>('#motion')!.onclick = event => {
  paused = !paused;
  (event.currentTarget as HTMLButtonElement).textContent = paused ? 'Retomar' : 'Pausar';
};
