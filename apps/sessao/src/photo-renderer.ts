import Phaser from 'phaser';
import { WorldView } from './world-view';
import { PHOTO_HEIGHT, PHOTO_WIDTH, photoBounds, type PhotoScene, type Photo } from './photography';
import { VISION_RADIUS } from './map';
import { wallVision } from './visibility';

type Request = { frame: PhotoScene; scale: number };

// Render saved state in an isolated scene, sharing Phaser, textures and visual rules with the map.
// Only the final image is copied into the UI canvas; no world art is redrawn in Canvas 2D.
export class PhotoRenderer {
  surveillanceEnabled = true;
  private pending = new Map<HTMLCanvasElement, Request>();
  private scene: Phaser.Scene;
  private world?: WorldView;
  private texture?: Phaser.Textures.DynamicTexture;
  private busy = false;
  private destroyed = false;

  constructor(private owner: Phaser.Scene) {
    const renderer = this;
    class PhotoWorld extends Phaser.Scene {
      constructor() {
        super({ key: 'photography-world' });
      }
      create() {
        renderer.world = new WorldView(this);
        this.cameras.main.setVisible(false);
      }
      update() {
        renderer.flush();
      }
    }
    this.scene = new PhotoWorld();
    owner.scene.add('photography-world', this.scene, true);
  }

  draw(canvas: HTMLCanvasElement, frame: PhotoScene, scale = 4) {
    // Snapshot legacy callers too: nothing in the asynchronous renderer may observe later mutations.
    const [,,width,height]=photoBounds(frame);
    if (canvas.width!==width*scale) canvas.width=width*scale;
    if (canvas.height!==height*scale) canvas.height=height*scale;
    const captured = structuredClone(frame);
    captured.features ??= {
      surveillance: this.surveillanceEnabled,
      projectVoting: true,
      decorations: true,
      portraitsAndVip: true,
    };
    this.pending.set(canvas, { frame: captured, scale });
  }

  private flush() {
    if (this.busy || !this.world || this.destroyed) return;
    const entry = this.pending.entries().next().value;
    if (!entry) return;
    const [canvas, request] = entry;
    this.pending.delete(canvas);
    const { frame, scale } = request;
    const [left,top,worldWidth,worldHeight]=photoBounds(frame);
    const width=worldWidth*scale,height=worldHeight*scale;
    const photo = frame as Photo;
    const subjects = photo.selfie ? { ...frame, people: frame.people.filter((person) => person.id !== photo.author.id) } : frame;
    this.world.render(subjects, frame.time ?? photo.at ?? 0, true);
    this.scene.children.depthSort();
    if (!this.texture) this.texture = this.scene.textures.addDynamicTexture('photography-frame', width, height) ?? undefined;
    const texture = this.texture;
    if (!texture) return;
    texture.setSize(width, height).clear();
    texture.camera.setScroll(left, top).setZoom(scale);
    texture.camera.setOrigin(0, 0);
    texture.fill(0x101d19);
    texture.draw(this.scene.children).render();
    this.busy = true;
    texture.snapshot((image) => {
      this.busy = false;
      if (this.destroyed || !(image instanceof HTMLImageElement)) return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(image, 0, 0);
      ctx.scale(scale, scale);
      if (!frame.camera) {
        const x = frame.center.x - left,
          y = frame.center.y - top;
        ctx.fillStyle = '#081710a8';
        ctx.beginPath();
        ctx.rect(0, 0, PHOTO_WIDTH, PHOTO_HEIGHT);
        const [first, ...edge] = wallVision(frame.center, VISION_RADIUS,true);
        ctx.moveTo(x + first.x, y + first.y);
        for (const point of edge) ctx.lineTo(x + point.x, y + point.y);
        ctx.closePath();
        ctx.fill('evenodd');
      }
      const photo = frame as Photo;
      if (photo.selfie) {
        const author = frame.people.find((person) => person.id === photo.author.id);
        if (author) {
          const atlas = this.scene.textures.get('installed-portraits').getSourceImage() as HTMLImageElement;
          ctx.drawImage(
            atlas,
            (author.character % 2) * 256,
            Math.floor(author.character / 2) * 256,
            256,
            256,
            (PHOTO_WIDTH - 68) / 2,
            PHOTO_HEIGHT - 68,
            68,
            68,
          );
        }
      }
    });
  }

  destroy() {
    this.destroyed = true;
    this.pending.clear();
    this.texture?.destroy();
    this.owner.scene.remove('photography-world');
  }
}
