import {plenaryCameraCenter,plenaryZoom} from './plenary-camera';
import {wallVision,shadowOutline} from './visibility';
import {fireSites} from './fire';
import { isOfficeFurniture, officeDoorPoint, officeFixtures, officeFurniture, privateOffices } from './private-offices';
import type { CombatCue } from './game-audio';
import { playBloodImpact, playComicImpact } from './comic-impact';
import { weaponPose, weapons } from './weapons';
import { mapNpcs } from './npcs';
import { binoculars, xray } from './equipment';
import { canReachObject, cashAmount, objects, type GroundItem } from './gameplay';
import { hudConsumesKeys } from './game-keys';
import Phaser from 'phaser';
import { attackArt, characterArt, characterSheets, combatSheets, downedArt, hitArt } from './character-art';
import type { Assignment, Office } from './elections';
import { agendaProject, stations, STATION_RADIUS, type Phase, type PlenaryView, type Station } from './plenary';
import { drawMap } from './draw-map';
import { decorationLabel, itemSymbols, PhotoRenderer } from './photo-renderer';
import { inPhotoFrame, type Decoration, type PhotoScene } from './photography';
import { PlayerHistory, PredictedMovement } from './network-movement';
import { restMovement, STEP_MS, type ControlState, type MovementInput } from './movement';
import { HEIGHT, inPlenary, localPerception, worldVisible, NAMES, PLENARY_BOUNDS, PLENARY_DOORS, sprintMultiplier, VISION_RADIUS, WIDTH, type Motion, type Player } from './map';

type View = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; office: Phaser.GameObjects.Text; items:Phaser.GameObjects.Container; itemsKey?:string; nextStep:number; lastHit?:number; flashUntil?:number; hitAt?:number; fallAt?:number; weapon:Phaser.GameObjects.Image; swingAt?:number; swingStarted?:number };
const stationColor = 0x79ebdf;
const directions = new Map(Object.entries({
  arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0],
  arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1],
}));

export function createGame(parent: HTMLElement, ownId: string, send: (input: MovementInput) => void, footstep:(level:number,pan:number)=>void,
  combatSound:(cue:CombatCue,level:number,pan:number)=>void) {
  const penumbra = document.createElement('div');
  penumbra.className = 'map-fog';
  penumbra.hidden = true;
  penumbra.setAttribute('aria-hidden','true');
  parent.append(penumbra);
  let players: Player[] = [];
  let groundItems: GroundItem[] = [];
  let decorations: Decoration[] = [];
  let inLobby = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
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
  const shiftKeys = new Set<string>();
  const listeners = new AbortController();
  const options = { signal: listeners.signal };
  const stop = () => {
    keys.clear();
    shiftKeys.clear();
  };
  document.addEventListener('keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
      (!running && event.target!==parent) || hudConsumesKeys(event.target)) return;
    const key = event.key.toLowerCase();
    if (key==='shift') shiftKeys.add(event.code);
    if (!directions.has(key)) return;
    event.preventDefault();
    if (!keys.size && !manual) nextStep = -Infinity;
    destination = undefined;
    keys.add(key);
  }, options);
  document.addEventListener('keyup', event => {
    keys.delete(event.key.toLowerCase());
    if (event.key==='Shift') shiftKeys.delete(event.code);
  }, options);
  document.addEventListener('focusin', event => { if (hudConsumesKeys(event.target)) stop(); }, options);
  window.addEventListener('blur',stop,options);

  class Plenary extends Phaser.Scene {
    private safeProgress!: Phaser.GameObjects.Graphics;
    private officeDoors!: Phaser.GameObjects.Graphics;
    private officeSigns = new Map<string,Phaser.GameObjects.Text>();
    private officeRenderKey:string|undefined = '';
    private doors!: Phaser.GameObjects.Graphics;
    private board!: Phaser.GameObjects.Text;
    private views = new Map<string,View>();
    private groundMarkers = new Map<number,Phaser.GameObjects.Container>();
    private renderedGround?:GroundItem[];
    private renderedDecorations?:Decoration[];
    private installed = new Map<number,{marker:Phaser.GameObjects.Container; label?:Phaser.GameObjects.Text; mark?:Phaser.GameObjects.Text}>();
    photoRenderer?:PhotoRenderer;
    private stationMarkers: Phaser.GameObjects.Ellipse[] = [];
    private mapLabels:Phaser.GameObjects.Text[] = [];
    private textResolution = 3;
    private safeFraction = 0;
    private drawnVisionRadius = VISION_RADIUS;
    fog!:Phaser.GameObjects.Graphics;
    private fogGeometry?: {x:number;y:number;radius:number;barriers:string;points:ReturnType<typeof wallVision>};
    private flames?:Phaser.GameObjects.Text;
    private extinguishers:Phaser.GameObjects.Text[] = [];
    private marker!: Phaser.GameObjects.Ellipse;
    private npcViews:{sprite:Phaser.GameObjects.Sprite;label?:Phaser.GameObjects.Text}[] = [];


    preload() {
      for (const [key,weapon] of Object.entries(weapons)) {
        this.load.image(`weapon-${key}`,import.meta.env.BASE_URL+'assets/'+weapon.sprite);
      }
      for (const {key,path} of [...characterSheets,...combatSheets]) this.load.spritesheet(key,path,{frameWidth:128,frameHeight:128});
      for (const [id,npc] of Object.entries(mapNpcs)) {
        this.load.image(`npc-${id}`,import.meta.env.BASE_URL+'assets/'+npc.sprite);
      }
      for (const [kind,{sprite}] of Object.entries(officeFurniture)) {
        this.load.image(`furniture-${kind}`,import.meta.env.BASE_URL+'assets/'+sprite);
      }
      for (const [kind,{portrait}] of Object.entries(objects)) {
        this.load.image(`item-${kind}`,`${import.meta.env.BASE_URL}assets/${portrait}`);
      }
      this.load.spritesheet('installed-portraits',`${import.meta.env.BASE_URL}assets/retratos-elenco.webp`,{frameWidth:256,frameHeight:256});
      this.load.image(officeFixtures.safe.texture,`${import.meta.env.BASE_URL}assets/gabinete-cofre.webp`);
      this.load.image(officeFixtures.cabinet.texture,`${import.meta.env.BASE_URL}assets/gabinete-armario.webp`);
      this.load.image('infirmary-stretcher',import.meta.env.BASE_URL+'assets/'+'maca-enfermaria.webp');
      this.load.image('infirmary-doctor',import.meta.env.BASE_URL+'assets/'+'drauzio-varella.webp');
      this.load.image('technical-shelf',import.meta.env.BASE_URL+'assets/'+'estante-apoio-tecnico.webp');
      this.load.image('snack-counter',import.meta.env.BASE_URL+'assets/'+'balcao-lanchonete.webp');
      this.load.image('coffee-maker',import.meta.env.BASE_URL+'assets/cafeteira.webp');
      this.load.spritesheet('office','assets/office-hd.png',{frameWidth:192,frameHeight:112});
    }
    create() {
      this.cameras.main.setVisible(!inLobby);
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
      this.fog = this.add.graphics().setDepth(HEIGHT+90);
      this.photoRenderer = new PhotoRenderer(this.textures);
      this.children.depthSort();
      this.photoRenderer.loadMap(this.children.getChildren());
      this.officeDoors = this.add.graphics().setDepth(2);
      this.safeProgress = this.add.graphics().setDepth(HEIGHT+31);
      for (const office of privateOffices) {
        const point = officeDoorPoint(office);
        const sign = this.add.text(point.x,point.y-office.inside*15,'',{
          fontFamily:'system-ui',fontSize:'5px',color:'#fff4dc',backgroundColor:'#172b23',
          align:'center',padding:{x:3,y:1},resolution:3,
        }).setOrigin(.5).setDepth(2);
        this.officeSigns.set(office.id,sign);
      }
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
      this.npcViews = Object.entries(mapNpcs).map(([id,npc])=>{
        const sprite = this.add.sprite(npc.x,npc.y,`npc-${id}`);
        sprite.setOrigin(.5,1).setDisplaySize(38,38).setDepth(npc.y);
        const label = id==='treasurer' && 'counter' in npc ? this.add.text(npc.x,npc.counter.y+24,npc.label,{
          fontFamily:'system-ui',fontSize:'7px',color:'#ffe4a1',backgroundColor:'#142820bb',
          padding:{x:3,y:1},resolution:3,
        }).setOrigin(.5,0).setDepth(1) : undefined;
        return {sprite,label};
      });
      this.marker = this.add.ellipse(0,0,19,6,0x09110e,.34).setVisible(false);
      this.input.on('pointerdown',(pointer: Phaser.Input.Pointer) => {
        parent.focus({preventScroll:true});
        keys.clear();
    shiftKeys.clear();
        manual = false;
        const {x,y} = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        if (x>=0 && x<WIDTH && y>=0 && y<HEIGHT) {
          destination = {x,y};
          nextStep = -Infinity;
        }
      });
    }
    localSprite() { return this.views.get(ownId)?.sprite; }
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
      for (const [id,marker] of this.groundMarkers) {
        if (visible.has(id)) continue;
        marker.destroy();
        this.groundMarkers.delete(id);
      }
      for (const item of groundItems) {
        const existing = this.groundMarkers.get(item.id);
        if (existing) {
          existing.setPosition(item.x,item.y).setDepth(item.y-1);
          continue;
        }
        const symbol = itemSymbols[item.kind];
        const icon = symbol ? this.add.text(0,0,symbol,{fontSize:'15px',color:'#ffe08a',resolution:3}).setOrigin(.5,.8)
          : this.add.image(0,0,`item-${item.kind}`).setOrigin(.5,.8).setDisplaySize(20,20);
        const shadow = this.add.ellipse(0,2,15,5,0x09110e,.28);
        const marker = this.add.container(item.x,item.y,[shadow,icon]).setDepth(item.y-1);
        this.groundMarkers.set(item.id,marker);
      }
    }

    private renderDecorations() {
      if (this.renderedDecorations===decorations) return;
      this.renderedDecorations = decorations;
      const ids = new Set(decorations.map(item=>item.id));
      for (const [id,{marker}] of this.installed) {
        if (ids.has(id)) continue;
        marker.destroy();
        this.installed.delete(id);
      }
      for (const item of decorations) {
        const current = this.installed.get(item.id);
        if (current) {
          current.label?.setText(decorationLabel(item));
          current.mark?.setVisible(!!item.marked);
          continue;
        }
        if (isOfficeFurniture(item.kind)) {
          const {width,height,anchor} = officeFurniture[item.kind];
          const art = this.add.image(0,0,`furniture-${item.kind}`).setDisplaySize(width,height).setOrigin(.5,anchor);
          const marker = this.add.container(item.x,item.y,[art]).setDepth(item.kind==='officeRug' ? .5 : item.y);
          this.installed.set(item.id,{marker});
          continue;
        }
        const art = item.kind==='portrait' ? this.add.image(0,0,'installed-portraits',item.character).setDisplaySize(18,18)
          : itemSymbols[item.kind]
            ? this.add.text(0,0,itemSymbols[item.kind]!,{fontSize:'16px',color:'#ffe08a',resolution:3}).setOrigin(.5)
            : this.add.image(0,0,`item-${item.kind}`).setDisplaySize(26,26);
        const label = this.add.text(0,9,decorationLabel(item),{
          fontSize:'5px',color:'#fff5df',backgroundColor:'#142820cc',padding:{x:2,y:1},resolution:this.textResolution,
        }).setOrigin(.5,0);
        const frame = this.add.rectangle(0,0,20,20,0x543b24,.92).setStrokeStyle(1,0xcb9853);
        const mark = this.add.text(0,0,'✗',{fontSize:'16px',color:'#ff7262',resolution:3}).setOrigin(.5).setVisible(!!item.marked);
        const marker = this.add.container(item.x,item.y,[frame,art,label,mark]).setDepth(item.y+1);
        this.installed.set(item.id,{marker,label,mark});
      }
    }

    private xrayLabels = new Map<string,{label:Phaser.GameObjects.Text; sweep:Phaser.GameObjects.Graphics; since:number}>();
    private xrayMoney = new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL',maximumFractionDigits:0});

    private drawXray(time:number,observer:Motion|undefined,radius:number) {
      const targets = negotiating && observer ? plenaryView?.gameplay?.xrayVision?.targets ?? [] : [];
      const visible = new Set<string>();
      for (const target of targets) {
        const sprite = target.safe ? undefined : this.views.get(target.id)?.sprite;
        if (!target.safe && !sprite?.visible) continue;
        const point = sprite ?? target;
        if (!observer || !worldVisible(observer,target,radius)) continue;
        visible.add(target.id);
        let entry = this.xrayLabels.get(target.id);
        if (!entry) {
          const label = this.add.text(0,0,this.xrayMoney.format(target.balance*10_000),{
            fontFamily:'system-ui',fontSize:'7px',fontStyle:'bold',color:'#b9fff9',
            backgroundColor:'#0c2829',padding:{x:4,y:2},resolution:3,
          }).setOrigin(.5,1).setDepth(HEIGHT+28);
          const sweep = this.add.graphics().setDepth(HEIGHT+27);
          entry = {label,sweep,since:time};
          this.xrayLabels.set(target.id,entry);
        }
        const foot = point.y-(target.safe ? officeFixtures.safe.footOffset : 0);
        const height = target.safe ? officeFixtures.safe.height : 32;
        const width = target.safe ? officeFixtures.safe.width : 18;
        const progress = Math.min(1,(time-entry.since)/xray.sweep);
        entry.label.setPosition(point.x,foot-height-7).setAlpha(Math.min(1,progress*4));
        entry.sweep.clear().lineStyle(.75,0x7cfbf0,.55+Math.sin(time/200)*.18)
          .strokeRoundedRect(point.x-width/2,foot-height,width,height,3);
        if (progress<1) entry.sweep.fillStyle(0x9bfff6,.8).fillRect(point.x-width/2,foot-height+progress*height,width,1);
      }
      for (const [id,entry] of this.xrayLabels) if (!visible.has(id)) {
        entry.label.destroy();
        entry.sweep.destroy();
        this.xrayLabels.delete(id);
      }
    }

    update(time: number, delta: number) {
      if (inLobby) return;
      if (local.state && time>=nextStep) {
        nextStep = time-nextStep>STEP_MS ? time+STEP_MS : nextStep+STEP_MS;
        const sprint = shiftKeys.size ? true : undefined;
        if (destination) {
          if (local.input({destination,sprint})) destination = undefined;
        } else if (keys.size || manual) {
          const motion = {x:0,y:0};
          for (const key of keys) {
            const [x,y] = directions.get(key)!;
            motion.x += x;
            motion.y += y;
          }
          local.input({motion,sprint});
        } else if (local.state.route.length) {
          local.input({sprint});
        } else {
          restMovement(local.state.player);
        }
        manual = keys.size>0;
      }
      if (!this.extinguishers.length) {
        this.extinguishers = fireSites.map(({extinguisher:{x,y}})=>this.add.text(x,y,'🧯',{fontSize:'16px',resolution:3})
          .setOrigin(.5,.8).setDepth(y));
      }
      const fire = plenaryView?.fire;
      if (fire) {
        const {x,y} = fireSites[fire.site];
        this.flames ??= this.add.text(x,y,'🔥',{fontSize:'27px',resolution:3}).setOrigin(.5,.8);
        this.flames.setPosition(x,y).setDepth(y+1).setVisible(!fire.paused)
          .setScale(1+Math.sin(time/145)*.06);
      } else this.flames?.setVisible(false);
      this.renderGroundItems();
      this.renderDecorations();
      const officeViews = plenaryView?.gameplay?.offices;
      const officeKey = JSON.stringify(officeViews);
      if (officeKey!==this.officeRenderKey) {
        this.officeRenderKey = officeKey;
        this.officeDoors.clear();
        for (const layout of privateOffices) {
          const office = officeViews?.find(entry=>entry.id===layout.id);
          this.officeSigns.get(layout.id)?.setText(`${layout.name}\n${office?.owner ?? 'Desocupado'}`);
          const [x,y,w,h] = layout.door;
          const status = office?.door ?? 'open';
          if (status!=='open') {
            this.officeDoors.fillStyle(status==='breached' ? 0xb66243 : status==='locked' ? 0x843d37 : 0x83623e,1)
              .fillRect(x,y+3,w,status==='breached' ? 2 : h-3);
          }
          if (office?.cabinetBreached) this.officeDoors.lineStyle(1,0xee9169)
            .strokeEllipse(layout.cabinet.x,layout.cabinet.y-3,officeFixtures.cabinet.width+4,7);
        }
      }
      this.safeProgress.clear();
      const channel = plenaryView?.gameplay?.officeChannel;
      if (!negotiating || channel?.kind!=='office-cash') this.safeFraction = 0;
      if (negotiating && channel?.kind==='office-cash') {
        const safe = privateOffices.find(office=>office.id===channel.officeId)?.safe;
        if (safe) {
          const {height,footOffset} = officeFixtures.safe;
          const x = safe.x-15;
          const y = safe.y-footOffset-height-8;
          const fraction = Phaser.Math.Clamp(channel.elapsed/channel.duration,0,1);
          this.safeFraction = reducedMotion.matches || fraction<this.safeFraction ? fraction :
            Phaser.Math.Linear(this.safeFraction,fraction,1-Math.exp(-delta/45));
          this.safeProgress.fillStyle(0x211a10,.95).fillRoundedRect(x,y,30,5,2);
          this.safeProgress.lineStyle(.75,0xffdb83).strokeRoundedRect(x,y,30,5,2);
          this.safeProgress.fillStyle(0xffcf4b).fillRect(x+1.5,y+1.5,27*this.safeFraction,2);
        }
      }
      const now = performance.now();
      const ownPlayer = local.state?.player;
      const visionRadius = VISION_RADIUS*(plenaryView?.gameplay?.binocularSeconds ? binoculars.multiplier : 1);
      const gap = visionRadius-this.drawnVisionRadius;
      this.drawnVisionRadius = !negotiating || reducedMotion.matches || Math.abs(gap)<.1
        ? visionRadius : this.drawnVisionRadius+gap*(1-Math.exp(-delta/105));
      for (const {sprite,label} of this.npcViews) {
        const visible = !running || (negotiating && !!ownPlayer && localPerception(ownPlayer,sprite,visionRadius).visible);
        sprite.setVisible(visible);
        label?.setVisible(visible);
      }
      const inSession = !!local.state?.plenary;
      this.doors.setVisible(inSession);
      const agenda = plenaryView && agendaProject(plenaryView);
      this.board.setText(agenda && plenaryView && running ? `${agenda.name} · ${plenaryView.remaining}s` : 'Painel de votação');
      const camera = this.cameras.main;
      const cssWidth = parent.clientWidth || 1;
      const cssHeight = parent.clientHeight || 1;
      const density = camera.width/cssWidth;
      const normalZoom = Math.max(1.5,Math.min(cssWidth/550,cssHeight/290),cssHeight/(cssWidth<=680 ? 310 : 360));
      const cssZoom = inSession ? plenaryZoom(normalZoom,cssWidth,cssHeight) : normalZoom;
      const zoom = cssZoom*density;
      const resolution = Math.max(3,Math.ceil(zoom));
      if (resolution!==this.textResolution) {
        this.textResolution = resolution;
        for (const label of this.mapLabels) label.setResolution(resolution);
        for (const {label} of this.installed.values()) label?.setResolution(resolution);
        for (const view of this.views.values()) {
          view.label.setResolution(resolution);
          view.office.setResolution(resolution);
        }
      }
      if (camera.zoom!==zoom) camera.setZoom(zoom);
      for (const marker of this.stationMarkers) {
        const nearby = ownPlayer && canReachObject(ownPlayer,marker,{radius:STATION_RADIUS,handsFree:true});
        marker.setVisible(negotiating && !!nearby);
      }

      for (const [id,view] of this.views) {
        if (!players.some(player => player.id===id)) {
          view.sprite.destroy();
          view.label.destroy();
          view.office.destroy();
          view.items.destroy();
          view.weapon.destroy();
          this.views.delete(id);
        }
      }
      const playCombatSound = (cue:CombatCue,x:number,y:number) => {
        if (!ownPlayer) return;
        const distance = Math.hypot(x-ownPlayer.x,y-ownPlayer.y);
        const level = Math.max(0,1-distance/VISION_RADIUS);
        if (level) combatSound(cue,level,Phaser.Math.Clamp((x-ownPlayer.x)/85,-1,1));
      };
      for (const latest of players) {
        const own = latest.id===ownId;
        const player = (own ? local.state?.player : history.sample(now,latest.id)) ?? latest;
        const {id,character,direction,moving} = player;
        const {sheet,frame} = characterArt(character);
        let view = this.views.get(id);
        if (running && !own && ownPlayer && (inSession ? !inPlenary(player) : !worldVisible(ownPlayer,player,visionRadius))) {
          view?.sprite.setVisible(false);
          view?.label.setVisible(false);
          view?.office.setVisible(false);
          view?.items.setVisible(false);
          view?.weapon.setVisible(false);
          continue;
        }
        if (!view) {
          view = {
            nextStep:0,
            weapon:this.add.image(0,0,'weapon-baton').setVisible(false),
            items:this.add.container().setDepth(HEIGHT+26),
            sprite:this.add.sprite(player.x,player.y,sheet.key,frame).setOrigin(.5,1).setScale(.295),
            label:this.add.text(player.x,player.y+2,'',{
              fontFamily:'system-ui',fontSize:'5.5px',fontStyle:'bold',color:'#fff7df',stroke:'#20322e',strokeThickness:1.1,resolution:this.textResolution,
            }).setOrigin(.5,0).setDepth(HEIGHT+30),
            office:this.add.text(player.x,player.y+10,'',{
              fontFamily:'system-ui',fontSize:'4px',fontStyle:'bold',stroke:'#152522',strokeThickness:.85,
              resolution:this.textResolution,
            }).setOrigin(.5,0).setDepth(HEIGHT+30),
          };
          this.views.set(id,view);
        }
        const {sprite,label,office} = view;
        const blend = own && Math.hypot(sprite.x-player.x,sprite.y-player.y)<40 ? 1-Math.exp(-delta/55) : 1;
        const x = Phaser.Math.Linear(sprite.x,player.x,blend);
        const y = Phaser.Math.Linear(sprite.y,player.y,blend);
        const swing = latest.swing;
        if (swing && swing.startedAt!==view.swingAt) {
          view.swingAt = swing.startedAt;
          view.swingStarted = time;
          playCombatSound('swing',x,y);
        }
        const profile = swing && weapons[swing.weapon];
        const progress = profile && view.swingStarted!==undefined ? (time-view.swingStarted)/profile.swingMs : 1;
        const pose = swing && progress<1 && !latest.knockedOut ? weaponPose(swing,progress) : undefined;
        const facing = pose?.facing ?? direction;
        const row = facing===3 ? 1 : facing;
        const attack = pose && profile ? attackArt(character,row,progress,profile.impactMs/profile.swingMs) : undefined;
        if (moving && time>=view.nextStep && (own || ownPlayer)) {
          const distance = own ? 0 : Math.hypot(x-ownPlayer!.x,y-ownPlayer!.y);
          const level = own ? .46 : Math.max(0,1-distance/75)*.32;
          if (level) footstep(level,own ? 0 : Phaser.Math.Clamp((x-ownPlayer!.x)/85,-1,1));
          view.nextStep = time+290/(player.sprinting ? sprintMultiplier : 1);
        } else if (!moving) view.nextStep = 0;
        if (latest.hit!==undefined && latest.hit!==view.lastHit) {
          view.flashUntil = time+115;
          playCombatSound('impact',x,y);
          if (latest.knockedOut) {
            view.fallAt = time;
            view.hitAt = undefined;
            this.time.delayedCall(185,()=>{
              if (running) playCombatSound('fall',x,y);
            });
          } else view.hitAt = time;
          playBloodImpact(this,x,y-15);
          playComicImpact(this,x,y-54,latest.hit,this.textResolution);
        }
        view.lastHit = latest.hit;
        if ((view.flashUntil ?? 0)>time) sprite.setTint(0xff685d);
        else sprite.clearTint();
        const downed = latest.knockedOut || latest.carried
          ? downedArt(character,direction,time-(view.fallAt ?? -Infinity))
          : undefined;
        if (!downed) view.fallAt = undefined;
        const recoil = view.hitAt===undefined ? undefined : hitArt(character,direction,time-view.hitAt);
        const combatArt = downed ?? recoil ?? attack;
        const spriteX = x+(pose?.lungeX ?? 0);
        const spriteY = latest.carried ? y-24 : y+(pose?.lungeY ?? 0);
        const labelY = latest.carried ? y-51 : y+2;
        sprite.setOrigin(.5,downed?.originY ?? 1).setRotation(downed?.rotation ?? (recoil ? 0 : pose?.lean ?? 0))
          .setAlpha(latest.knockedOut && !latest.carried ? .68 : 1);
        const spriteDepth = y+(latest.carried ? 1 : 0);
        if (!own && sprite.depth!==spriteDepth) sprite.setDepth(spriteDepth);
        sprite.setVisible(true).setPosition(spriteX,spriteY)
          .setFlipX(downed?.flipX ?? recoil?.flipX ?? facing===3);
        view.weapon.setVisible(!!pose);
        if (pose && swing && profile) {
          view.weapon.setTexture(`weapon-${swing.weapon}`).setOrigin(profile.grip,.5)
            .setScale(profile.size/view.weapon.width).setPosition(x+pose.handX,y+pose.handY)
            .setRotation(pose.angle).setDepth(y+(facing===2 ? -.1 : .1));
        }
        label.setVisible(true).setPosition(x,labelY).setText(latest.pocketing ? `▣ ${player.nick}` : player.phone ? `${player.phone==='game' ? '🎮' : '☎'} ${player.nick}` : player.nick);
        const nameColor = player.npc ? '#b8c0bf' : latest.knockedOut ? '#ffbf9f' : '#fff7df';
        // Phaser redraws and uploads the text texture on every setColor call.
        if (label.style.color!==nameColor) label.setColor(nameColor);
        const exposed = latest.exposed ?? [];
        const concealed = own && !!plenaryView?.gameplay?.concealmentSeconds;
        const itemsKey = `${concealed}:${exposed.map(item=>item.kind).join(',')}`;
        if (view.itemsKey!==itemsKey) {
          view.itemsKey = itemsKey;
          view.items.removeAll(true);
          exposed.forEach(({kind},index)=>{
            const offset = (index-(exposed.length-1)/2)*13;
            const backdrop = this.add.rectangle(offset,0,11.5,11.5,0x10211b,.84).setStrokeStyle(.5,0x637f6d);
            const icon = this.add.image(offset,0,`item-${kind}`).setDisplaySize(10,10);
            if (concealed && cashAmount(kind)) {
              backdrop.setAlpha(.38);
              icon.setAlpha(.38);
            }
            view.items.add([backdrop,icon]);
          });
        }
        view.items.setPosition(x,latest.carried ? spriteY-12 : latest.knockedOut ? y-12 : spriteY-44).setVisible(!!exposed.length);
        const title = titles.get(id);
        office.setVisible(running || !!title).setPosition(x,labelY+6)
          .setText(latest.carried ? 'Em transporte' : latest.carrying ? 'Carregando' : latest.knockedOut ? 'Nocauteado' : latest.former ? 'Ex-parlamentar' : 'Parlamentar');
        const officeColor = latest.former ? '#e6a38c' : '#cbd6db';
        if (office.style.color!==officeColor) office.setColor(officeColor);
        if (moving && !pose && !combatArt) {
          sprite.play(`${character}-${row}`,true);
          sprite.anims.timeScale = player.sprinting ? sprintMultiplier : 1;
        } else {
          sprite.anims.stop();
          sprite.setTexture(combatArt?.key ?? sheet.key,combatArt?.frame ?? frame+row*4);
        }
        if (own) {
          if (this.marker.depth!==y-1) this.marker.setDepth(y-1);
          this.marker.setPosition(spriteX,latest.carried ? y-2 : spriteY-2).setVisible(true);
          if (inSession) {
            camera.centerOn(plenaryCameraCenter.x,plenaryCameraCenter.y);
          } else camera.centerOn(x,y);
          for (const part of [sprite,view.weapon,view.items,label,office]) {
            if (part.depth!==HEIGHT+91) part.setDepth(HEIGHT+91);
          }
          this.fog.clear().setVisible(running);
          penumbra.hidden = !running || inSession;
          if (running && inSession) {
            const [left,top,width,height] = PLENARY_BOUNDS;
            const edge = 4000;
            this.fog.fillStyle(0x000000,.66)
              .fillRect(-edge,-edge,edge*2,top+edge)
              .fillRect(-edge,top,left+edge,height)
              .fillRect(left+width,top,edge-left-width,height)
              .fillRect(-edge,top+height,edge*2,edge-top-height);
          } else if (running) {
            const wallX = Math.round(x), wallY = Math.round(y), radius = Math.round(this.drawnVisionRadius);
            const barriers = JSON.stringify(ownPlayer?.barriers ?? []);
            const cached = this.fogGeometry;
            if (!cached || cached.x!==wallX || cached.y!==wallY || cached.radius!==radius || cached.barriers!==barriers) {
              this.fogGeometry = {x:wallX,y:wallY,radius,barriers,
                points:wallVision({x:wallX,y:wallY,barriers:ownPlayer?.barriers},radius)};
            }
            this.fog.fillStyle(0x000000,.62);
            const {points} = this.fogGeometry!;
            const screenX = (wallX-camera.scrollX-camera.width/2)*cssZoom+camera.width/2/density;
            const screenY = (wallY-camera.scrollY-camera.height/2)*cssZoom+camera.height/2/density;
            const edge = radius*cssZoom;
            penumbra.style.background = `radial-gradient(circle at ${screenX}px ${screenY}px, transparent ${edge*.84}px, rgba(0,0,0,.62) ${edge*.99}px)`;
            penumbra.style.clipPath = `polygon(${points.map(point=>`${screenX+point.x*cssZoom}px ${screenY+point.y*cssZoom}px`).join(',')})`;
            const [first,...outline] = shadowOutline(points,wallX,wallY,4000);
            this.fog.beginPath().moveTo(first.x,first.y);
            for (const point of outline) this.fog.lineTo(point.x,point.y);
            this.fog.closePath().fillPath();
          }
        }
      }
      this.drawXray(time,ownPlayer,visionRadius);
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
    crossDoor(door:number) {
      stop();
      destination = undefined;
      local.input({door});
    },
    setGroundItems(items:GroundItem[], installed:Decoration[]) { groundItems = items; decorations = installed; },
    drawPhoto(canvas:HTMLCanvasElement, captured?:PhotoScene) {
      if (!scene.sys.isActive() || !scene.photoRenderer) return;
      if (captured) {
        scene.photoRenderer.draw(canvas,captured);
        return;
      }
      const player = players.find(person=>person.id===ownId);
      if (!player) return;
      const center = local.state?.player ?? player;
      const breaches = plenaryView?.gameplay?.offices?.flatMap(office=>{
        const layout = privateOffices.find(layout=>layout.id===office.id);
        return layout ? [...(office.door==='breached' ? [officeDoorPoint(layout)] : []),
          ...(office.cabinetBreached ? [layout.cabinet] : [])] : [];
      }).filter(point=>inPhotoFrame(center,point));
      scene.photoRenderer.draw(canvas,{
        center,breaches,
        people:players.filter(person=>person.id!==ownId && inPhotoFrame(center,person,true)).map(person=>({
          ...person,name:person.nick,
        })),
        ground:groundItems.filter(item=>inPhotoFrame(center,item)),
        decorations:decorations.filter(item=>inPhotoFrame(center,item)),
      });
    },
    pulseStation(key:Station) { if (scene.sys.isActive()) scene.pulseStation(key); },
    playerHead() { return scene.sys.isActive() ? scene.playerHead() : undefined; },
    clearPrivateVision() { plenaryView = undefined; },
    setPlenaryView(view:PlenaryView) { plenaryView = view; },
    reconcile(snapshot: ControlState) {
      const before = local.state;
      const reset = before?.revision!==snapshot.revision || !!before?.plenary!==!!snapshot.plenary ||
        !!before?.isolated!==!!snapshot.isolated;
      if (reset) {
        stop();
        destination = undefined;
        manual = false;
        history.clear();
      }
      local.reconcile(snapshot);
      const after = local.state!;
      if (!before || reset) {
        const sprite = scene.sys.isActive() ? scene.localSprite() : undefined;
        sprite?.setPosition(after.player.x,after.player.y);
      }
    },
    setMatchPhase(phase:Phase) {
      inLobby = phase==='lobby';
      if (scene.sys.isActive()) scene.cameras.main.setVisible(!inLobby);
      negotiating = phase==='negotiation';
      running = negotiating || phase==='ballot' || phase==='hearing';
      if (!running) {
        scene.fog?.setVisible(false);
        penumbra.hidden = true;
      }
    },
    setOffices(assignments:Assignment[]) { titles = new Map(assignments.map(({id,office}) => [id,office])); },
    destroy() {
      listeners.abort();
      resizeObserver?.disconnect();
      penumbra.remove();
      game.destroy(true);
    },
  };
}
