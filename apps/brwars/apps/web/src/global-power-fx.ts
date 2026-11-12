import { GLOBAL_POWER, globalPowerName, recallPosition, type Side } from '@brwars/simulation';
import Phaser from 'phaser';

import { laneX, laneY } from './map-layout';

// Scroll-factor zero cancels camera panning. Position relative to the zoom pivot,
// so HiDPI backing pixels never become world-space viewport coordinates.
function pinToViewport(
  scene: Phaser.Scene,
  object: Phaser.GameObjects.Rectangle | Phaser.GameObjects.Text,
  yFraction: number,
  fill = false,
) {
  object.setScrollFactor(0);
  const sync = () => {
    const camera = scene.cameras.main;
    const width = camera.width / camera.zoomX,
      height = camera.height / camera.zoomY;
    object.setPosition(camera.width / 2, camera.height / 2 + (yFraction - 0.5) * height);
    if (fill) object.setDisplaySize(width, height);
  };
  sync();
  scene.events.on(Phaser.Scenes.Events.POST_UPDATE, sync);
  object.once(Phaser.GameObjects.Events.DESTROY, () =>
    scene.events.off(Phaser.Scenes.Events.POST_UPDATE, sync),
  );
}

export function createBillTexture(scene: Phaser.Scene) {
  const paper = scene.make.graphics({ x: 0, y: 0 });
  paper.fillStyle(0x40503a, 0.25).fillRoundedRect(3, 3, 28, 38, 2);
  paper.fillStyle(0xfaf0cd).fillRoundedRect(1, 1, 27, 37, 2);
  paper.lineStyle(1, 0xa78c56).strokeRoundedRect(1, 1, 27, 37, 2);
  paper.fillStyle(0xc67b58).fillRect(5, 6, 19, 4);
  paper.fillStyle(0x6e7656).fillRect(5, 14, 15, 1).fillRect(5, 18, 19, 1).fillRect(5, 22, 12, 1);
  for (let i = 0; i < 10; i++) paper.fillRect(5 + i * 2, 28, i % 3 === 0 ? 2 : 1, 6);
  paper.generateTexture('bill-paper', 32, 42);
  paper.destroy();
}

export function playGlobalPower(
  scene: Phaser.Scene,
  targets: { x: number; y: number }[],
  resolution: number,
  onImpact: (x: number, y: number) => void,
) {
  const center = scene.cameras.main.midPoint;
  const shade = scene.add.rectangle(center.x, center.y, 1200, 670, 0x243b2d, 0.3).setDepth(1040);
  pinToViewport(scene, shade, 0.5, true);
  scene.tweens.add({ targets: shade, alpha: 0, duration: 1600, onComplete: () => shade.destroy() });
  const title = scene.add
    .text(center.x, center.y - 165, GLOBAL_POWER.name.toUpperCase(), {
      fontFamily: 'Barlow Condensed, Arial',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#fff0b2',
      stroke: '#263e25',
      strokeThickness: 5,
      resolution,
    })
    .setOrigin(0.5)
    .setDepth(1201)
    .setScale(0.8);
  const subtitle = scene.add
    .text(center.x, center.y - 136, 'A COBRANÇA VEIO EM ÁREA.', {
      fontFamily: 'DM Sans, Arial',
      fontSize: '10px',
      fontStyle: 'bold',
      color: '#f0dda0',
      stroke: '#263e25',
      strokeThickness: 3,
      resolution,
    })
    .setOrigin(0.5)
    .setDepth(1201);
  pinToViewport(scene, title, 0.25);
  pinToViewport(scene, subtitle, 0.295);
  scene.tweens.add({ targets: title, scaleX: 1, scaleY: 1, duration: 150, ease: 'Back.Out' });
  scene.tweens.add({
    targets: [title, subtitle],
    alpha: 0,
    delay: 950,
    duration: 450,
    onComplete: () => {
      title.destroy();
      subtitle.destroy();
    },
  });
  const rain = scene.add
    .particles(0, 0, 'bill-paper', {
      emitting: false,
      x: { min: center.x - 550, max: center.x + 550 },
      y: { min: center.y - 200, max: center.y - 100 },
      lifespan: { min: 500, max: 1000 },
      speedY: { min: 140, max: 230 },
      speedX: { min: -35, max: 15 },
      gravityY: 220,
      rotate: { min: -35, max: 25 },
      scale: { start: 0.65, end: 0.4 },
      alpha: { start: 0.85, end: 0 },
    })
    .setDepth(1080);
  rain.explode(36);
  scene.time.delayedCall(1100, () => rain.destroy());
  for (const target of targets) {
    const bill = scene.add
      .image(target.x + Phaser.Math.Between(-35, 35), target.y - 145, 'bill-paper')
      .setScale(0.7)
      .setAngle(Phaser.Math.Between(-20, 20))
      .setDepth(1150);
    scene.tweens.add({
      targets: bill,
      x: target.x,
      y: target.y,
      duration: Phaser.Math.Between(230, 420),
      angle: Phaser.Math.Between(-12, 12),
      ease: 'Quad.In',
      onComplete: () => {
        onImpact(target.x, target.y);
        scene.tweens.add({
          targets: bill,
          alpha: 0,
          scaleX: 0.3,
          scaleY: 0.3,
          duration: 130,
          onComplete: () => bill.destroy(),
        });
      },
    });
  }
}

export function playStatusPower(
  scene: Phaser.Scene,
  power: import('@brwars/simulation').PowerEvent,
  resolution: number,
  viewer: Side = 'left',
  battlefield?: import('@brwars/simulation').BattlefieldKind,
) {
  const kind = power.kind,
    color = kind === 'recall' ? 0xc4a0ff : kind === 'silence' ? 0x8be8f0 : 0xffc75b;
  const center = scene.cameras.main.midPoint;
  const name = globalPowerName(kind, power.side).toUpperCase();
  const label = power.workerLoss ? `${name} · −${power.workerLoss} TRAB.` : name;
  const title = scene.add
    .text(center.x, center.y - 150, label, {
      resolution,
      fontFamily: 'Barlow Condensed, Arial',
      fontSize: '30px',
      fontStyle: 'bold',
      color: '#fff0b2',
      stroke: '#263e25',
      strokeThickness: 5,
    })
    .setOrigin(0.5)
    .setDepth(1201);
  pinToViewport(scene, title, 0.25);
  scene.tweens.add({
    targets: title,
    alpha: 0,
    delay: 700,
    duration: 500,
    onComplete: () => title.destroy(),
  });
  const burst = (x: number, y: number) => {
    const particles = scene.add
      .particles(x, y - 20, 'particle-dot', {
        emitting: false,
        lifespan: 650,
        speed: { min: 25, max: 80 },
        scale: { start: 0.7, end: 0 },
        alpha: { start: 1, end: 0 },
        tint: color,
        blendMode: 'ADD',
      })
      .setDepth(1100);
    particles.explode(14);
    scene.time.delayedCall(700, () => particles.destroy());
    const ring = scene.add
      .ellipse(x, y, 45, 15)
      .setStrokeStyle(3, color)
      .setDepth(y + 1);
    scene.tweens.add({
      targets: ring,
      scaleX: 2,
      scaleY: 2,
      alpha: 0,
      duration: 650,
      onComplete: () => ring.destroy(),
    });
  };
  for (const target of power.targets) {
    burst(laneX(target.x, viewer, battlefield), laneY(target.row, battlefield, target.x, viewer));
    if (kind === 'recall') {
      const destination = recallPosition(target.x, power.side === 'left' ? 'right' : 'left');
      burst(
        laneX(destination, viewer, battlefield),
        laneY(target.row, battlefield, destination, viewer),
      );
    }
  }
}
