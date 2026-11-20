import type Phaser from 'phaser';
import { PlayerHistory } from './network-movement';
import { drawMap, updateSafeArt } from './draw-map';
import {
  createActorView,
  updateActorView,
  destroyActorView,
  createGroundArt,
  createDecorationArt,
  createInstallationFrame,
  createMapNpc,
  drawOfficeState,
  type ActorView,
} from './world-art';
import { installationSites } from './installations';
import { decorPoint, depositingAtSafe, privateOffices, officeDoorPoint } from './private-offices';
import { mapNpcs, npcEnabled } from './npcs';
import type { PhotoScene } from './photography';
import type { Player } from './map';

// The map's visual rules are shared; callers control only framing and captured/live time.
export class WorldView {
  private actors = new Map<string, ActorView>();
  private scenery: Phaser.GameObjects.Container[] = [];
  private safes = new Map<string, Phaser.GameObjects.Image>();
  private terminal?: Phaser.GameObjects.Image;
  private barriers: Phaser.GameObjects.Graphics;
  private fixtures: { art: Phaser.GameObjects.Image }[] = [];
  private npcs: { id: string; sprite: Phaser.GameObjects.Sprite; label?: Phaser.GameObjects.Text }[] = [];
  private frame?: PhotoScene;
  private history = new PlayerHistory();

  constructor(private scene: Phaser.Scene) {
    drawMap(
      scene,
      (art, office, kind) => {
        if (kind === 'safe') this.safes.set(office.id, art);
      },
      (art) => {
        this.terminal = art;
      },
    );
    this.barriers = scene.add.graphics().setDepth(2);
    for (const { point, kind } of Object.values(installationSites))
      if (kind !== 'pizza') {
        this.fixtures.push({ art: createInstallationFrame(scene, point, kind) });
      }
    for (const office of privateOffices)
      this.fixtures.push({ art: createInstallationFrame(scene, decorPoint(office, 'portrait'), 'portrait') });
    for (const [id, npc] of Object.entries(mapNpcs)) this.npcs.push({ id, ...createMapNpc(scene, id, npc) });
  }

  render(frame: PhotoScene, time: number, frozen = false) {
    const { scene } = this;
    const features = frame.features;
    this.terminal?.setVisible(features?.surveillance !== false);
    for (const { art } of this.fixtures) art.setVisible(features?.portraitsAndVip !== false);
    for (const { id, sprite, label } of this.npcs) {
      const visible = npcEnabled(
        id,
        features?.projectVoting !== false,
        features?.decorations !== false,
        features?.portraitsAndVip !== false,
      );
      sprite.setVisible(visible);
      label?.setVisible(visible);
    }
    for (const office of privateOffices) {
      const art = this.safes.get(office.id);
      if (art) updateSafeArt(art, frame.openSafes ? frame.openSafes.includes(office.id) : depositingAtSafe(office, frame.people));
    }
    if (frame !== this.frame) {
      if (!frozen) {
        if (frame.camera?.x !== this.frame?.camera?.x || frame.camera?.y !== this.frame?.camera?.y) this.history.clear();
        this.history.add(
          frame.people.map((person) => ({
            ...person,
            nick: person.name,
            moving: !!person.moving,
            carried: person.carried ? true : undefined,
          })),
          performance.now(),
        );
      }
      const breached = (point: { x: number; y: number }) =>
        frame.breaches?.some((other) => Math.hypot(other.x - point.x, other.y - point.y) < 1);
      const offices =
        frame.offices ??
        privateOffices.map((office) => ({
          id: office.id,
          door: breached(officeDoorPoint(office)) ? ('breached' as const) : ('open' as const),
          cabinetBreached: breached(office.cabinet) ? (true as const) : undefined,
        }));
      drawOfficeState(this.barriers, offices);
      if (!frame.offices) {
        this.barriers.fillStyle(0x334e42);
        for (const rect of (frame.camera ?? frame.center).barriers ?? []) this.barriers.fillRect(...rect);
      }
      for (const object of this.scenery) object.destroy();
      this.scenery = frame.ground.map((item) => createGroundArt(scene, item).marker);
      for (const item of frame.decorations) this.scenery.push(createDecorationArt(scene, item, 4).marker);
      const ids = new Set(frame.people.map((person) => person.id));
      // Frozen frames must never inherit animation clocks or state from another picture.
      for (const [id, view] of this.actors)
        if (frozen || !ids.has(id)) {
          destroyActorView(view);
          this.actors.delete(id);
        }
      this.frame = frame;
    }
    for (const person of frame.people) {
      const player: Player = {
        ...person,
        nick: person.name,
        moving: !!person.moving,
        carried: person.carried ? true : undefined,
      };
      let view = this.actors.get(person.id);
      if (!view) {
        view = createActorView(scene, player, 4);
        this.actors.set(person.id, view);
      }
      const sampled = frozen ? player : (this.history.sample(performance.now(), player.id) ?? player);
      updateActorView(
        scene,
        view,
        { ...player, direction: sampled.direction, moving: sampled.moving },
        sampled.x,
        sampled.y,
        sampled.moving,
        time,
        { frozen },
      );
    }
  }
}
