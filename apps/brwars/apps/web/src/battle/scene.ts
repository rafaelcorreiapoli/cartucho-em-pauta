import { PendingImpacts, ATTACK_FRAME_RATE, ATTACK_RELEASE_MS } from '../combat-feedback';
import {
  MEDIC,
  battlefieldLayout,
  HEROES,
  PROMOTION_OFFERS,
  hasHeroArt,
  isBuildingReady,
  isResearchBuilding,
  maxBaseHp,
  opposite,
  recallPosition,
  trainingDuration,
  type CombatEvent,
  type HeroKind,
  type Side,
} from '@brwars/simulation';
import Phaser from 'phaser';
import { gameAudio } from '../audio';
import { currentProduction } from '@brwars/simulation';
import { buildingArt, buildingDisplaySize } from '../building-art';
import buildingOrigins from '../building-origins.json';
import buildingTops from '../building-tops.json';
import {
  DEFAULT_ZOOM,
  VIEW_HEIGHT,
  VIEW_WIDTH,
  cameraAt,
  clampZoom,
  homeCamera,
  zoomAround,
} from '../camera';
import { createBillTexture, playGlobalPower, playStatusPower } from '../global-power-fx';
import {
  MAP_HEIGHT as HEIGHT,
  MAP_WIDTH as WIDTH,
  BASE_GROUND_OFFSET,
  BASE_HEALTH_Y_OFFSET,
  BUILDING_GROUND_OFFSET,
  basePosition as mapBasePosition,
  buildingPosition as mapBuildingPosition,
  constructionFrame,
  laneX as mapLaneX,
  laneY as mapLaneY,
} from '../map-layout';
import type { Session } from '../session';
import workerOrigins from '../worker-origins.json';
import { workerPose } from '../workers';
import { preloadBattleAssets } from './assets';
import { drawTerrain, preloadTerrain } from './terrain';
import type { SceneEnvironment } from './contracts';
import { BattleEffects } from './effects';
import {
  animationKey,
  healthColor,
  unitRow,
  unitVisualHeight,
  VARIANT_CLASSES,
  variantTexture,
  variantWalkTexture,
  VARIANT_WALK_FRAMES,
} from './unit-art';
import { UnitRenderer } from './UnitRenderer';

export function createBattleScene(environment: SceneEnvironment) {
  const { host, overlayWorld, projection, scroll, current, setZoom, view, updateMapView } =
    environment;
  const basePosition = (side: Side) =>
    mapBasePosition(side, current.current.session.side, current.current.session.battlefield);
  const buildingPosition = (side: Side, slot: number) =>
    mapBuildingPosition(
      side,
      slot,
      current.current.session.side,
      current.current.session.battlefield,
    );
  const laneX = (x: number) =>
    mapLaneX(x, current.current.session.side, current.current.session.battlefield);
  const laneY = (row: number, x: number) =>
    mapLaneY(row, current.current.session.battlefield, x, current.current.session.side);
  class Battle extends Phaser.Scene {
    feedback!: BattleEffects;
    unitRenderer!: UnitRenderer;

    workers = new Map<
      string,
      { sprite: Phaser.GameObjects.Sprite; shadow: Phaser.GameObjects.Image }
    >();
    buildings: Record<Side, Phaser.GameObjects.Image[]> = { left: [], right: [] };
    buildingShadows: Record<Side, Phaser.GameObjects.Image[]> = { left: [], right: [] };
    levels = new Map<string, number>();
    heroBirths = new Set<Side>();
    baseProduction = new Map<Side, { workers: number; heroBirthSerial: number }>();
    activeConstruction = new Set<string>();
    cycles = new Map<string, number>();
    effects!: Phaser.GameObjects.Graphics;
    groundIndicators!: Phaser.GameObjects.Graphics;
    pendingDamage = new PendingImpacts();
    combatTimers = new Set<Phaser.Time.TimerEvent>();
    processedHits = new Set<number>();
    processedPowers = new Set<number>();
    activeSession?: Session;
    cameraPosition = { x: 0, y: 0 };
    zoomAnchor: { x: number; y: number } | undefined;
    cameraSerial = -1;
    keys = new Set<string>();
    pointer: { x: number; y: number; inside: boolean; drag: boolean } = {
      x: 0,
      y: 0,
      inside: false,
      drag: false,
    };
    cameraClock = 0;
    lastWheelTime = -1000;
    reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    preload() {
      this.load.on(Phaser.Loader.Events.PROGRESS, environment.onLoadProgress);
      this.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, environment.onAssetError);
      preloadBattleAssets(this);
      preloadTerrain(this, current.current.session.battlefield);
    }
    syncMapControls() {
      const canvas = this.game.canvas,
        root = host.current,
        overlay = overlayWorld.current;
      if (!root || !overlay) return;
      const bounds = canvas.getBoundingClientRect(),
        parent = root.getBoundingClientRect(),
        sx = bounds.width / canvas.width,
        sy = bounds.height / canvas.height;
      const matrix = this.cameras.main.matrixCombined;
      overlay.style.transform = `matrix(${matrix.a * sx},${matrix.b * sy},${matrix.c * sx},${matrix.d * sy},${bounds.left - parent.left + matrix.tx * sx},${bounds.top - parent.top + matrix.ty * sy})`;
    }
    create() {
      this.feedback = new BattleEffects(this, () => view.renderScale, this.reducedMotion);
      this.game.events.on(Phaser.Core.Events.POST_RENDER, this.syncMapControls, this);
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
        this.game.events.off(Phaser.Core.Events.POST_RENDER, this.syncMapControls, this),
      );
      createBillTexture(this);
      const shadowTexture = this.make.graphics({ x: 0, y: 0 });
      shadowTexture.fillStyle(0x15200e, 0.035).fillEllipse(64, 20, 126, 38);
      shadowTexture.fillStyle(0x15200e, 0.06).fillEllipse(64, 20, 111, 30);
      shadowTexture.fillStyle(0x15200e, 0.1).fillEllipse(64, 20, 94, 23);
      shadowTexture.fillStyle(0x15200e, 0.15).fillEllipse(64, 20, 73, 15);
      shadowTexture.generateTexture('contact-shadow', 128, 40);
      shadowTexture.destroy();
      const healingTexture = this.make.graphics({ x: 0, y: 0 });
      healingTexture.fillStyle(0x9ef3ae).fillRect(6, 0, 4, 16).fillRect(0, 6, 16, 4);
      healingTexture.generateTexture('healing-cross', 16, 16);
      healingTexture.destroy();
      this.cameras.main.setZoom(view.renderScale * view.worldZoom);
      const navigate = (event: KeyboardEvent, pressed: boolean) => {
        if (
          document.querySelector('[role="dialog"]') ||
          (event.target instanceof HTMLElement &&
            (event.target.closest('[data-match-chat]') ||
              ['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)))
        ) {
          this.keys.clear();
          return;
        }
        const resetZoom = event.shiftKey && ['Digit0', 'Numpad0'].includes(event.code);
        if (
          pressed &&
          !event.ctrlKey &&
          !event.metaKey &&
          !event.altKey &&
          (resetZoom || ['+', '=', '-'].includes(event.key))
        ) {
          event.preventDefault();
          setZoom((value) =>
            resetZoom ? DEFAULT_ZOOM : clampZoom(value + (event.key === '-' ? -0.1 : 0.1)),
          );
          return;
        }
        if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', ' '].includes(event.key)) {
          event.preventDefault();
          if (pressed && (event.key === 'Home' || event.key === ' ')) {
            const home = homeCamera(
              current.current.session.side,
              view.worldZoom,
              current.current.session.side,
              current.current.session.battlefield,
            );
            this.cameraPosition = { x: home.x, y: home.y };
          }
          if (pressed) this.keys.add(event.key);
          else this.keys.delete(event.key);
        }
      };
      const down = (e: KeyboardEvent) => navigate(e, true),
        up = (e: KeyboardEvent) => navigate(e, false);
      const move = (e: PointerEvent) => {
        const bounds = host.current!.getBoundingClientRect();
        const x = e.clientX - bounds.left,
          y = e.clientY - bounds.top;
        if (this.pointer.drag) {
          const scale =
            (host.current!.querySelector('canvas')!.getBoundingClientRect().width / VIEW_WIDTH) *
            view.worldZoom;
          this.cameraPosition.x -= (x - this.pointer.x) / scale;
          this.cameraPosition.y -= (y - this.pointer.y) / scale;
        }
        this.pointer = {
          ...this.pointer,
          x,
          y,
          inside:
            x >= 0 &&
            y >= 0 &&
            x < bounds.width &&
            y < bounds.height &&
            !(
              e.target instanceof Element &&
              e.target.closest('[data-camera-controls], [data-match-chat]')
            ),
        };
      };
      const start = (e: PointerEvent) => {
        if (e.button === 1 && this.pointer.inside) {
          e.preventDefault();
          this.pointer.drag = true;
        }
      };
      const wheel = (event: WheelEvent) => {
        if (document.querySelector('[role="dialog"]')) return;
        event.preventDefault();
        if (event.ctrlKey) {
          const bounds = host.current!.querySelector('canvas')!.getBoundingClientRect();
          this.zoomAnchor = {
            x: (event.clientX - bounds.left) / bounds.width,
            y: (event.clientY - bounds.top) / bounds.height,
          };
          setZoom((value) => clampZoom(value * Math.exp(-event.deltaY * 0.004)));
          return;
        }
        const multiplier =
          event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? host.current!.clientHeight : 1;
        this.cameraPosition.x += (event.deltaX * multiplier) / projection.current.scaleX;
        this.cameraPosition.y += (event.deltaY * multiplier) / projection.current.scaleY;
        this.lastWheelTime = this.time.now;
      };
      const layer = host.current!.parentElement!;
      layer.addEventListener('wheel', wheel, { passive: false });
      const end = () => {
        this.pointer.drag = false;
      };
      const blur = () => {
        this.keys.clear();
        this.pointer.inside = false;
        end();
      };
      window.addEventListener('keydown', down);
      window.addEventListener('keyup', up);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerdown', start);
      window.addEventListener('pointerup', end);
      window.addEventListener('blur', blur);
      this.events.once('shutdown', () => {
        layer.removeEventListener('wheel', wheel);
        window.removeEventListener('keydown', down);
        window.removeEventListener('keyup', up);
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerdown', start);
        window.removeEventListener('pointerup', end);
        window.removeEventListener('blur', blur);
      });
      for (const side of ['left', 'right'] as const) {
        for (const kind of VARIANT_CLASSES) {
          const texture = variantTexture(side, kind, 1)!;
          const walkTexture = variantWalkTexture(side, kind);
          for (const tier of [1, 2, 3] as const) {
            const start = (tier - 1) * 3;
            const walkStart = walkTexture ? (tier - 1) * VARIANT_WALK_FRAMES : start;
            const walkCount = walkTexture ? VARIANT_WALK_FRAMES : 2;
            this.anims.create({
              key: animationKey(side, kind, 'walk', undefined, tier),
              frames: this.anims.generateFrameNumbers(walkTexture ?? texture, {
                start: walkStart,
                end: walkStart + walkCount - 1,
              }),
              frameRate: walkTexture ? 9 : 6,
              repeat: -1,
            });
            this.anims.create({
              key: animationKey(side, kind, 'attack', undefined, tier),
              frames: this.anims.generateFrameNumbers(texture, { frames: [start, start + 2] }),
              frameRate: ATTACK_FRAME_RATE,
              repeat: 0,
            });
          }
        }
      }
      for (const side of ['left', 'right'] as const)
        for (const kind of ['front', 'ranged', 'siege', 'hero'] as const) {
          const texture =
            side === 'left' && kind === 'ranged' ? 'left-ranged' : `${side}-animation`;
          const start = side === 'left' && kind === 'ranged' ? 0 : unitRow(kind) * 8;
          this.anims.create({
            key: animationKey(side, kind, 'walk'),
            frames: this.anims.generateFrameNumbers(texture, { start, end: start + 3 }),
            frameRate: 6,
            repeat: -1,
          });
          this.anims.create({
            key: animationKey(side, kind, 'attack'),
            frames: this.anims.generateFrameNumbers(texture, {
              start: start + 4,
              end: start + 5,
            }),
            frameRate: ATTACK_FRAME_RATE,
            repeat: 0,
          });
          this.anims.create({
            key: animationKey(side, kind, 'die'),
            frames: this.anims.generateFrameNumbers(texture, {
              start: start + 6,
              end: start + 7,
            }),
            frameRate: 5,
            repeat: 0,
          });
        }
      for (const side of ['left', 'right'] as const)
        for (const [state, start, end, rate, repeat] of [
          ['walk', 0, 3, 6, -1],
          ['attack', 4, 5, 5, -1],
          ['die', 6, 7, 5, 0],
        ] as const)
          this.anims.create({
            key: animationKey(side, 'medic', state),
            frames: this.anims.generateFrameNumbers(side === 'left' ? 'medic' : 'medic-right', {
              start,
              end,
            }),
            frameRate: rate,
            repeat,
          });
      for (const hero of Object.keys(HEROES) as HeroKind[])
        if (hasHeroArt(hero)) {
          for (const [state, start, end, rate, repeat] of [
            ['walk', 0, 3, 6, -1],
            ['attack', 4, 5, ATTACK_FRAME_RATE, 0],
            ['die', 6, 7, 5, 0],
          ] as const)
            this.anims.create({
              key: animationKey(HEROES[hero].side, 'hero', state, hero),
              frames: this.anims.generateFrameNumbers(`hero-${hero}`, { start, end }),
              frameRate: rate,
              repeat,
            });
        }
      drawTerrain(this, current.current.session.battlefield);
      this.add
        .zone(WIDTH / 2, HEIGHT / 2, WIDTH, HEIGHT)
        .setInteractive()
        .on('pointerdown', () => current.current.onSelect(null));
      // Construction pads are interactive; all combat is handled by the shared simulation.
      for (const side of ['left', 'right'] as const) {
        this.anims.create({
          key: `worker-${side}-walk`,
          frames: this.anims.generateFrameNumbers('workers', {
            start: side === 'left' ? 0 : 4,
            end: side === 'left' ? 3 : 7,
          }),
          frameRate: 5,
          repeat: -1,
        });
        const { x: baseX, y: baseY } = basePosition(side);
        const frame = side === 'left' ? 3 : 7;
        this.add
          .image(baseX, baseY + BASE_GROUND_OFFSET, 'contact-shadow')
          .setDisplaySize(218, 48)
          .setDepth(5);
        this.add
          .image(baseX, baseY + BASE_GROUND_OFFSET, 'buildings', frame)
          .setDisplaySize(216, 249)
          .setOrigin(0.5, buildingOrigins.buildings[frame])
          .setDepth(baseY + BASE_GROUND_OFFSET)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => current.current.onSelect({ kind: 'base', side }));
        for (const { slot } of battlefieldLayout(current.current.session.battlefield).plots[side]) {
          const { x, y } = buildingPosition(side, slot);
          this.buildingShadows[side][slot] = this.add
            .image(x, y + BUILDING_GROUND_OFFSET, 'contact-shadow')
            .setDisplaySize(102, 26)
            .setDepth(5)
            .setVisible(false);
          const image = this.add
            .image(x, y + BUILDING_GROUND_OFFSET, 'buildings', 0)
            .setDisplaySize(92, 108)
            .setOrigin(0.5, buildingOrigins.buildings[0])
            .setDepth(y + 24)
            .setVisible(false);
          this.buildings[side][slot] = image;
          this.add
            .zone(x, y - 12, 110, 95)
            .setDepth(y + 25)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => current.current.onSelect({ kind: 'plot', side, slot }));
        }
      }
      this.groundIndicators = this.add.graphics().setDepth(4);
      this.effects = this.add.graphics().setDepth(1000);
      this.unitRenderer = new UnitRenderer(
        this,
        this.feedback,
        this.groundIndicators,
        this.effects,
        current,
        this.reducedMotion,
        this.heroBirths,
        this.pendingDamage,
      );
      const dot = this.make.graphics({ x: 0, y: 0 });
      dot.fillStyle(0xffffff).fillCircle(4, 4, 4).generateTexture('particle-dot', 8, 8);
      dot.destroy();
      this.time.delayedCall(0, updateMapView);
      this.game.events.once(Phaser.Core.Events.POST_RENDER, environment.onSceneReady);
    }
    update(_time: number, delta: number) {
      const { session: active } = current.current;
      for (const [slot, request] of current.current.upgradeFeedback) {
        if (request.session !== active || performance.now() - request.createdAt > 5000) {
          current.current.upgradeFeedback.delete(slot);
          continue;
        }
        const building = active
          .getState()
          .players[active.side].buildings.find((item) => item.slot === slot);
        if (building?.upgrading && building.level === request.level) {
          this.feedback.spending(request.x, request.y, request.cost);
          current.current.upgradeFeedback.delete(slot);
        }
      }
      if (this.activeSession !== active) {
        for (const timer of this.combatTimers) timer.remove();
        this.combatTimers.clear();
        this.pendingDamage.clear();
        this.unitRenderer.clear();
        this.heroBirths.clear();
        for (const worker of this.workers.values()) {
          worker.sprite.destroy();
          worker.shadow.destroy();
        }
        this.workers.clear();

        this.processedHits.clear();
        this.processedPowers.clear();
        this.levels.clear();
        this.activeConstruction.clear();
        this.cycles.clear();
        this.baseProduction.clear();
        this.activeSession = active;
        const home = homeCamera(active.side, view.worldZoom, active.side, active.battlefield);
        this.cameraPosition = { x: home.x, y: home.y };
      }
      const camera = this.cameras.main;
      if (Math.abs(view.worldZoom - current.current.zoom) > 0.0001) {
        this.cameraPosition = zoomAround(
          this.cameraPosition,
          view.worldZoom,
          current.current.zoom,
          this.zoomAnchor,
        );
        this.zoomAnchor = undefined;
        view.worldZoom = current.current.zoom;
        camera.setZoom(view.renderScale * view.worldZoom);
        updateMapView();
      }
      const viewWidth = VIEW_WIDTH / view.worldZoom,
        viewHeight = VIEW_HEIGHT / view.worldZoom;
      const target = current.current.cameraTarget;
      if (target && target.serial !== this.cameraSerial) {
        this.cameraSerial = target.serial;
        this.cameraPosition = { x: target.x - viewWidth / 2, y: target.y - viewHeight / 2 };
      }
      if (this.keys.has('Home') || this.keys.has(' ')) {
        const home = homeCamera(active.side, view.worldZoom, active.side, active.battlefield);
        this.cameraPosition = { x: home.x, y: home.y };
      }
      if (!document.querySelector('[role="dialog"]')) {
        const bounds = host.current!.getBoundingClientRect(),
          edge = 20;
        let dx = Number(this.keys.has('ArrowRight')) - Number(this.keys.has('ArrowLeft'));
        let dy = Number(this.keys.has('ArrowDown')) - Number(this.keys.has('ArrowUp'));
        if (this.pointer.inside && !this.pointer.drag && this.time.now - this.lastWheelTime > 300) {
          dx += Number(this.pointer.x > bounds.width - edge) - Number(this.pointer.x < edge);
          dy += Number(this.pointer.y > bounds.height - edge) - Number(this.pointer.y < edge);
        }
        const length = Math.max(1, Math.hypot(dx, dy));
        const speed = (650 * Math.min(delta, 50)) / 1000;
        this.cameraPosition.x += (dx / length) * speed;
        this.cameraPosition.y += (dy / length) * speed;
      }
      const canvasBounds = host.current!.querySelector('canvas')!.getBoundingClientRect();
      const hostBounds = host.current!.getBoundingClientRect();
      const visibleWidth = Math.min(
        viewWidth,
        hostBounds.width / ((canvasBounds.width / VIEW_WIDTH) * view.worldZoom),
      );
      const visibleHeight = Math.min(
        viewHeight,
        hostBounds.height / ((canvasBounds.height / VIEW_HEIGHT) * view.worldZoom),
      );
      const constrained = cameraAt(
        this.cameraPosition.x + viewWidth / 2,
        this.cameraPosition.y + viewHeight / 2,
        visibleWidth,
        visibleHeight,
      );
      this.cameraPosition = {
        x: constrained.x - (viewWidth - visibleWidth) / 2,
        y: constrained.y - (viewHeight - visibleHeight) / 2,
      };
      camera.centerOn(
        this.cameraPosition.x + camera.width / camera.zoomX / 2,
        this.cameraPosition.y + camera.height / camera.zoomY / 2,
      );
      scroll.current = { ...this.cameraPosition };
      // Move native map controls in the same frame as Phaser, outside React's render cycle.
      this.cameraClock += delta;
      if (this.cameraClock >= 50) {
        this.cameraClock = 0;
        const canvas = host.current!.querySelector('canvas')!.getBoundingClientRect(),
          bounds = host.current!.getBoundingClientRect();
        const scale = (canvas.width / VIEW_WIDTH) * view.worldZoom;
        current.current.onCameraChange({
          x: this.cameraPosition.x + Math.max(0, bounds.left - canvas.left) / scale,
          y: this.cameraPosition.y + Math.max(0, bounds.top - canvas.top) / scale,
          width: Math.min(viewWidth, bounds.width / scale),
          height: Math.min(viewHeight, bounds.height / scale),
        });
      }
      const game = active.getState();
      const recentHits = new Set(game.hits.map((hit) => hit.id));
      for (const id of this.processedHits) if (!recentHits.has(id)) this.processedHits.delete(id);
      for (const hit of game.hits) {
        if (this.processedHits.has(hit.id)) continue;
        this.processedHits.add(hit.id);
        if (game.time - hit.time < 0.5) this.showAttack(hit);
      }
      const powerIds = new Set((game.powers ?? []).map((power) => power.id));
      for (const id of this.processedPowers) if (!powerIds.has(id)) this.processedPowers.delete(id);
      for (const power of game.powers ?? [])
        if (!this.processedPowers.has(power.id)) {
          this.processedPowers.add(power.id);
          if (game.time - power.time < 1) {
            gameAudio.play('globalPower');
            if (!power.kind || power.kind === 'bills')
              playGlobalPower(
                this,
                power.targets.map((target) => ({
                  x: laneX(target.x),
                  y: laneY(target.row, target.x) - unitVisualHeight(target.kind) * 0.4,
                })),
                view.renderScale,
                (x, y) => this.feedback.bloodBurst(x, y, 1),
              );
            else {
              playStatusPower(this, power, view.renderScale, active.side, active.battlefield);
              if (power.kind === 'sabotage') {
                const victim = opposite(power.side);
                const remaining = game.players[victim].workers;
                for (let index = remaining; index < remaining + (power.workerLoss ?? 0); index++) {
                  const { x, y } = workerPose(
                    victim,
                    index,
                    power.time,
                    active.side,
                    active.battlefield,
                  );
                  this.feedback.bloodBurst(x, y - 12, 1);
                }
              }
              if (power.kind === 'recall')
                for (const target of power.targets) {
                  const visual = this.unitRenderer.get(target.id);
                  if (visual) {
                    visual.x = laneX(recallPosition(target.x, visual.side));
                    visual.sprite.x = visual.x;
                  }
                }
            }
          }
        }

      this.effects.clear();
      this.groundIndicators.clear();
      const selected = current.current.selection;
      for (const side of ['left', 'right'] as const) {
        const p = game.players[side];
        const { x: baseX, y: baseY } = basePosition(side);
        if (selected?.kind === 'base' && selected.side === side)
          this.groundIndicators
            .lineStyle(1.5, 0xd8ee99)
            .strokeEllipse(baseX, baseY + BASE_GROUND_OFFSET + 1, 224, 48);
        const healthY = baseY - BASE_HEALTH_Y_OFFSET;
        this.effects.fillStyle(0x101c14, 0.95).fillRect(baseX - 68, healthY, 136, 10);
        this.effects
          .fillStyle(healthColor(p.baseHp / maxBaseHp(p)))
          .fillRect(baseX - 67, healthY + 1, (134 * p.baseHp) / maxBaseHp(p), 8);
        this.effects.lineStyle(1, 0xe5e2bf, 0.9).strokeRect(baseX - 68, healthY, 136, 10);
        const previousProduction = this.baseProduction.get(side);
        if (
          previousProduction &&
          (p.workers > previousProduction.workers ||
            (p.heroBirthSerial ?? 0) > previousProduction.heroBirthSerial)
        ) {
          if ((p.heroBirthSerial ?? 0) > previousProduction.heroBirthSerial)
            this.heroBirths.add(side);
          this.feedback.dustBurst(baseX, baseY + 20);
          this.feedback.cycleFeedback(
            baseX,
            baseY,
            p.workers > previousProduction.workers ? '+1 trabalhador' : '+1 herói',
            false,
            side === active.side,
          );
        }
        this.baseProduction.set(side, {
          workers: p.workers,
          heroBirthSerial: p.heroBirthSerial ?? 0,
        });
        const order = p.trainingQueue?.[0];
        if (order)
          this.drawProductionProgress(
            baseX,
            baseY - 134,
            136,
            order.progress / trainingDuration(order),
          );
        for (const { slot } of battlefieldLayout(current.current.session.battlefield).plots[side]) {
          const { x, y } = buildingPosition(side, slot);
          const building = p.buildings.find((b) => b.slot === slot);
          const image = this.buildings[side][slot];
          image.setVisible(Boolean(building));
          this.buildingShadows[side][slot].setVisible(Boolean(building));
          if (building) {
            const key = `${side}-${slot}`;
            const ready = isBuildingReady(building);
            const art = buildingArt(building.kind, side, building.level),
              texture = !ready ? 'construction' : art.texture,
              frame = !ready
                ? constructionFrame(building.constructionProgress, game.time)
                : art.frame;
            const { width, height } = buildingDisplaySize(texture);
            if (selected?.kind === 'plot' && selected.side === side && selected.slot === slot)
              this.groundIndicators
                .lineStyle(1.5, 0xd8ee99)
                .strokeEllipse(x, y + BUILDING_GROUND_OFFSET + 1, width + 12, 26);
            if (image.texture.key !== texture) {
              this.tweens.killTweensOf(image);
              image.setTexture(texture, frame).setDisplaySize(width, height).clearTint();
              image.setData({ skinWidth: width, skinHeight: height });
            } else if (Number(image.frame.name) !== frame) image.setFrame(frame);
            image.setOrigin(0.5, buildingOrigins[texture][frame]);
            const spec = currentProduction(building);
            if (ready) {
              const roof =
                y +
                BUILDING_GROUND_OFFSET -
                height * (buildingOrigins[texture][frame] - buildingTops[texture][frame]);
              const revival = p.heroRevivals?.find((job) => job.slot === slot);
              if (revival)
                this.drawProductionProgress(x, roof - 7, 72, revival.progress / revival.duration);
              if (spec && !revival && !p.researchJobs?.some((job) => job.slot === slot))
                this.drawProductionProgress(x, roof - 7, 72, building.progress / spec.duration);
              const medic = building.medicQueue?.[0];
              if (medic)
                this.drawProductionProgress(x, roof - 7, 72, medic.progress / MEDIC.duration);
              const event = building.promotionQueue?.[0];
              if (event)
                this.drawProductionProgress(
                  x,
                  roof - 7,
                  72,
                  event.progress / PROMOTION_OFFERS[event.kind].duration,
                );
              if (isResearchBuilding(building.kind)) {
                const research = p.researchJobs?.find((job) => job.slot === slot);
                if (research)
                  this.drawProductionProgress(
                    x,
                    roof - 7,
                    72,
                    research.progress / research.duration,
                    0xbc86f5,
                  );
              }
            }
            if (!ready) this.activeConstruction.add(key);
            else if (this.activeConstruction.delete(key)) {
              this.feedback.upgradeBurst(x, y, image);
              if (side === active.side) gameAudio.play('complete');
            }
            const cycles = building.completedCycles ?? 0;
            const previousCycles = this.cycles.get(key);
            if (ready && previousCycles !== undefined && cycles > previousCycles)
              this.feedback.productionBurst(
                x,
                y,
                image,
                (building.lastYield ?? 0) > 0
                  ? `+${Math.round(building.lastYield!)} POP`
                  : isResearchBuilding(building.kind)
                    ? 'Pesquisa concluída'
                    : building.kind === 'hospital'
                      ? '+1 unidade'
                      : '+1 tropa',
                (building.lastYield ?? 0) > 0,
                side === active.side && !spec?.kind,
              );
            this.cycles.set(key, cycles);
            const previousLevel = this.levels.get(key);
            if (previousLevel && building.level > previousLevel)
              this.feedback.upgradeBurst(x, y, image);
            this.levels.set(key, building.level);
          }
        }
        for (let index = p.workers; this.workers.has(`${side}-${index}`); index++) {
          const key = `${side}-${index}`;
          const worker = this.workers.get(key)!;
          worker.sprite.destroy();
          worker.shadow.destroy();
          this.workers.delete(key);
        }
        for (let index = 0; index < p.workers; index++) {
          const key = `${side}-${index}`,
            pose = workerPose(side, index, game.time, active.side, active.battlefield);
          let worker = this.workers.get(key);
          if (!worker) {
            const sprite = this.add
              .sprite(pose.x, pose.y, 'workers', side === 'left' ? 0 : 4)
              .setDisplaySize((480 / 512) * 38.5, 38.5)
              .setOrigin(0.5, workerOrigins[side === 'left' ? 0 : 4])
              .setInteractive({ useHandCursor: true })
              .on('pointerdown', () => current.current.onSelect({ kind: 'worker', side, index }));
            sprite.on('animationupdate', () =>
              sprite.setOrigin(0.5, workerOrigins[Number(sprite.frame.name)] ?? 0.96),
            );
            const shadow = this.add
              .image(pose.x, pose.y, 'contact-shadow')
              .setDisplaySize(24, 7)
              .setDepth(5);
            worker = { sprite, shadow };
            this.workers.set(key, worker);
          }

          worker.sprite.setPosition(pose.x, pose.y).setDepth(pose.y).setFlipX(pose.flipX);
          worker.shadow.setPosition(pose.x, pose.y + 1);
          if (selected?.kind === 'worker' && selected.side === side && selected.index === index)
            this.groundIndicators.lineStyle(1.5, 0xd8ee99).strokeEllipse(pose.x, pose.y + 1, 28, 9);
          if (pose.walking && game.status === 'playing')
            worker.sprite.play(`worker-${side}-walk`, true);
          else worker.sprite.stop().setFrame(side === 'left' ? 0 : 4);
        }
      }
      this.unitRenderer.sync(game, delta);
    }
    drawProductionProgress(
      x: number,
      y: number,
      width: number,
      progress: number,
      color = 0xf4cd70,
    ) {
      const fraction = Math.max(0, Math.min(1, progress));
      this.effects.fillStyle(0x142316, 0.9).fillRect(x - width / 2, y, width, 5);
      this.effects.fillStyle(color).fillRect(x - width / 2 + 1, y + 1, (width - 2) * fraction, 3);
    }

    showAttack(hit: CombatEvent) {
      const attacker = this.unitRenderer.get(hit.sourceId);
      if (attacker)
        attacker.sprite.play(
          animationKey(attacker.side, attacker.kind, 'attack', attacker.hero, attacker.tier),
        );
      const structure = hit.sourceType === 'base' || hit.sourceType === 'building';
      const origin =
        hit.sourceType === 'base'
          ? basePosition(hit.side)
          : hit.sourceType === 'building' && hit.sourceSlot !== undefined
            ? buildingPosition(hit.side, hit.sourceSlot)
            : null;
      const sx = origin ? origin.x : laneX(hit.sourceX);
      const sy = origin
        ? origin.y - (hit.sourceType === 'base' ? 85 : 40)
        : laneY(hit.sourceRow, hit.sourceX) -
          unitVisualHeight(attacker?.kind ?? 'ranged', attacker?.level, attacker?.tier) * 0.4;
      const tx = laneX(hit.targetX);
      const victim = this.unitRenderer.get(hit.targetId),
        victimKind = victim?.kind ?? 'front';
      const ty =
        laneY(hit.targetRow, hit.targetX) -
        unitVisualHeight(victimKind, victim?.level, victim?.tier) * 0.4;
      const damage = hit.damage * (victim?.damageTaken ?? 1);
      this.pendingDamage.add(hit.targetId, damage);
      const session = this.activeSession;
      const impact = () => {
        if (this.activeSession !== session) return;
        this.pendingDamage.resolve(hit.targetId, damage);
        if (hit.targetId !== 0)
          this.feedback.bloodBurst(tx, ty, hit.side === current.current.session.side ? 1 : -1);
        else this.feedback.dustBurst(tx, ty);
        const victim = this.unitRenderer.get(hit.targetId);
        if (victim && !this.reducedMotion) {
          victim.sprite.setTint(0xffd2bc);
          this.time.delayedCall(85, () => {
            if (victim.sprite.active) victim.sprite.clearTint();
          });
        }
      };
      const release = () => {
        if (this.activeSession !== session) return;
        gameAudio.play(hit.kind === 'melee' ? 'melee' : 'ranged');
        if (hit.kind === 'melee') {
          impact();
          const burst = this.add.graphics().setDepth(1200);
          const points: Phaser.Math.Vector2[] = [];
          for (let i = 0; i < 20; i++) {
            const angle = (i / 20) * Math.PI * 2;
            const radius = i % 2 === 0 ? 24 : 13;
            points.push(
              new Phaser.Math.Vector2(
                Math.cos(angle) * radius * 1.3,
                Math.sin(angle) * radius * 0.8,
              ),
            );
          }
          burst
            .fillStyle(0xffde68)
            .lineStyle(2, 0x483424)
            .fillPoints(points, true)
            .strokePoints(points, true);
          const text = this.add
            .text(0, -1, hit.id % 3 === 0 ? 'BAM!' : 'POW!', {
              resolution: view.renderScale,
              fontFamily: 'Arial Black, Arial',
              fontSize: '14px',
              fontStyle: 'bold italic',
              color: '#a13a26',
              stroke: '#fff0ad',
              strokeThickness: 2,
            })
            .setOrigin(0.5);
          const punch = this.add
            .container(tx, ty - 6, [burst, text])
            .setDepth(1200)
            .setAngle(hit.id % 2 === 0 ? -12 : 10)
            .setScale(0.3);
          this.tweens.add({
            targets: punch,
            scaleX: 0.75,
            scaleY: 0.75,
            duration: 90,
            ease: 'Back.Out',
          });
          this.tweens.add({
            targets: punch,
            y: ty - 24,
            alpha: 0,
            delay: 140,
            duration: 220,
            onComplete: () => punch.destroy(true),
          });
        } else {
          const color = structure
            ? 0xffdf79
            : hit.kind === 'siege'
              ? 0xffb652
              : hit.side === 'left'
                ? 0xffe19a
                : 0xdefa9c;
          const trail = this.add
            .particles(sx, sy, 'particle-dot', {
              lifespan: hit.kind === 'siege' ? 230 : 130,
              frequency: 14,
              quantity: 1,
              speed: { min: 2, max: 12 },
              scale: { start: hit.kind === 'siege' ? 0.75 : 0.4, end: 0 },
              alpha: { start: 0.85, end: 0 },
              tint: color,
              blendMode: 'ADD',
            })
            .setDepth(1100);
          const bolt = this.add
            .image(sx, sy, 'particle-dot')
            .setTint(color)
            .setDisplaySize(
              structure ? 11 : hit.kind === 'siege' ? 12 : 8,
              structure ? 5 : hit.kind === 'siege' ? 9 : 3,
            )
            .setRotation(Math.atan2(ty - sy, tx - sx))
            .setDepth(1101);
          const duration = this.reducedMotion
            ? 60
            : Math.min(320, Math.max(140, Math.abs(tx - sx) * 1.8));
          this.tweens.add({
            targets: [trail, bolt],
            x: tx,
            y: ty,
            duration,
            ease: 'Linear',
            onComplete: () => {
              bolt.destroy();
              trail.stop();
              impact();
              this.time.delayedCall(260, () => trail.destroy());
            },
          });
        }
      };
      // The second attack frame is the contact / release pose (7 frames/s).
      // Structures have no wind-up animation.
      if (attacker) {
        const timer = this.time.delayedCall(ATTACK_RELEASE_MS, () => {
          this.combatTimers.delete(timer);
          release();
        });
        this.combatTimers.add(timer);
      } else release();
    }
  }
  return Battle;
}
