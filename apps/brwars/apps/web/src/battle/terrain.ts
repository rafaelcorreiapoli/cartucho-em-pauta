import { battlefieldLayout, type BattlefieldKind } from '@brwars/simulation';
import type Phaser from 'phaser';
import { battlefieldBackgrounds } from '../battlefield-art';
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  MAP_MARGIN_X,
  MAP_MARGIN_Y,
  TERRAIN_WIDTH,
  TERRAIN_HEIGHT,
  mapPoint,
} from '../map-layout';

// 1024 source pixels per patch cover the renderer's maximum 4.8 pixels per world unit.
const groundTileSize = 200;
const pixelsPerWorldUnit = 4.8;
const props = {
  shrubs: { frame: 0, size: 92 },
  rocks: { frame: 1, size: 88 },
  tree: { frame: 2, size: 105 },
} as const;

export function preloadTerrain(scene: Phaser.Scene, kind: BattlefieldKind) {
  const background = battlefieldBackgrounds[kind];
  if (background) {
    scene.load.image('field', background);
    return;
  }
  for (const texture of ['north', 'south'] as const)
    scene.load.image(texture, `/assets/maps/${kind}-${texture}.webp`);
  for (const texture of ['ground', 'road'] as const)
    scene.load.image(texture, `/assets/maps/${kind}-tile-${texture}.webp`);
  scene.load.spritesheet('terrain-props', `/assets/maps/${kind}-tile-props.webp`, {
    frameWidth: 512,
    frameHeight: 512,
  });
  if (kind === 'reserva') scene.load.image('water', '/assets/maps/reserva-tile-water.webp');
}

// Reflect only the outer strips so the playable artwork keeps its original scale and alignment.
function fieldStrips(worldSize: number, margin: number, textureSize: number) {
  const strip = Math.round((margin / worldSize) * textureSize);
  return [
    { position: 0, size: margin, start: 0, length: strip, flip: true },
    { position: margin, size: worldSize, start: 0, length: textureSize, flip: false },
    {
      position: margin + worldSize,
      size: margin,
      start: textureSize - strip,
      length: strip,
      flip: true,
    },
  ];
}

function drawPaddedField(scene: Phaser.Scene) {
  const texture = scene.textures.get('field');
  const { width, height } = texture.getSourceImage();
  const columns = fieldStrips(TERRAIN_WIDTH, MAP_MARGIN_X, width);
  const rows = fieldStrips(TERRAIN_HEIGHT, MAP_MARGIN_Y, height);
  for (const [row, y] of rows.entries())
    for (const [column, x] of columns.entries()) {
      const frame = `field-${column}-${row}`;
      texture.add(frame, 0, x.start, y.start, x.length, y.length);
      scene.add
        .image(x.position + x.size / 2, y.position + y.size / 2, 'field', frame)
        .setDisplaySize(x.size, y.size)
        .setFlip(x.flip, y.flip);
    }
}

export function drawTerrain(scene: Phaser.Scene, kind: BattlefieldKind) {
  if (battlefieldBackgrounds[kind]) {
    drawPaddedField(scene);
    return;
  }

  for (let y = 0; y < MAP_HEIGHT; y += groundTileSize)
    for (let x = 0; x < MAP_WIDTH; x += groundTileSize)
      scene.add.image(x, y, 'ground').setOrigin(0).setDisplaySize(groundTileSize, groundTileSize);

  const layout = battlefieldLayout(kind);
  const road = mapPoint(layout.road);
  const roadX = road.x + road.width / 2;
  const roadY = road.y + road.height / 2;
  scene.add.image(roadX, roadY, 'road').setDisplaySize(road.width, road.height);

  for (const decoration of layout.decorations) {
    const { name, x, y } = mapPoint(decoration);
    if (name === 'water') {
      scene.add.image(x, y, 'water').setDisplaySize(104, 52);
      continue;
    }
    if (Object.hasOwn(props, name)) {
      const { frame, size } = props[name as keyof typeof props];
      scene.add.image(x, y, 'terrain-props', frame).setDisplaySize(size, size);
      continue;
    }
    const image = scene.add.image(x, y, name);
    image.setScale(Math.min(1 / pixelsPerWorldUnit, 420 / image.width, 430 / image.height));
  }
}
