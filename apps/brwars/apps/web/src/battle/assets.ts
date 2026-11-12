import { HEROES, hasHeroArt, type HeroKind } from '@brwars/simulation';
import Phaser from 'phaser';
import { EVOLVING_BUILDINGS, EVOLUTION_FRAME_SIZE, evolutionTexture } from '../building-art';
import {
  PACKED_UNIT_FRAME_WIDTH,
  PACKED_LEGACY_FRAME_WIDTH,
  VARIANT_CLASSES,
  VARIANT_FRAME_SIZE,
  variantTexture,
  variantWalkTexture,
} from './unit-art';
export function preloadBattleAssets(scene: Phaser.Scene) {
  for (const side of ['left', 'right'] as const) {
    for (const kind of VARIANT_CLASSES) {
      const texture = variantTexture(side, kind, 1)!;
      const frame = {
        frameWidth: VARIANT_FRAME_SIZE,
        frameHeight: VARIANT_FRAME_SIZE,
      };
      scene.load.spritesheet(texture, `/assets/${texture}.webp`, frame);
      const walkTexture = variantWalkTexture(side, kind);
      if (walkTexture) scene.load.spritesheet(walkTexture, `/assets/${walkTexture}.webp`, frame);
    }
  }
  scene.load.spritesheet('left-ranged', '/assets/left-ranged-packed.webp', {
    frameWidth: PACKED_UNIT_FRAME_WIDTH,
    frameHeight: 512,
  });
  scene.load.spritesheet('medic-right', '/assets/medic-convenio-packed.webp', {
    frameWidth: PACKED_UNIT_FRAME_WIDTH,
    frameHeight: 512,
  });
  scene.load.spritesheet('medic', '/assets/medic-cubano-packed.webp', {
    frameWidth: PACKED_UNIT_FRAME_WIDTH,
    frameHeight: 512,
  });
  scene.load.spritesheet('workers', '/assets/workers-painted-packed.webp', {
    frameWidth: PACKED_UNIT_FRAME_WIDTH,
    frameHeight: 512,
  });
  for (const hero of Object.keys(HEROES) as HeroKind[])
    if (hasHeroArt(hero))
      scene.load.spritesheet(`hero-${hero}`, `/assets/hero-${hero}-packed.webp`, {
        frameWidth: PACKED_UNIT_FRAME_WIDTH,
        frameHeight: 512,
      });
  for (const kind of EVOLVING_BUILDINGS) {
    const texture = evolutionTexture(kind);
    scene.load.spritesheet(texture, `/assets/${texture}.webp`, {
      frameWidth: EVOLUTION_FRAME_SIZE,
      frameHeight: EVOLUTION_FRAME_SIZE,
    });
  }
  scene.load.spritesheet('park-depot', '/assets/park-depot-v3.webp', {
    frameWidth: 512,
    frameHeight: 512,
  });
  scene.load.spritesheet('construction', '/assets/construction.png', {
    frameWidth: 384,
    frameHeight: 512,
  });
  scene.load.spritesheet('academy', '/assets/academies.png', {
    frameWidth: 768,
    frameHeight: 1024,
  });
  scene.load.spritesheet('bank', '/assets/banks.png', { frameWidth: 768, frameHeight: 1024 });
  scene.load.spritesheet('workplace', '/assets/workplaces.png', {
    frameWidth: 768,
    frameHeight: 1024,
  });
  scene.load.spritesheet('housing', '/assets/housing.png', {
    frameWidth: 768,
    frameHeight: 1024,
  });
  scene.load.spritesheet('school', '/assets/schools.png', {
    frameWidth: 768,
    frameHeight: 1024,
  });
  scene.load.spritesheet('hospital', '/assets/hospitals.png', {
    frameWidth: 768,
    frameHeight: 1024,
  });
  scene.load.spritesheet('civic', '/assets/civic.png', { frameWidth: 768, frameHeight: 1024 });
  scene.load.spritesheet('left-animation', '/assets/left-animation-packed.webp', {
    frameWidth: PACKED_LEGACY_FRAME_WIDTH,
    frameHeight: 256,
  });
  scene.load.spritesheet('right-animation', '/assets/right-animation-packed.webp', {
    frameWidth: PACKED_LEGACY_FRAME_WIDTH,
    frameHeight: 256,
  });
  scene.load.spritesheet('buildings', '/assets/buildings.png', {
    frameWidth: 384,
    frameHeight: 512,
  });
}
