import rightMedicOrigins from '../medic-right-origins.json';
import { auraModifiers } from '@brwars/simulation';
import { PendingImpacts } from '../combat-feedback';
import {
  hasHeroArt,
  heroIdentity,
  heroRecord,
  unitAuraSources,
  troopAura,
  unitAuras,
  type AuraSource,
  type AuraStat,
  type GameState,
  type HeroKind,
  type Side,
  type Unit,
} from '@brwars/simulation';
import Phaser from 'phaser';
import { gameAudio } from '../audio';
import { drawAuraIndicators } from '../aura-indicators';
import { playHeroRevival } from '../hero-arrival-fx';
import heroOrigins from '../hero-origins.json';
import rangedOrigins from '../left-ranged-origins.json';
import { laneX as mapLaneX, laneY } from '../map-layout';
import medicOrigins from '../medic-origins.json';
import spriteOrigins from '../sprite-origins.json';
import type { SceneEnvironment } from './contracts';
import { BattleEffects } from './effects';
import {
  animationKey,
  healthColor,
  unitFrameStart,
  unitVisualHeight,
  variantTexture,
  VARIANT_GROUND_ORIGIN,
} from './unit-art';

export class UnitRenderer {
  units = new Map<
    number,
    {
      sprite: Phaser.GameObjects.Sprite;
      bar: Phaser.GameObjects.Graphics;
      shadow: Phaser.GameObjects.Image;
      x: number;
      side: Side;
      kind: Unit['kind'];
      tier?: Unit['productionTier'];
      hero?: HeroKind;
      level: number;
      damageTaken: number;
      healPulse?: number;
    }
  >();
  activeAuraSources: AuraSource[] = [];
  constructor(
    private scene: Phaser.Scene,
    private feedback: BattleEffects,
    private groundIndicators: Phaser.GameObjects.Graphics,
    private effects: Phaser.GameObjects.Graphics,
    private current: SceneEnvironment['current'],
    private reducedMotion: boolean,
    private heroBirths: Set<Side>,
    private pendingDamage: PendingImpacts,
  ) {}
  private laneX(x: number) {
    return mapLaneX(x, this.current.current.session.side, this.current.current.session.battlefield);
  }
  get(id: number) {
    return this.units.get(id);
  }
  clear() {
    for (const visual of this.units.values()) {
      visual.sprite.destroy();
      visual.bar.destroy();
      visual.shadow.destroy();
    }
    this.units.clear();
  }
  sync(game: GameState, delta: number) {
    this.activeAuraSources = unitAuraSources(game);
    const alive = new Set(game.units.map((u) => u.id));
    for (const [id, visual] of this.units)
      if (!alive.has(id) && !this.pendingDamage.has(id)) {
        visual.bar.destroy();
        this.units.delete(id);
        const { sprite, shadow, side, kind, hero, tier } = visual;
        sprite
          .disableInteractive()
          .stop()
          .setDepth(sprite.depth - 1);
        const fade = () => {
          this.scene.tweens.add({
            targets: [sprite, shadow],
            alpha: 0,
            delay: 350,
            duration: 300,
            onComplete: () => {
              sprite.destroy();
              shadow.destroy();
            },
          });
        };
        if (variantTexture(side, kind, tier)) {
          this.scene.tweens.add({
            targets: sprite,
            angle: sprite.flipX ? 65 : -65,
            scaleY: sprite.scaleY * 0.6,
            duration: 200,
            onComplete: fade,
          });
        } else {
          sprite.once('animationcomplete', fade);
          sprite.play(animationKey(side, kind, 'die', hero));
        }
      }
    for (const unit of game.units) this.drawUnit(unit, game, delta);
    this.heroBirths.clear();
  }
  alignSpriteFeet(sprite: Phaser.GameObjects.Sprite, side: Side, hero?: HeroKind) {
    if (sprite.texture.key.startsWith('variant-')) {
      sprite.setOrigin(0.5, VARIANT_GROUND_ORIGIN);
      return;
    }
    const frame = Number(sprite.frame.name);
    sprite.setOrigin(
      0.5,
      sprite.texture.key === 'left-ranged'
        ? (rangedOrigins[frame] ?? 0.9)
        : sprite.texture.key === 'medic-right'
          ? (rightMedicOrigins[frame] ?? 0.9)
          : sprite.texture.key === 'medic'
            ? (medicOrigins[frame] ?? 0.9)
            : hero && hasHeroArt(hero)
              ? ((heroOrigins as Record<string, number[]>)[hero]?.[frame] ?? 0.9)
              : (spriteOrigins[side][frame] ?? 0.9),
    );
  }
  drawUnit(unit: Unit, game: GameState, delta: number) {
    const { side: viewer, battlefield } = this.current.current.session;
    const targetX = this.laneX(unit.x),
      hero = unit.kind === 'hero' ? heroIdentity(unit) : undefined;
    const texture = variantTexture(unit.side, unit.kind, unit.productionTier);
    const size = unitVisualHeight(unit.kind, unit.level, unit.productionTier);
    let visual = this.units.get(unit.id);
    if (!visual) {
      const sprite = this.scene.add
        .sprite(
          targetX,
          390,
          texture ??
            (unit.side === 'left' && unit.kind === 'ranged'
              ? 'left-ranged'
              : unit.kind === 'medic'
                ? unit.side === 'left'
                  ? 'medic'
                  : 'medic-right'
                : hero && hasHeroArt(hero)
                  ? `hero-${hero}`
                  : `${unit.side}-animation`),
          unitFrameStart(unit),
        )
        .setFlipX(unit.side !== this.current.current.session.side);
      sprite
        .setDisplaySize((sprite.width / sprite.height) * size, size)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.current.current.onSelect({ kind: 'unit', id: unit.id }));
      this.alignSpriteFeet(sprite, unit.side, hero);
      sprite.on('animationupdate', () => this.alignSpriteFeet(sprite, unit.side, hero));
      const shadow = this.scene.add
        .image(targetX, 390, 'contact-shadow')
        .setDisplaySize(size * 0.72, size * 0.18)
        .setDepth(5);
      visual = {
        sprite,
        bar: this.scene.add.graphics(),
        shadow,
        x: targetX,
        side: unit.side,
        kind: unit.kind,
        tier: unit.productionTier,
        hero,
        level: unit.level,
        damageTaken: auraModifiers(unitAuras(game, unit, this.activeAuraSources)).damageTaken,
      };
      this.units.set(unit.id, visual);
      if (unit.kind === 'hero' && this.heroBirths.has(unit.side)) {
        if (hero && (heroRecord(game.players[unit.side], hero)?.revivals ?? 0) > 0)
          playHeroRevival(
            this.scene,
            sprite,
            targetX,
            laneY(unit.row, battlefield, unit.x, viewer),
            this.reducedMotion,
          );
        gameAudio.play('heroArrival');
      }
    }
    if (unit.kind === 'hero' && unit.level > visual.level) {
      this.feedback.dustBurst(visual.x, laneY(unit.row, battlefield, unit.x, viewer));
      this.feedback.cycleFeedback(
        visual.x,
        laneY(unit.row, battlefield, unit.x, viewer),
        `NV. ${unit.level}`,
        false,
        unit.side === this.current.current.session.side,
      );
      if (unit.side === this.current.current.session.side) gameAudio.play('upgrade');
    }
    visual.level = unit.level;
    const currentAnimation = visual.sprite.anims.currentAnim?.key;
    const attackingAnimation =
      currentAnimation ===
        animationKey(unit.side, unit.kind, 'attack', hero, unit.productionTier) &&
      visual.sprite.anims.isPlaying;
    if (unit.kind === 'medic') {
      if (unit.attacking) visual.sprite.play(animationKey(unit.side, 'medic', 'attack'), true);
      else if (Math.abs(targetX - visual.x) > 0.3)
        visual.sprite.play(animationKey(unit.side, 'medic', 'walk'), true);
      else visual.sprite.stop().setFrame(0);
    } else if (!attackingAnimation) {
      if (unit.attacking) {
        visual.sprite.stop();
        const frame = unitFrameStart(unit);
        if (texture && visual.sprite.texture.key !== texture)
          visual.sprite.setTexture(texture, frame);
        else visual.sprite.setFrame(frame);
      } else
        visual.sprite.play(
          animationKey(unit.side, unit.kind, 'walk', hero, unit.productionTier),
          true,
        );
    }
    this.alignSpriteFeet(visual.sprite, unit.side, hero);
    if (Math.abs(targetX - visual.x) > 200) visual.x = targetX;
    visual.x += (targetX - visual.x) * Math.min(1, delta / 75);
    if (Math.abs(visual.sprite.displayHeight - size) > 0.01) {
      visual.sprite.setDisplaySize((visual.sprite.width / visual.sprite.height) * size, size);
      visual.shadow.setDisplaySize(size * 0.72, size * 0.18);
    }
    const barOffset = size * 0.9 + 5;
    const barWidth = unit.kind === 'siege' ? 30 : unit.kind === 'hero' ? 22 : 18;
    const barHeight = unit.kind === 'siege' ? 4 : 2.5;
    const y = laneY(unit.row, battlefield, unit.x, viewer);
    if ((unit.silencedUntil ?? 0) > game.time) {
      this.effects.lineStyle(2, 0x8be8f0).strokeCircle(visual.x, y - barOffset - 10, 6);
      this.effects.lineBetween(visual.x - 5, y - barOffset - 15, visual.x + 5, y - barOffset - 5);
    }
    if ((unit.strengthUntil ?? 0) > game.time)
      this.groundIndicators
        .lineStyle(2, 0xffc75b, 0.7 + Math.sin(game.time * 6) * 0.2)
        .strokeEllipse(visual.x, y + 2, size, 12);

    visual.sprite.setPosition(visual.x, y).setDepth(y);
    visual.shadow.setPosition(visual.x, y + 1);
    const bar = visual.bar;
    bar.clear().setDepth(y + 1);
    const selectedEntity = this.current.current.selection;
    const selected =
      (selectedEntity?.kind === 'unit' && selectedEntity.id === unit.id) ||
      (selectedEntity?.kind === 'hero' &&
        selectedEntity.side === unit.side &&
        selectedEntity.hero === hero);
    if (selected)
      this.groundIndicators
        .lineStyle(1.5, 0xd8ee99, 1)
        .strokeEllipse(visual.x, y + 1, size * 0.85, size * 0.23);
    const auraRadius = hero || unit.kind === 'medic' ? 140 : troopAura(unit)?.radius;
    if (selected && auraRadius)
      this.groundIndicators
        .lineStyle(1, 0xe8d67d, 0.2)
        .strokeCircle(visual.x, y, Math.abs(this.laneX(unit.x + auraRadius) - this.laneX(unit.x)));
    else if (unit.kind === 'hero')
      this.groundIndicators
        .lineStyle(2, 0xf6d477, 0.7)
        .strokeEllipse(visual.x, y + 2, size * 0.42, size * 0.15);
    const effects = unitAuras(game, unit, this.activeAuraSources);
    visual.damageTaken = auraModifiers(effects).damageTaken;
    const indicators: { stat: AuraStat; amount: number }[] = [...effects];
    if ((unit.strengthUntil ?? 0) > game.time) indicators.push({ stat: 'damage', amount: 1 });
    if ((unit.silencedUntil ?? 0) > game.time) indicators.push({ stat: 'attackSpeed', amount: -1 });
    if (
      unit.hp < unit.maxHp &&
      indicators.some((effect) => effect.stat === 'healing') &&
      game.time - (visual.healPulse ?? -2) >= 1
    ) {
      visual.healPulse = game.time;
      const pulse = this.scene.add
        .particles(visual.x, y - size * 0.4, 'healing-cross', {
          emitting: false,
          lifespan: 650,
          speedX: { min: -6, max: 6 },
          speedY: { min: -28, max: -18 },
          scale: { start: 0.4, end: 0.2 },
          alpha: { start: 0.85, end: 0 },
        })
        .setDepth(y + 2);
      pulse.explode(2);
      this.scene.time.delayedCall(750, () => pulse.destroy());
    }
    drawAuraIndicators(bar, visual.x, y - barOffset - 9, indicators);
    bar
      .fillStyle(0x0b150e, 0.98)
      .fillRect(visual.x - barWidth / 2 - 1, y - barOffset - 1, barWidth + 2, barHeight + 2);
    bar
      .fillStyle(healthColor(this.pendingDamage.health(unit.id, unit.hp, unit.maxHp) / unit.maxHp))
      .fillRect(
        visual.x - barWidth / 2,
        y - barOffset,
        (barWidth * this.pendingDamage.health(unit.id, unit.hp, unit.maxHp)) / unit.maxHp,
        barHeight,
      );
    bar
      .lineStyle(0.8, 0xf3edc8, 0.95)
      .strokeRect(visual.x - barWidth / 2 - 1, y - barOffset - 1, barWidth + 2, barHeight + 2);
  }
}
