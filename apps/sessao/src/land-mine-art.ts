import type Phaser from 'phaser';
import type {PlantedMine} from './land-mines';

export function createMineArt(scene:Phaser.Scene,mine:PlantedMine) {
  const shadow = scene.add.ellipse(0,1,19,7,0x211e18,.18);
  const mound = scene.add.ellipse(0,0,16,6,0x938b76,.22);
  const rim = scene.add.ellipse(-1,-1,11,3,0xe3d9bb,.16);
  return scene.add.container(mine.x,mine.y,[shadow,mound,rim]).setDepth(1);
}
