import Phaser from 'phaser';
import { gameAudio } from '../audio';

export class BattleEffects {
  constructor(
    private scene: Phaser.Scene,
    private resolution: () => number,
    private reducedMotion: boolean,
  ) {}
  upgradeBurst(x: number, y: number, building: Phaser.GameObjects.Image) {
    const sparks = this.scene.add
      .particles(x, y - 30, 'particle-dot', {
        emitting: false,
        lifespan: { min: 350, max: 750 },
        speedX: { min: -45, max: 45 },
        speedY: { min: -90, max: -25 },
        gravityY: -20,
        scale: { start: 0.65, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: [0xf9df87, 0xfef4ba, 0xa6dc79],
        blendMode: 'ADD',
      })
      .setDepth(1100);
    sparks.explode(16);
    this.scene.time.delayedCall(800, () => sparks.destroy());
    this.scene.tweens.killTweensOf(building);
    const width = building.getData('skinWidth') ?? building.displayWidth;
    const height = building.getData('skinHeight') ?? building.displayHeight;
    building.setDisplaySize(width, height).setTint(0xfff0af);
    this.scene.tweens.add({
      targets: building,
      scaleX: building.scaleX * 1.07,
      scaleY: building.scaleY * 1.07,
      yoyo: true,
      duration: 130,
      ease: 'Back.Out',
      onComplete: () => building.clearTint(),
    });
  }
  productionBurst(
    x: number,
    y: number,
    building: Phaser.GameObjects.Image,
    label: string,
    popularity: boolean,
    audible: boolean,
  ) {
    this.upgradeBurst(x, y, building);
    this.cycleFeedback(x, y, label, popularity, audible);
  }
  cycleFeedback(x: number, y: number, label: string, popularity: boolean, audible: boolean) {
    const ring = this.scene.add
      .ellipse(x, y + 20, 65, 20)
      .setStrokeStyle(3, popularity ? 0xf9df87 : 0xb8efa0)
      .setDepth(y + 23);
    this.scene.tweens.add({
      targets: ring,
      scaleX: 1.7,
      scaleY: 1.7,
      alpha: 0,
      duration: 650,
      onComplete: () => ring.destroy(),
    });
    const text = this.scene.add
      .text(x, y - 85, label, {
        resolution: this.resolution(),
        fontFamily: 'Arial',
        fontSize: '12px',
        fontStyle: 'bold',
        color: popularity ? '#ffe790' : '#c9ffbc',
        stroke: '#172414',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(1200);
    this.scene.tweens.add({
      targets: text,
      y: y - 115,
      alpha: 0,
      delay: 350,
      duration: 850,
      onComplete: () => text.destroy(),
    });
    if (audible) gameAudio.play(popularity ? 'popularity' : 'complete');
  }
  spending(x: number, y: number, cost: number) {
    const text = this.scene.add
      .text(x, y - 18, `− R$ ${cost.toLocaleString('pt-BR')}`, {
        resolution: this.resolution(),
        fontFamily: 'Arial',
        fontSize: '16px',
        fontStyle: 'bold',
        color: '#ff7068',
        stroke: '#280c0a',
        strokeThickness: 4,
      })
      .setOrigin(0.5, 1)
      .setDepth(1300);
    this.scene.tweens.add({
      targets: text,
      y: y - (this.reducedMotion ? 24 : 62),
      alpha: 0,
      delay: 180,
      duration: 1000,
      ease: 'Cubic.Out',
      onComplete: () => text.destroy(),
    });
  }
  bloodBurst(x: number, y: number, direction: number) {
    const blood = this.scene.add
      .particles(x, y, 'particle-dot', {
        emitting: false,
        lifespan: { min: 220, max: 480 },
        speedX: { min: -35 + direction * 20, max: 35 + direction * 35 },
        speedY: { min: -100, max: -25 },
        gravityY: 280,
        scale: { start: 0.28, end: 0.07 },
        alpha: { start: 0.95, end: 0.1 },
        tint: [0xa72c25, 0xc13c2c, 0x791e20],
      })
      .setDepth(1250);
    blood.explode(this.reducedMotion ? 3 : 9);
    this.scene.time.delayedCall(550, () => blood.destroy());
  }
  dustBurst(x: number, y: number) {
    const dust = this.scene.add
      .particles(x, y, 'particle-dot', {
        emitting: false,
        lifespan: 320,
        speed: { min: 20, max: 65 },
        scale: { start: 0.6, end: 0 },
        alpha: { start: 0.7, end: 0 },
        tint: [0xd9bf7b, 0xffe7a6],
        gravityY: 100,
      })
      .setDepth(1250);
    dust.explode(7);
    this.scene.time.delayedCall(400, () => dust.destroy());
  }
}
