import Phaser from 'phaser';
import { drawMap } from './draw-map';
import { HEIGHT, NAMES, WIDTH, type Motion, type Player } from './map';

type View = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text };
const directions = new Map(Object.entries({
  arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0],
  arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1],
}));

export function createGame(parent: HTMLElement, ownId: string, send: (motion: Motion) => void) {
  let players: Player[] = [];
  let target: Motion | undefined;
  const keys = new Set<string>();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const stop = () => {
    keys.clear();
    target = undefined;
  };
  parent.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!directions.has(key)) return;
    event.preventDefault();
    target = undefined;
    keys.add(key);
  }, options);
  parent.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()), options);
  parent.addEventListener('blur',stop,options);
  window.addEventListener('blur',stop,options);

  class Plenary extends Phaser.Scene {
    private views = new Map<string,View>();
    private marker!: Phaser.GameObjects.Ellipse;
    private lastSent = -Infinity;

    preload() {
      this.load.spritesheet('players','assets/sprites.png',{frameWidth:24,frameHeight:24});
      this.load.image('office','assets/office.png');
    }
    create() {
      for (let character=0;character<3;character++) {
        for (let direction=0;direction<3;direction++) {
          const start = character*12+direction*4;
          const frames = Array.from({length:4},(_,step) => ({key:'players',frame:start+step}));
          this.anims.create({key:`${character}-${direction}`,frames,frameRate:9,repeat:-1});
        }
      }
      drawMap(this);
      this.marker = this.add.ellipse(0,0,22,9,0xf5d681,.2).setStrokeStyle(1,0xf5d681).setVisible(false);
      this.input.on('pointerdown',(pointer: Phaser.Input.Pointer) => {
        parent.focus({preventScroll:true});
        target = {x:pointer.worldX,y:pointer.worldY};
      });
    }
    update(time: number, delta: number) {
      const own = players.find(player => player.id===ownId);
      if (own && time-this.lastSent>=50) {
        this.lastSent = time;
        const motion = {x:0,y:0};
        for (const key of keys) {
          const [x,y] = directions.get(key)!;
          motion.x += x;
          motion.y += y;
        }
        if (target) {
          const dx = target.x-own.x;
          const dy = target.y-own.y;
          const distance = Math.hypot(dx,dy);
          if (distance<4) target = undefined;
          else {
            motion.x = dx/distance;
            motion.y = dy/distance;
          }
        }
        send(motion);
      }

      for (const [id,view] of this.views) {
        if (!players.some(player => player.id===id)) {
          view.sprite.destroy();
          view.label.destroy();
          this.views.delete(id);
        }
      }
      for (const player of players) {
        const {id,character,direction,moving} = player;
        let view = this.views.get(id);
        if (!view) {
          view = {
            sprite:this.add.sprite(player.x,player.y,'players').setOrigin(.5,1),
            label:this.add.text(player.x,player.y+2,'',{
              fontFamily:'system-ui',fontSize:'9px',fontStyle:'bold',color:'#fff7df',stroke:'#20322e',strokeThickness:2,
            }).setOrigin(.5,0).setDepth(500),
          };
          this.views.set(id,view);
        }
        const {sprite,label} = view;
        const blend = 1-Math.exp(-delta/25);
        const x = Phaser.Math.Linear(sprite.x,player.x,blend);
        const y = Phaser.Math.Linear(sprite.y,player.y,blend);
        const row = direction===3 ? 1 : direction;
        sprite.setPosition(x,y).setDepth(y).setFlipX(direction===3);
        label.setPosition(x,y+2).setText(NAMES[character]);
        if (moving) sprite.play(`${character}-${row}`,true);
        else {
          sprite.anims.stop();
          sprite.setFrame(character*12+row*4);
        }
        if (id===ownId) this.marker.setPosition(x,y-2).setDepth(y-1).setVisible(true);
      }
    }
  }
  const game = new Phaser.Game({
    type:Phaser.AUTO,width:WIDTH,height:HEIGHT,parent,
    pixelArt:true,roundPixels:true,backgroundColor:'#20312f',scene:Plenary,
    scale:{mode:Phaser.Scale.FIT,autoCenter:Phaser.Scale.CENTER_BOTH},
  });
  return {
    update(snapshot: Player[]) { players = snapshot; },
    destroy() {
      listeners.abort();
      game.destroy(true);
    },
  };
}
