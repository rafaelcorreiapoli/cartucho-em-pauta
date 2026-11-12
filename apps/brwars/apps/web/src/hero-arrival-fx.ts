import Phaser from 'phaser';
/** World-space resurrection effect follows its hero, never the viewport or camera. */
export function playHeroRevival(
  scene: Phaser.Scene,
  sprite: Phaser.GameObjects.Sprite,
  x: number,
  y: number,
  reducedMotion: boolean,
) {
  const root = scene.add
    .container(x, y)
    .setDepth(y - 2)
    .setAlpha(0);
  const beam = scene.add.graphics().setBlendMode(Phaser.BlendModes.ADD);
  beam
    .fillStyle(0xffe6a0, reducedMotion ? 0.12 : 0.2)
    .fillPoints(
      [
        new Phaser.Math.Vector2(-14, 3),
        new Phaser.Math.Vector2(14, 3),
        new Phaser.Math.Vector2(62, -195),
        new Phaser.Math.Vector2(-62, -195),
      ],
      true,
    );
  beam.fillStyle(0xfff8d9, 0.15).fillRect(-5, -190, 10, 190);
  const ring = scene.add
    .ellipse(0, 2, 66, 20, 0xffe5a0, 0.12)
    .setStrokeStyle(2, 0xffdc79, 0.9)
    .setBlendMode(Phaser.BlendModes.ADD);
  const halo = scene.add
    .ellipse(0, -sprite.displayHeight - 8, 30, 9)
    .setStrokeStyle(2, 0xffedb0, 1)
    .setBlendMode(Phaser.BlendModes.ADD);
  root.add([beam, ring, halo]);
  const sparks = scene.add.particles(0, -20, 'particle-dot', {
    emitting: false,
    lifespan: { min: 500, max: 1100 },
    speedX: { min: -22, max: 22 },
    speedY: { min: -65, max: -20 },
    gravityY: -15,
    scale: { start: 0.4, end: 0 },
    alpha: { start: 0.9, end: 0 },
    tint: [0xfff7d0, 0xffd878, 0xffffff],
    blendMode: 'ADD',
  });
  root.add(sparks);
  sparks.explode(reducedMotion ? 6 : 28);
  if (!reducedMotion) {
    scene.tweens.add({
      targets: ring,
      scaleX: 1.65,
      scaleY: 1.65,
      alpha: 0,
      duration: 1200,
      ease: 'Sine.Out',
    });
    for (let i = 0; i < 10; i++) {
      const star = scene.add
        .star(Phaser.Math.Between(-34, 34), Phaser.Math.Between(-80, -12), 4, 1.5, 5, 0xfff3bd)
        .setBlendMode(Phaser.BlendModes.ADD);
      root.add(star);
      scene.tweens.add({
        targets: star,
        y: star.y - 35,
        angle: 90,
        alpha: 0,
        duration: 800 + i * 65,
      });
    }
  }
  let cleaned = false;
  const follow = () => {
    if (!sprite.active) {
      cleanup();
      return;
    }
    root.setPosition(sprite.x, sprite.y).setDepth(sprite.depth - 1);
    halo.y = -sprite.displayHeight - 8;
  };
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    scene.events.off('update', follow);
    scene.events.off('shutdown', cleanup);
    scene.tweens.killTweensOf(root);
    for (const child of root.list) scene.tweens.killTweensOf(child);
    root.destroy(true);
  };
  scene.events.on('update', follow);
  scene.events.once('shutdown', cleanup);
  scene.tweens.add({
    targets: root,
    alpha: 1,
    duration: 180,
    onComplete: () =>
      scene.tweens.add({ targets: root, alpha: 0, delay: 850, duration: 700, onComplete: cleanup }),
  });
}
