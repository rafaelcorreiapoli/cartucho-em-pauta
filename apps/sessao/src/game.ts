import Phaser from 'phaser';
import { stations, STATION_RADIUS, type Phase } from './plenary';
import { drawMap } from './draw-map';
import { PlayerHistory, PredictedMovement } from './network-movement';
import { STEP_MS, type ControlState, type MovementInput } from './movement';
import { HEIGHT, playerName, WIDTH, type Motion, type Player } from './map';

type View = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text };
const directions = new Map(Object.entries({
  arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0],
  arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1],
}));

export function createGame(parent: HTMLElement, ownId: string, send: (input: MovementInput) => void) {
  let players: Player[] = [];
  let negotiating = false;
  let running = false;
  let speaking = new Set<string>();
  const local = new PredictedMovement(send);
  const history = new PlayerHistory();
  let destination: Motion | undefined;
  let nextStep = -Infinity;
  let manual = false;
  const keys = new Set<string>();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const stop = () => {
    keys.clear();
  };
  parent.addEventListener('keydown', event => {
    const key = event.key.toLowerCase();
    if (!directions.has(key)) return;
    event.preventDefault();
    if (!keys.size && !manual) nextStep = -Infinity;
    destination = undefined;
    keys.add(key);
  }, options);
  parent.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()), options);
  parent.addEventListener('blur',stop,options);
  window.addEventListener('blur',stop,options);

  class Plenary extends Phaser.Scene {
    private views = new Map<string,View>();
    private stationMarkers: {ring:Phaser.GameObjects.Ellipse; label:Phaser.GameObjects.Text}[] = [];
    private marker!: Phaser.GameObjects.Ellipse;


    preload() {
      this.load.spritesheet('players','assets/sprites-hd.png',{frameWidth:128,frameHeight:128});
      this.load.spritesheet('office','assets/office-hd.png',{frameWidth:192,frameHeight:112});
    }
    create() {
      for (let character=0;character<3;character++) {
        for (let direction=0;direction<3;direction++) {
          const start = character*12+direction*4;
          const frames = Array.from({length:4},(_,step) => ({key:'players',frame:start+step}));
          this.anims.create({key:`${character}-${direction}`,frames,frameRate:9,repeat:-1});
        }
      }
      this.cameras.main.setBounds(0,0,WIDTH,HEIGHT);
      drawMap(this);
      for (const {x,y,label} of Object.values(stations)) {
        this.stationMarkers.push({
          ring:this.add.ellipse(x,y,34,16,0xffdc82,.2).setStrokeStyle(1,0xffdc82).setDepth(y-2),
          label:this.add.text(x,y-13,label,{fontFamily:'system-ui',fontSize:'8px',fontStyle:'bold',
            backgroundColor:'#263a31',padding:{x:3,y:1},resolution:3}).setOrigin(.5,1).setDepth(HEIGHT+20),
        });
      }
      this.marker = this.add.ellipse(0,0,22,9,0xf5d681,.2).setStrokeStyle(1,0xf5d681).setVisible(false);
      this.input.on('pointerdown',(pointer: Phaser.Input.Pointer) => {
        parent.focus({preventScroll:true});
        keys.clear();
        manual = false;
        const {x,y} = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        if (x>=0 && x<WIDTH && y>=0 && y<HEIGHT) {
          destination = {x,y};
          nextStep = -Infinity;
        }
      });
    }
    update(time: number, delta: number) {
      if (local.state && time>=nextStep) {
        nextStep = time-nextStep>STEP_MS ? time+STEP_MS : nextStep+STEP_MS;
        if (destination) {
          local.input({destination});
          destination = undefined;
        } else if (keys.size || manual) {
          const motion = {x:0,y:0};
          for (const key of keys) {
            const [x,y] = directions.get(key)!;
            motion.x += x;
            motion.y += y;
          }
          local.input({motion});
        } else if (local.state.route.length) {
          local.input({});
        } else {
          local.state.player.moving = false;
        }
        manual = keys.size>0;
      }
      const now = performance.now();
      const ownPlayer = local.state?.player;
      const camera = this.cameras.main;
      const zoom = Math.max(1.5,camera.width/550,camera.height/360);
      if (camera.zoom!==zoom) camera.setZoom(zoom);
      for (const [i,station] of Object.values(stations).entries()) {
        const {ring,label} = this.stationMarkers[i];
        ring.setVisible(negotiating).setAlpha(ownPlayer && Math.hypot(ownPlayer.x-station.x,ownPlayer.y-station.y)<=STATION_RADIUS ? 1 : .55);
        label.setVisible(negotiating);
      }

      for (const [id,view] of this.views) {
        if (!players.some(player => player.id===id)) {
          view.sprite.destroy();
          view.label.destroy();
          this.views.delete(id);
        }
      }
      for (const latest of players) {
        const own = latest.id===ownId;
        const player = (own ? local.state?.player : history.sample(now,latest.id)) ?? latest;
        const {id,character,direction,moving} = player;
        let view = this.views.get(id);
        if (!view) {
          view = {
            sprite:this.add.sprite(player.x,player.y,'players').setOrigin(.5,1).setScale(.295),
            label:this.add.text(player.x,player.y+2,'',{
              fontFamily:'system-ui',fontSize:'9px',fontStyle:'bold',color:'#fff7df',stroke:'#20322e',strokeThickness:2,resolution:3,
            }).setOrigin(.5,0).setDepth(HEIGHT+30),
          };
          this.views.set(id,view);
        }
        const {sprite,label} = view;
        const blend = own ? 1-Math.exp(-delta/20) : 1;
        const x = Phaser.Math.Linear(sprite.x,player.x,blend);
        const y = Phaser.Math.Linear(sprite.y,player.y,blend);
        const row = direction===3 ? 1 : direction;
        sprite.setPosition(x,y).setDepth(y).setFlipX(direction===3);
        label.setPosition(x,y+2).setText(playerName(player,players,running))
          .setColor(speaking.has(id) ? '#adff91' : '#fff7df');
        if (moving) sprite.play(`${character}-${row}`,true);
        else {
          sprite.anims.stop();
          sprite.setFrame(character*12+row*4);
        }
        if (own) {
          this.marker.setPosition(x,y-2).setDepth(y-1).setVisible(true);
          camera.centerOn(x,y);
        }
      }
    }
  }
  const game = new Phaser.Game({
    type:Phaser.AUTO,parent,
    antialias:true,roundPixels:false,backgroundColor:'#20312f',scene:Plenary,
    scale:{mode:Phaser.Scale.RESIZE},
  });
  return {
    update(snapshot: Player[]) {
      players = snapshot;
      history.add(snapshot,performance.now());
    },
    reconcile(snapshot: ControlState) { local.reconcile(snapshot); },
    setMatchPhase(phase:Phase) {
      negotiating = phase==='negotiation';
      running = negotiating || phase==='ballot';
    },
    setSpeaking(ids: Set<string>) { speaking = ids; },
    destroy() {
      listeners.abort();
      game.destroy(true);
    },
  };
}
