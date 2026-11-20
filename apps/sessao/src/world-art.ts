import type Phaser from 'phaser';
import { federalPatrolRules, federalPatrolSheets, federalBreachArt } from './federal-patrol';
import { visitorRoster, visitorSheets } from './visitors';
import {
  characterArt,
  characterSheets,
  combatSheets,
  downedArt,
  hitArt,
  attackArt,
  phoneArt,
  phoneSheets,
  safeBreachArt,
  safeBreachSheets,
  safeDepositArt,
  safeDepositSheets,
  npcRobberyArt,
  npcRobberySheets,
} from './character-art';
import { NAMES, HEIGHT, sprintMultiplier, type Player } from './map';
import { weaponPose, weapons } from './weapons';
import { cashAmount, objects } from './gameplay';
import { equipment } from './equipment';
import { officeFurniture, officeFixtures, isOfficeFurniture, privateOffices, type OfficeView } from './private-offices';
import { installationArt } from './installations';
import { mapNpcs } from './npcs';
import { groundItemArt } from './map-props';
import type { Decoration } from './photography';

export const itemSymbols = {
  vip: '★',
  binoculars: equipment.binoculars.symbol,
  voiceModulator: equipment.voiceModulator.symbol,
  vest: equipment.vest.symbol,
} as Partial<Record<keyof typeof objects, string>>;
export const decorationLabel = (item: Decoration) =>
  item.kind === 'pizza'
    ? `Pizza · ${item.slices} fatias`
    : item.kind === 'portrait'
      ? `Retrato de ${item.owner.name}`
      : item.kind === 'vip'
        ? `VIP · ${item.owner.name}`
        : objects[item.kind].name;

export type ActorView = {
  speedIcon:Phaser.GameObjects.Graphics;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  office: Phaser.GameObjects.Text;
  items: Phaser.GameObjects.Container;
  itemsKey?: string;
  nextStep: number;
  lastHit?: number;
  flashUntil?: number;
  hitAt?: number;
  fallAt?: number;
  weapon: Phaser.GameObjects.Image;
  briefcase?: Phaser.GameObjects.Image;
  swingAt?: number;
  swingStarted?: number;
  depositStarted?: number;
  robberyStarted?: number;
};
// Grip coordinates in the original 128 px frames, ordered front, profile, back.
type Grip = readonly [x: number, y: number];
type WalkGrips = readonly [Grip, Grip, Grip, Grip];
const briefcaseGrip = {
  Lula: [[[85,101],[91,94],[85,101],[88,85]],[[57,102],[82,89],[57,102],[78,88]],[[38,100],[39,95],[38,100],[40,89]]],
  Bolsonaro: [[[83,103],[86,97],[83,103],[87,87]],[[57,104],[85,90],[57,104],[82,89]],[[41,103],[41,99],[41,103],[43,94]]],
  Clodovil: [[[90,101],[95,94],[90,101],[87,91]],[[56,103],[81,84],[56,103],[81,84]],[[34,101],[36,96],[34,101],[36,96]]],
  Tiririca: [[[85,104],[89,95],[85,104],[80,91]],[[58,103],[86,88],[58,103],[87,87]],[[41,105],[38,98],[41,105],[39,91]]],
  'Sikêra Jr.': [[[94,102],[95,92],[94,102],[84,95]],[[54,102],[85,87],[54,102],[86,87]],[[34,102],[35,94],[34,102],[36,94]]],
  'Alexandre Frota': [[[92,106],[94,92],[92,106],[87,91]],[[54,105],[83,85],[54,105],[83,85]],[[34,106],[34,96],[34,106],[34,96]]],
  'Sergio Moro': [[[85,106],[87,99],[85,106],[82,92]],[[55,105],[85,90],[55,105],[84,89]],[[43,106],[40,100],[43,106],[43,94]]],
  'Inês Brasil': [[[94,100],[98,95],[94,100],[92,89]],[[65,100],[89,79],[65,100],[89,79]],[[38,101],[32,94],[38,101],[32,94]]],
} satisfies Record<(typeof NAMES)[number],readonly [WalkGrips,WalkGrips,WalkGrips]>;

export function preloadWorldArt(scene: Phaser.Scene) {
  for (const { texture, sprite } of Object.values(installationArt)) {
    scene.load.image(texture, import.meta.env.BASE_URL + 'assets/' + sprite);
  }
  scene.load.image('cash-briefcase', import.meta.env.BASE_URL + 'assets/maleta-social.png');
  for (const [key, weapon] of Object.entries(weapons)) {
    scene.load.image(`weapon-${key}`, import.meta.env.BASE_URL + 'assets/' + weapon.sprite);
  }
  for (const { key, path } of [
    ...characterSheets,
    ...visitorSheets,
    ...federalPatrolSheets,
    ...combatSheets,
    ...phoneSheets,
    ...safeBreachSheets,
    ...safeDepositSheets,
    ...npcRobberySheets,
  ])
    scene.load.spritesheet(key, import.meta.env.BASE_URL + path, { frameWidth: 128, frameHeight: 128 });
  for (const [id, npc] of Object.entries(mapNpcs)) {
    scene.load.image(`npc-${id}`, import.meta.env.BASE_URL + 'assets/' + npc.sprite);
  }
  for (const [kind, { sprite }] of Object.entries(officeFurniture)) {
    scene.load.image(`furniture-${kind}`, import.meta.env.BASE_URL + 'assets/' + sprite);
  }
  for (const [kind, { portrait }] of Object.entries(objects)) {
    scene.load.image(`item-${kind}`, `${import.meta.env.BASE_URL}assets/${portrait}`);
  }
  scene.load.spritesheet('installed-portraits', `${import.meta.env.BASE_URL}assets/retratos-elenco.webp`, {
    frameWidth: 256,
    frameHeight: 256,
  });
  scene.load.image(officeFixtures.safe.openTexture, `${import.meta.env.BASE_URL}assets/gabinete-cofre-aberto.webp`);
  scene.load.image(officeFixtures.safe.texture, `${import.meta.env.BASE_URL}assets/gabinete-cofre.webp`);
  scene.load.image(officeFixtures.cabinet.texture, `${import.meta.env.BASE_URL}assets/gabinete-armario.webp`);
  scene.load.image('infirmary-stretcher', import.meta.env.BASE_URL + 'assets/' + 'maca-enfermaria.webp');
  scene.load.image('technical-shelf', import.meta.env.BASE_URL + 'assets/' + 'estante-apoio-tecnico.webp');
  scene.load.image('snack-counter', import.meta.env.BASE_URL + 'assets/' + 'balcao-lanchonete.webp');
  scene.load.image('coffee-maker', import.meta.env.BASE_URL + 'assets/cafeteira.webp');
  scene.load.image('security-terminal', import.meta.env.BASE_URL + 'assets/terminal-seguranca.webp');
  scene.load.image('power-panel', import.meta.env.BASE_URL + 'assets/painel-eletrico.webp');
  scene.load.spritesheet('office', import.meta.env.BASE_URL + 'assets/office-hd.png', { frameWidth: 192, frameHeight: 112 });
}

export function createWorldAnimations(scene: Phaser.Scene) {
  for (let character = 0; character < NAMES.length; character++) {
    const { sheet, frame } = characterArt(character);
    for (let direction = 0; direction < 3; direction++) {
      const start = frame + direction * 4;
      const frames = Array.from({ length: 4 }, (_, step) => ({ key: sheet.key, frame: start + step }));
      scene.anims.create({ key: `${character}-${direction}`, frames, frameRate: 9, repeat: -1 });
    }
  }
  for (const { id } of [...visitorRoster, { id: federalPatrolRules.skin }])
    for (let direction = 0; direction < 3; direction++) {
      scene.anims.create({
        key: `${id}-${direction}`,
        frames: Array.from({ length: 4 }, (_, step) => ({ key: `${id}-walk`, frame: direction * 4 + step })),
        frameRate: 9,
        repeat: -1,
      });
    }
}

export function createActorView(scene: Phaser.Scene, player: Player, resolution = 3): ActorView {
  const { sheet, frame } = characterArt(player.character, player.visitor);
  return {
    speedIcon:scene.add.graphics().fillStyle(0xffdc73,1).lineStyle(.7,0x20322e,1)
      .beginPath().moveTo(-3.5,-2.5).lineTo(-1.8,-2.5).lineTo(.2,0)
      .lineTo(-1.8,2.5).lineTo(-3.5,2.5).lineTo(-1.5,0).closePath().fillPath().strokePath()
      .beginPath().moveTo(.2,-2.5).lineTo(1.9,-2.5).lineTo(3.9,0)
      .lineTo(1.9,2.5).lineTo(.2,2.5).lineTo(2.2,0).closePath().fillPath().strokePath()
      .setScale(.75).setDepth(HEIGHT+30).setVisible(false),
    nextStep: 0,
    weapon: scene.add.image(0, 0, 'weapon-baton').setVisible(false),
    items: scene.add.container().setDepth(HEIGHT + 26),
    sprite: scene.add.sprite(player.x, player.y, sheet.key, frame).setOrigin(0.5, 1).setScale(0.295),
    label: scene.add
      .text(player.x, player.y + 2, '', {
        fontFamily: 'system-ui',
        fontSize: '5.5px',
        fontStyle: 'bold',
        color: '#fff7df',
        stroke: '#20322e',
        strokeThickness: 1.1,
        resolution: resolution,
      })
      .setOrigin(0.5, 0)
      .setDepth(HEIGHT + 30),
    office: scene.add
      .text(player.x, player.y + 10, '', {
        fontFamily: 'system-ui',
        fontSize: '4px',
        fontStyle: 'bold',
        stroke: '#152522',
        strokeThickness: 0.85,
        resolution: resolution,
      })
      .setOrigin(0.5, 0)
      .setDepth(HEIGHT + 30),
  };
}

export function updateActorView(
  scene: Phaser.Scene,
  view: ActorView,
  latest: Player,
  x: number,
  y: number,
  moving: boolean,
  time: number,
  options: { reducedMotion?: boolean; concealed?: boolean; showStatus?: boolean; frozen?: boolean } = {},
) {
  const { sprite, label, office } = view;
  const { character, direction, visitor } = latest;
  const { sheet, frame } = characterArt(character, visitor);
  const reducedMotion = options.reducedMotion ?? false;
  const swing = latest.swing;
  if (swing && swing.startedAt !== view.swingAt) {
    view.swingAt = swing.startedAt;
    view.swingStarted = options.frozen ? swing.startedAt : time;
  }
  const profile = swing && weapons[swing.weapon];
  const progress = profile && view.swingStarted !== undefined ? (time - view.swingStarted) / profile.swingMs : 1;
  const pose = swing && progress < 1 && !latest.knockedOut ? weaponPose(swing, progress) : undefined;
  const handling = !moving && !latest.knockedOut && !latest.carried ? latest.handlingObject : undefined;
  const facing = pose?.facing ?? handling ?? direction;
  const reach = handling !== undefined && !reducedMotion ? (1 + Math.sin(time / 95)) * 0.5 : 0;
  const row = facing === 3 ? 1 : facing;
  const attack = pose && profile ? attackArt(character, row, progress, profile.impactMs / profile.swingMs) : undefined;
  const downed =
    latest.knockedOut || latest.carried ? downedArt(character, direction, time - (view.fallAt ?? -Infinity), visitor) : undefined;
  if (!downed) view.fallAt = undefined;
  const recoil = view.hitAt === undefined ? undefined : hitArt(character, direction, time - view.hitAt, visitor);
  const combatArt = downed ?? recoil ?? attack;
  const breachArt =
    latest.breachingDoor && visitor === federalPatrolRules.skin
      ? federalBreachArt(facing, time, reducedMotion)
      : latest.breachingSafe && !combatArt && !pose && !latest.carrying
        ? safeBreachArt(character, time, reducedMotion)
        : undefined;
  const depositing = latest.pocketing && !moving && !combatArt && !pose && !latest.carrying;
  if (depositing) view.depositStarted ??= options.frozen ? 0 : time;
  else view.depositStarted = undefined;
  const depositArt = depositing ? safeDepositArt(character, time - (view.depositStarted ?? time), reducedMotion) : undefined;
  const robberyTarget = latest.robberyTarget;
  const robbing = robberyTarget && !moving && !combatArt && !pose && !latest.carrying;
  if (robbing) view.robberyStarted ??= options.frozen ? 0 : time;
  else view.robberyStarted = undefined;
  const robberyArt = robbing
    ? npcRobberyArt(character, time - (view.robberyStarted ?? time), reducedMotion, latest, robberyTarget)
    : undefined;
  const phone = latest.phone;
  const usingPhone =
    !robberyArt &&
    !depositArt &&
    !breachArt &&
    (phone === 'open' || phone === 'game') &&
    !latest.moving &&
    handling === undefined &&
    !combatArt &&
    !pose &&
    !latest.carrying;
  const handsetArt = usingPhone ? phoneArt(character, time, reducedMotion) : undefined;
  const spriteX = x + (pose?.lungeX ?? (handling === 1 ? reach : handling === 3 ? -reach : 0));
  const spriteY = latest.carried ? y - 24 : y + (pose?.lungeY ?? -reach);
  const labelY = latest.carried ? y - 51 : y + 2;
  const opacity =
    latest.knockedOut && !latest.carried
      ? 0.68
      : latest.recoveryProtected && (reducedMotion || Math.floor(time / 150) % 2 === 0)
        ? 0.4
        : 1;
  sprite
    .setOrigin(0.5, downed?.originY ?? 1)
    .setRotation(downed?.rotation ?? (recoil ? 0 : (pose?.lean ?? reach * (handling === 3 ? -0.05 : 0.05))))
    .setAlpha(opacity);
  const spriteDepth = y + (latest.carried ? 1 : 0);
  if (sprite.depth !== spriteDepth) sprite.setDepth(spriteDepth);
  sprite
    .setVisible(true)
    .setPosition(spriteX, spriteY)
    .setFlipX(downed?.flipX ?? recoil?.flipX ?? robberyArt?.flipX ?? (!handsetArt && !breachArt && !depositArt && facing === 3));
  view.weapon.setVisible(!!pose);
  if (pose && swing && profile) {
    view.weapon
      .setTexture(`weapon-${swing.weapon}`)
      .setOrigin(profile.grip, 0.5)
      .setScale(profile.size / view.weapon.width)
      .setPosition(x + pose.handX, y + pose.handY)
      .setRotation(pose.angle)
      .setDepth(y + (facing === 2 ? -0.1 : 0.1));
  }
  view.speedIcon.setVisible((latest.speedModifier?.factor ?? 1)>1 && (latest.speedModifier?.remainingMs ?? 0)>0)
    .setPosition(x,spriteY-43);
  const name = latest.nick;
  label
    .setVisible(true)
    .setPosition(x, labelY)
    .setText(latest.pocketing ? `▣ ${name}` : phone === 'game' ? `🎮 ${name}` : phone === 'call' ? `☎ ${name}` : name);
  const nameColor = latest.npc ? '#b8c0bf' : latest.knockedOut ? '#ffbf9f' : '#fff7df';
  // Phaser redraws and uploads the text texture on every setColor call.
  if (label.style.color !== nameColor) label.setColor(nameColor);
  const handsBusy = !!(handsetArt || breachArt || depositArt || robberyArt);
  const grip = briefcaseGrip[NAMES[character]]?.[breachArt ? 2 : handsetArt ? 0 : row];
  const exposed = grip ? (latest.exposed ?? []).filter((item) => !cashAmount(item.kind)) : (latest.exposed ?? []);
  const concealed = options.concealed ?? false;
  const itemsKey = `${concealed}:${exposed.map((item) => item.kind).join(',')}`;
  if (view.itemsKey !== itemsKey) {
    view.itemsKey = itemsKey;
    view.items.removeAll(true);
    exposed.forEach(({ kind }, index) => {
      const offset = (index - (exposed.length - 1) / 2) * 13;
      const backdrop = scene.add.rectangle(offset, 0, 11.5, 11.5, 0x10211b, 0.84).setStrokeStyle(0.5, 0x637f6d);
      const icon = scene.add.image(offset, 0, `item-${kind}`).setDisplaySize(10, 10);
      if (concealed && cashAmount(kind)) {
        backdrop.setAlpha(0.38);
        icon.setAlpha(0.38);
      }
      view.items.add([backdrop, icon]);
    });
  }
  view.items
    .setPosition(x, latest.carried ? spriteY - 12 : latest.knockedOut ? y - 12 : spriteY - 44)
    .setVisible(!!exposed.length);
  const status = latest.carried
    ? 'Em transporte'
    : latest.carrying
      ? 'Carregando'
      : latest.knockedOut
        ? 'Nocauteado'
        : latest.former
          ? 'Ex-parlamentar'
          : '';
  office
    .setVisible(!!status && (options.showStatus ?? true))
    .setPosition(x, labelY + 6)
    .setText(status);
  const officeColor = latest.former ? '#e6a38c' : '#cbd6db';
  if (office.style.color !== officeColor) office.setColor(officeColor);
  if (moving && !pose && !combatArt && !breachArt && !depositArt && !robberyArt) {
    sprite.play(`${visitor ?? character}-${row}`, true);
    sprite.anims.timeScale = latest.sprinting ? sprintMultiplier : 1;
  } else {
    sprite.anims.stop();
    const art = combatArt ?? robberyArt ?? depositArt ?? breachArt ?? handsetArt;
    sprite.setTexture(art?.key ?? sheet.key, art?.frame ?? frame + row * 4);
  }
  if (options.frozen && moving && !pose && !combatArt && !breachArt && !depositArt && !robberyArt) {
    sprite.anims.stop();
    sprite.setTexture(sheet.key, frame + row * 4 + (Math.floor((time * 9) / 1000) % 4));
  }
  if (grip && latest.cashInHand && !pose && !combatArt && !depositArt && !robberyArt) {
    const walkFrame = !handsBusy && typeof sprite.frame.name === 'number' ? sprite.frame.name % 4 : 0;
    const [handX, handY] = grip[walkFrame];
    const briefcase = (view.briefcase ??= scene.add.image(0, 0, 'cash-briefcase').setScale(12 / 128));
    const side = sprite.flipX ? -1 : 1;
    briefcase
      .setOrigin(0.5, breachArt ? 1 : 0.12)
      .setPosition(spriteX + (handX - 64) * sprite.scaleX * side, breachArt ? y : spriteY + (handY - 128) * sprite.scaleY)
      .setFlipX(sprite.flipX)
      .setAlpha(concealed ? 0.38 * opacity : opacity)
      .setVisible(true)
      .setDepth(spriteDepth + 0.1);
  } else view.briefcase?.setVisible(false);
  return { spriteX, spriteY };
}

export function destroyActorView(view: ActorView) {
  for (const object of [view.sprite, view.label, view.office, view.items, view.weapon, view.speedIcon, view.briefcase]) object?.destroy();
}

export function createGroundArt(scene: Phaser.Scene, item: { kind: keyof typeof objects; x: number; y: number }) {
  const symbol = itemSymbols[item.kind];
  const icon = symbol
    ? scene.add.text(0, 0, symbol, { fontSize: '15px', color: '#ffe08a', resolution: 3 }).setOrigin(0.5, 0.8)
    : scene.add
        .image(0, 0, `item-${item.kind}`)
        .setOrigin(0.5, groundItemArt.anchor)
        .setDisplaySize(groundItemArt.size, groundItemArt.size);
  const shadow = scene.add.ellipse(0, 2, 15, 5, 0x09110e, 0.28);
  const marker = scene.add.container(item.x, item.y, [shadow, icon]).setDepth(item.y - 1);
  return { marker, icon };
}

export function createDecorationArt(scene: Phaser.Scene, item: Decoration, resolution = 3) {
  if (isOfficeFurniture(item.kind)) {
    const { width, height, anchor } = officeFurniture[item.kind];
    const art = scene.add.image(0, 0, `furniture-${item.kind}`).setDisplaySize(width, height).setOrigin(0.5, anchor);
    const marker = scene.add.container(item.x, item.y, [art]).setDepth(item.kind === 'officeRug' ? 0.5 : 2.5);
    return { marker, art };
  }
  const portrait = item.kind === 'portrait';
  const art = portrait
    ? scene.add.image(0, 0, 'installed-portraits', item.character).setDisplaySize(18, 18)
    : scene.add
        .image(0, item.kind === 'vip' ? -9 : 0, `item-${item.kind}`)
        .setDisplaySize(item.kind === 'vip' ? 13 : 26, item.kind === 'vip' ? 13 : 26);
  const label = scene.add
    .text(0, item.kind === 'vip' ? 5 : 13, decorationLabel(item), {
      fontSize: '5px',
      color: '#fff5df',
      backgroundColor: '#142820cc',
      padding: { x: 2, y: 1 },
      resolution: resolution,
    })
    .setOrigin(0.5, 0);
  const marker = scene.add.container(item.x, item.y).setDepth(item.y + 1);
  marker.add([art, label]);
  const mark = portrait
    ? scene.add.text(0, 0, '✗', { fontSize: '16px', color: '#ff7262', resolution: 3 }).setOrigin(0.5).setVisible(!!item.marked)
    : undefined;
  if (mark) marker.add(mark);
  return { marker, art, label, mark };
}

export function createInstallationFrame(scene: Phaser.Scene, point: { x: number; y: number }, kind: 'portrait' | 'vip') {
  const { texture, width, height, centerY } = installationArt[kind];
  return scene.add
    .image(point.x, point.y + centerY, texture)
    .setDisplaySize(width, height)
    .setDepth(point.y);
}

export function createMapNpc(scene: Phaser.Scene, id: string, npc: (typeof mapNpcs)[keyof typeof mapNpcs]) {
  const sprite = scene.add.sprite(npc.x, npc.y, `npc-${id}`).setOrigin(0.5, 1).setDisplaySize(38, 38).setDepth(npc.y);
  const label =
    id === 'treasurer' && 'counter' in npc
      ? scene.add
          .text(npc.x, npc.counter.y + 24, npc.name, {
            fontFamily: 'system-ui',
            fontSize: '7px',
            color: '#ffe4a1',
            backgroundColor: '#142820bb',
            padding: { x: 3, y: 1 },
            resolution: 3,
          })
          .setOrigin(0.5, 0)
          .setDepth(1)
      : undefined;
  return { sprite, label };
}

export function drawOfficeState(
  graphics: Phaser.GameObjects.Graphics,
  offices?: readonly Pick<OfficeView, 'id' | 'door' | 'cabinetBreached'>[],
) {
  graphics.clear();
  for (const layout of privateOffices) {
    const office = offices?.find((entry) => entry.id === layout.id);
    const [x, y, w, h] = layout.door;
    const status = office?.door ?? 'open';
    if (status !== 'open') {
      const vertical = h > w;
      const inset = vertical ? 1 : 3;
      const thickness = status === 'breached' ? 2 : (vertical ? w : h) - inset;
      graphics.fillStyle(status === 'breached' ? 0xb66243 : status === 'locked' ? 0x843d37 : 0x83623e, 1);
      if (vertical) graphics.fillRect(x + inset, y, thickness, h);
      else graphics.fillRect(x, y + inset, w, thickness);
    }
    if (office?.cabinetBreached)
      graphics.lineStyle(1, 0xee9169).strokeEllipse(layout.cabinet.x, layout.cabinet.y - 3, officeFixtures.cabinet.width + 4, 7);
  }
}
