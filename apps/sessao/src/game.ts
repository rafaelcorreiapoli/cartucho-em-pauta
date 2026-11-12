import { objects, type GroundItem } from './gameplay';
import { hudConsumesKeys } from './game-keys';
import Phaser from 'phaser';
import { characterArt, characterSheets } from './character-art';
import { offices, type Assignment, type Office } from './elections';
import { bills, stations, STATION_RADIUS, type Phase, type PlenaryView, type Station } from './plenary';
import { drawMap } from './draw-map';
import { PlayerHistory, PredictedMovement } from './network-movement';
import { STEP_MS, type ControlState, type MovementInput } from './movement';
import { HEIGHT, inPlenary, NAMES, PLENARY_BOUNDS, PLENARY_DOORS, VISION_RADIUS, WIDTH, type Motion, type Player } from './map';

type View = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; office: Phaser.GameObjects.Text; nextStep:number };
const stationColor = 0x79ebdf;
const officeColors: Record<Office,string> = {president:'#ffdb83',senator:'#a8d8ff',deputy:'#a9efb5'};
const directions = new Map(Object.entries({
  arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0],
  arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1],
}));

export function createGame(parent: HTMLElement, ownId: string, send: (input: MovementInput) => void, footstep:(level:number,pan:number)=>void) {
  const fog = document.createElement('div');
  fog.className = 'map-fog';
  fog.hidden = true;
  fog.setAttribute('aria-hidden','true');
  parent.append(fog);
  let players: Player[] = [];
  let groundItems: GroundItem[] = [];
  let negotiating = false;
  let plenaryView:PlenaryView | undefined;
  let running = false;
  let resizeObserver:ResizeObserver | undefined;
  let titles = new Map<string,Office>();
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
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      (!running && event.target!==parent) || hudConsumesKeys(event.target)) return;
    const key = event.key.toLowerCase();
    if (!directions.has(key)) return;
    event.preventDefault();
    if (!keys.size && !manual) nextStep = -Infinity;
    destination = undefined;
    keys.add(key);
  }, options);
  document.addEventListener('keyup', event => keys.delete(event.key.toLowerCase()), options);
  document.addEventListener('focusin', event => { if (hudConsumesKeys(event.target)) stop(); }, options);
  window.addEventListener('blur',stop,options);

  class Plenary extends Phaser.Scene {
    private doors!: Phaser.GameObjects.Graphics;
    private board!: Phaser.GameObjects.Text;
    private views = new Map<string,View>();
    private groundMarkers = new Map<number,{marker:Phaser.GameObjects.Container; label:Phaser.GameObjects.Text}>();
    private renderedGround?:GroundItem[];
    private stationMarkers: Phaser.GameObjects.Ellipse[] = [];
    private mapLabels:Phaser.GameObjects.Text[] = [];
    private textResolution = 3;
    private marker!: Phaser.GameObjects.Ellipse;


    preload() {
      for (const {key,path} of characterSheets) this.load.spritesheet(key,path,{frameWidth:128,frameHeight:128});
      for (const [kind,{portrait}] of Object.entries(objects)) {
        this.load.image(`item-${kind}`,`${import.meta.env.BASE_URL}assets/${portrait}`);
      }
      this.load.spritesheet('office','assets/office-hd.png',{frameWidth:192,frameHeight:112});
    }
    create() {
      for (let character=0;character<NAMES.length;character++) {
        const {sheet,frame} = characterArt(character);
        for (let direction=0;direction<3;direction++) {
          const start = frame+direction*4;
          const frames = Array.from({length:4},(_,step) => ({key:sheet.key,frame:start+step}));
          this.anims.create({key:`${character}-${direction}`,frames,frameRate:9,repeat:-1});
        }
      }
      const syncCanvas = () => {
        const density = Math.min(2,Math.max(1,window.devicePixelRatio || 1));
        const width = Math.round(parent.clientWidth*density);
        const height = Math.round(parent.clientHeight*density);
        if (width && height && (this.scale.width!==width || this.scale.height!==height)) this.scale.resize(width,height);
      };
      resizeObserver = new ResizeObserver(syncCanvas);
      resizeObserver.observe(parent);
      window.addEventListener('resize',syncCanvas,options);
      syncCanvas();
      this.mapLabels = drawMap(this);
      this.doors = this.add.graphics().setDepth(1);
      for (const [x,y,w,h] of PLENARY_DOORS) {
        this.doors.fillStyle(0x774740).fillRect(x,y,w,h).fillStyle(0xe8aa75).fillRect(x,y+2,w,2);
      }
      this.board = this.add.text(480,562,'',{
        fontFamily:'system-ui',fontSize:'7px',color:'#d6ffd0',backgroundColor:'#111e19',
        align:'center',padding:{x:4,y:2},resolution:3,
      }).setOrigin(.5,0).setDepth(HEIGHT+10);
      for (const {x,y} of Object.values(stations)) {
        this.stationMarkers.push(this.add.ellipse(x,y,34,16,stationColor,.16)
          .setStrokeStyle(1,stationColor).setDepth(1).setVisible(false));
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
    playerHead() {
      const camera = this.cameras.main;
      const sprite = this.views.get(ownId)?.sprite;
      if (!sprite || !camera.width) return;
      const zoom = camera.zoom*parent.clientWidth/camera.width;
      return {
        x:parent.clientWidth/2+(sprite.x-camera.midPoint.x)*zoom,
        y:parent.clientHeight/2+(sprite.y-camera.midPoint.y-sprite.displayHeight-5)*zoom,
      };
    }

    pulseStation(key:Station) {
      const {x,y} = stations[key];
      const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      const pulse = this.add.ellipse(x,y,44,26,stationColor,.24)
        .setStrokeStyle(2,stationColor).setDepth(2);
      this.tweens.add({
        targets:pulse,scale:reduced ? 1 : 2.8,alpha:0,duration:560,ease:'Cubic.Out',
        onComplete:() => pulse.destroy(),
      });
    }

    private renderGroundItems() {
      if (this.renderedGround===groundItems) return;
      this.renderedGround = groundItems;
      const visible = new Set(groundItems.map(item=>item.id));
      for (const [id,{marker}] of this.groundMarkers) {
        if (visible.has(id)) continue;
        marker.destroy();
        this.groundMarkers.delete(id);
      }
      for (const item of groundItems) {
        const existing = this.groundMarkers.get(item.id);
        if (existing) {
          existing.marker.setPosition(item.x,item.y).setDepth(item.y-1);
          continue;
        }
        const icon = this.add.image(0,0,`item-${item.kind}`).setOrigin(.5,.8).setDisplaySize(20,20);
        const label = this.add.text(0,4,item.title ?? objects[item.kind].name,{
          fontFamily:'system-ui',fontSize:'5px',color:'#fff5df',backgroundColor:'rgba(14,25,20,0.68)',
          padding:{x:2,y:1},align:'center',wordWrap:{width:76},resolution:this.textResolution,
        }).setOrigin(.5,0);
        const marker = this.add.container(item.x,item.y,[icon,label]).setDepth(item.y-1);
        this.groundMarkers.set(item.id,{marker,label});
      }
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
      this.renderGroundItems();
      const now = performance.now();
      const ownPlayer = local.state?.player;
      const inSession = !!local.state?.plenary;
      this.doors.setVisible(inSession);
      const agenda = plenaryView && bills[plenaryView.round];
      this.board.setText(agenda && plenaryView && running ? `${agenda.name} · ${plenaryView.remaining}s` : 'Painel de votação');
      const camera = this.cameras.main;
      const cssWidth = parent.clientWidth || 1;
      const cssHeight = parent.clientHeight || 1;
      const density = camera.width/cssWidth;
      const normalZoom = Math.max(1.5,cssWidth/550,cssHeight/(cssWidth<=680 ? 310 : 360));
      const cssZoom = inSession ? Math.min(normalZoom,cssWidth/580,cssHeight/340) : normalZoom;
      const zoom = cssZoom*density;
      const resolution = Math.max(3,Math.ceil(zoom));
      if (resolution!==this.textResolution) {
        this.textResolution = resolution;
        for (const label of this.mapLabels) label.setResolution(resolution);
        for (const {label} of this.groundMarkers.values()) label.setResolution(resolution);
        for (const view of this.views.values()) {
          view.label.setResolution(resolution);
          view.office.setResolution(resolution);
        }
      }
      if (camera.zoom!==zoom) camera.setZoom(zoom);
      for (const marker of this.stationMarkers) {
        const nearby = ownPlayer && Math.hypot(ownPlayer.x-marker.x,ownPlayer.y-marker.y)<=STATION_RADIUS;
        marker.setVisible(negotiating).setAlpha(nearby ? 1 : .55);
      }

      for (const [id,view] of this.views) {
        if (!players.some(player => player.id===id)) {
          view.sprite.destroy();
          view.label.destroy();
          view.office.destroy();
          this.views.delete(id);
        }
      }
      for (const latest of players) {
        const own = latest.id===ownId;
        const player = (own ? local.state?.player : history.sample(now,latest.id)) ?? latest;
        const {id,character,direction,moving} = player;
        const {sheet,frame} = characterArt(character);
        let view = this.views.get(id);
        if (running && !own && ownPlayer && (inSession ? !inPlenary(player) : Math.hypot(player.x-ownPlayer.x,player.y-ownPlayer.y)>=VISION_RADIUS)) {
          view?.sprite.setVisible(false);
          view?.label.setVisible(false);
          view?.office.setVisible(false);
          continue;
        }
        if (!view) {
          view = {
            nextStep:0,
            sprite:this.add.sprite(player.x,player.y,sheet.key,frame).setOrigin(.5,1).setScale(.295),
            label:this.add.text(player.x,player.y+2,'',{
              fontFamily:'system-ui',fontSize:'9px',fontStyle:'bold',color:'#fff7df',stroke:'#20322e',strokeThickness:2,resolution:this.textResolution,
            }).setOrigin(.5,0).setDepth(HEIGHT+30),
            office:this.add.text(player.x,player.y+12,'',{
              fontFamily:'system-ui',fontSize:'6px',fontStyle:'bold',stroke:'#152522',strokeThickness:1.5,
              resolution:this.textResolution,
            }).setOrigin(.5,0).setDepth(HEIGHT+30),
          };
          this.views.set(id,view);
        }
        const {sprite,label,office} = view;
        const blend = own && Math.hypot(sprite.x-player.x,sprite.y-player.y)<40 ? 1-Math.exp(-delta/20) : 1;
        const x = Phaser.Math.Linear(sprite.x,player.x,blend);
        const y = Phaser.Math.Linear(sprite.y,player.y,blend);
        const row = direction===3 ? 1 : direction;
        if (moving && time>=view.nextStep && (own || ownPlayer)) {
          const distance = own ? 0 : Math.hypot(x-ownPlayer!.x,y-ownPlayer!.y);
          const level = own ? .46 : Math.max(0,1-distance/75)*.32;
          if (level) footstep(level,own ? 0 : Phaser.Math.Clamp((x-ownPlayer!.x)/85,-1,1));
          view.nextStep = time+290;
        } else if (!moving) view.nextStep = 0;
        sprite.setVisible(true).setPosition(x,y).setDepth(y).setFlipX(direction===3);
        label.setVisible(true).setPosition(x,y+2).setText(player.phone ? `☎ ${player.nick}` : player.nick)
          .setColor('#fff7df');
        const title = titles.get(id);
        office.setVisible(running || !!title).setPosition(x,y+12)
          .setText(title ? offices[title].name : 'Assessor')
          .setColor(title ? officeColors[title] : '#cbd6db');
        if (moving) sprite.play(`${character}-${row}`,true);
        else {
          sprite.anims.stop();
          sprite.setTexture(sheet.key,frame+row*4);
        }
        if (own) {
          this.marker.setPosition(x,y-2).setDepth(y-1).setVisible(true);
          if (inSession) {
            const [left,top,width,height] = PLENARY_BOUNDS;
            camera.centerOn(left+width/2,top+height/2-30);
          } else camera.centerOn(x,y);
          if (running) {
            const screenX = (x-camera.scrollX-camera.width/2)*zoom+camera.width/2;
            const screenY = (y-camera.scrollY-camera.height/2)*zoom+camera.height/2;
            const radius = VISION_RADIUS*cssZoom;
            fog.style.background = `radial-gradient(circle at ${screenX/density}px ${screenY/density}px, transparent ${radius*.86}px, #000a ${radius}px)`;
            fog.style.clipPath = '';
            if (inSession) {
              const [left,top,width,height] = PLENARY_BOUNDS;
              const x1 = (screenX+(left-x)*zoom)/density, x2 = x1+width*cssZoom;
              const y1 = (screenY+(top-y)*zoom)/density, y2 = y1+height*cssZoom;
              fog.style.background = '#000b';
              fog.style.clipPath = `polygon(evenodd, 0 0, 100% 0, 100% 100%, 0 100%, 0 0, ${x1}px ${y1}px, ${x2}px ${y1}px, ${x2}px ${y2}px, ${x1}px ${y2}px, ${x1}px ${y1}px)`;
            }
            fog.hidden = false;
          }
        }
      }
    }
  }
  const scene = new Plenary();
  const game = new Phaser.Game({
    type:Phaser.AUTO,parent,
    antialias:true,roundPixels:false,backgroundColor:'#000',scene,
    width:Math.max(1,parent.clientWidth),height:Math.max(1,parent.clientHeight),
    scale:{mode:Phaser.Scale.NONE},
  });
  return {
    update(snapshot: Player[]) {
      players = snapshot;
      history.add(snapshot,performance.now());
    },
    setGroundItems(items:GroundItem[]) { groundItems = items; },
    pulseStation(key:Station) { if (scene.sys.isActive()) scene.pulseStation(key); },
    playerHead() { return scene.sys.isActive() ? scene.playerHead() : undefined; },
    setPlenaryView(view:PlenaryView) { plenaryView = view; },
    reconcile(snapshot: ControlState) {
      if (!!snapshot.plenary!==!!local.state?.plenary) {
        stop();
        destination = undefined;
        history.clear();
      }
      local.reconcile(snapshot);
    },
    setMatchPhase(phase:Phase) {
      negotiating = phase==='negotiation';
      running = negotiating || phase==='ballot' || phase==='hearing';
      if (!running) fog.hidden = true;
    },
    setOffices(assignments:Assignment[]) { titles = new Map(assignments.map(({id,office}) => [id,office])); },
    destroy() {
      listeners.abort();
      resizeObserver?.disconnect();
      game.destroy(true);
      fog.remove();
    },
  };
}
