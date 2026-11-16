import { stationRecharge, type RechargeStation } from './station-recharge';
import { createInteractionOutline, hitInteractionArt } from './interaction-outline';
import {plenaryCameraCenter,plenaryZoom} from './plenary-camera';
import {wallVision} from './visibility';
import {fireOptions,fireSites,type FireAction} from './fire';
import {createRoomFires} from './fire-effects';
import { isOfficeFurniture, officeDoorPoint, officeFixtures, officeFurniture, privateOffices } from './private-offices';
import type { CombatCue } from './game-audio';
import { playBloodImpact, playComicImpact } from './comic-impact';
import { weaponPose, weapons } from './weapons';
import { mapNpcs, type NpcId } from './npcs';
import { binoculars, xray } from './equipment';
import { cashAmount, objects, treasuryDeliveries, type GroundItem, type GameplayAction } from './gameplay';
import { hudConsumesKeys } from './game-keys';
import Phaser from 'phaser';
import { attackArt, characterArt, characterSheets, combatSheets, downedArt, hitArt } from './character-art';
import type { Assignment, Office } from './elections';
import { agendaProject, bills, stations, type Phase, type PlenaryView, type Station } from './plenary';
import { drawMap } from './draw-map';
import { decorationLabel, itemSymbols, PhotoRenderer } from './photo-renderer';
import { inPhotoFrame, type Decoration, type PhotoScene } from './photography';
import { PlayerHistory, PredictedMovement } from './network-movement';
import { restMovement, STEP_MS, type ControlState, type MovementInput } from './movement';
import { furnishings, HEIGHT, inPlenary, localPerception, characterVisible, worldVisible, NAMES, PLENARY_BOUNDS, PLENARY_DOORS, sprintMultiplier, VISION_RADIUS, WIDTH, type Motion, type Player } from './map';

type View = { sprite: Phaser.GameObjects.Sprite; label: Phaser.GameObjects.Text; office: Phaser.GameObjects.Text; items:Phaser.GameObjects.Container; itemsKey?:string; nextStep:number; lastHit?:number; flashUntil?:number; hitAt?:number; fallAt?:number; weapon:Phaser.GameObjects.Image; briefcase?:Phaser.GameObjects.Image; swingAt?:number; swingStarted?:number };
// Grip coordinates in the original 128 px frames, ordered front, profile, back.
type Grip = readonly [x:number,y:number];
type WalkGrips = readonly [Grip,Grip,Grip,Grip];
const briefcaseGrip = {
  Lula: [[[85,101],[91,94],[85,101],[88,85]],[[57,102],[82,89],[57,102],[78,88]],[[38,100],[39,95],[38,100],[40,89]]],
  Bolsonaro: [[[83,103],[86,97],[83,103],[87,87]],[[57,104],[85,90],[57,104],[82,89]],[[41,103],[41,99],[41,103],[43,94]]],
  Clodovil: [[[90,101],[95,94],[90,101],[87,91]],[[56,103],[81,84],[56,103],[81,84]],[[34,101],[36,96],[34,101],[36,96]]],
  Tiririca: [[[85,104],[89,95],[85,104],[80,91]],[[58,103],[86,88],[58,103],[87,87]],[[41,105],[38,98],[41,105],[39,91]]],
  'Eduardo Cunha': [[[94,100],[95,95],[94,100],[88,92]],[[54,104],[84,86],[54,104],[84,86]],[[35,101],[34,98],[35,101],[34,98]]],
  'Alexandre Frota': [[[92,106],[94,92],[92,106],[87,91]],[[54,105],[83,85],[54,105],[83,85]],[[34,106],[34,96],[34,106],[34,96]]],
  'Sergio Moro': [[[85,106],[87,99],[85,106],[82,92]],[[55,105],[85,90],[55,105],[84,89]],[[43,106],[40,100],[43,106],[43,94]]],
  'Inês Brasil': [[[94,100],[98,95],[94,100],[92,89]],[[65,100],[89,79],[65,100],[89,79]],[[38,101],[32,94],[38,101],[32,94]]],
} satisfies Record<(typeof NAMES)[number],readonly [WalkGrips,WalkGrips,WalkGrips]>;

const rechargeFixtures = (Object.keys(stationRecharge) as RechargeStation[]).flatMap(station=>{
  const {texture,duration} = stationRecharge[station];
  const fixture = furnishings.find(item=>'texture' in item && item.texture===texture);
  if (!fixture) return [];
  const [left,top,width,height] = fixture.area;
  return [{station,duration,point:{x:left+width/2,y:top+height},top}];
});

function drawProgressBar(graphics:Phaser.GameObjects.Graphics, centerX:number, y:number, fraction:number) {
  const x = centerX-15;
  graphics.fillStyle(0x211a10,.95).fillRoundedRect(x,y,30,5,2);
  graphics.lineStyle(.75,0xffdb83).strokeRoundedRect(x,y,30,5,2);
  graphics.fillStyle(0xffcf4b).fillRect(x+1.5,y+1.5,27*fraction,2);
}

const stationColor = 0x79ebdf;
const directions = new Map(Object.entries({
  arrowleft:[-1,0], a:[-1,0], arrowright:[1,0], d:[1,0],
  arrowup:[0,-1], w:[0,-1], arrowdown:[0,1], s:[0,1],
}));

export function createGame(parent: HTMLElement, ownId: string, send: (input: MovementInput) => void, footstep:(level:number,pan:number)=>void,
  combatSound:(cue:CombatCue,level:number,pan:number)=>void, interact:(action:GameplayAction)=>void, actOnFire:(action:{kind:FireAction;site:number})=>void, inspect:(id:number)=>void, openStash:()=>void, loading:(progress:number)=>void) {
  const campaignControl = document.querySelector<HTMLButtonElement>('#election-actions')!;
  let players: Player[] = [];
  let groundItems: GroundItem[] = [];
  let decorations: Decoration[] = [];
  let inLobby = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let negotiating = false;
  let plenaryView:PlenaryView | undefined;
  let plenaryViewReceivedAt = 0;
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
    private mapProgress!: Phaser.GameObjects.Graphics;
    private officeDoors!: Phaser.GameObjects.Graphics;
    private officeRenderKey:string|undefined = '';
    private doors!: Phaser.GameObjects.Graphics;
    private board!: Phaser.GameObjects.Text;
    private views = new Map<string,View>();
    private groundMarkers = new Map<number,Phaser.GameObjects.Container>();
    private renderedGround?:GroundItem[];
    private renderedDecorations?:Decoration[];
    private installed = new Map<number,{marker:Phaser.GameObjects.Container; label?:Phaser.GameObjects.Text; mark?:Phaser.GameObjects.Text}>();
    photoRenderer?:PhotoRenderer;
    private interactionTargets = new Map<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text,{
      outline:Phaser.GameObjects.Image;
      ready:()=>boolean;
      run:()=>void;
    }>();

    private registerInteraction(art:Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text,
      ready:()=>boolean,run:()=>void,container?:Phaser.GameObjects.Container) {
      const outline = createInteractionOutline(this,art);
      if (container) container.addAt(outline,container.getIndex(art));
      else outline.setDepth(art.depth-.01);
      this.interactionTargets.set(art,{outline,ready,run});
      art.once('destroy',()=>this.interactionTargets.delete(art));
    }
    private mapLabels:Phaser.GameObjects.Text[] = [];
    private textResolution = 3;
    private safeFraction = 0;
    private drawnVisionRadius = VISION_RADIUS;
    fog!:Phaser.GameObjects.Graphics;
    hideFogEdge() { this.fogEdge?.setVisible(false); }

    private fogEdge!:Phaser.GameObjects.Image;
    private fogTexture!:Phaser.Textures.CanvasTexture;
    private fogInSession = false;
    private fogGeometry?: {x:number;y:number;radius:number;barriers:string;points:ReturnType<typeof wallVision>};
    private roomFires!:ReturnType<typeof createRoomFires>;
    private marker!: Phaser.GameObjects.Ellipse;
    private npcViews:{sprite:Phaser.GameObjects.Sprite;label?:Phaser.GameObjects.Text}[] = [];


    private assetsFailed = false;

    preload() {
      this.load.on('progress',(value:number)=>loading(value*.99));
      this.load.on('loaderror',()=>{ this.assetsFailed = true; loading(-1); });
      const lobbyArt = ['logo-infiltrados.webp','sala-articulacao.webp','congress-saved.webp','congress-destroyed.webp',...bills.flatMap(bill=>bill.banner ? [bill.banner] : [])];
      for (const npc of Object.values(mapNpcs)) if ('portrait' in npc) lobbyArt.push(npc.portrait);
      for (const asset of lobbyArt) this.load.image(`preload-${asset}`,`${import.meta.env.BASE_URL}assets/${asset}`);

      this.load.image('cash-briefcase',import.meta.env.BASE_URL+'assets/maleta-social.png');
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
      if (this.assetsFailed) return;
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
      this.mapLabels = drawMap(this,(art,office,kind)=>{
        const stash = ()=>kind==='cabinet' && plenaryView?.gameplay?.officeStash?.id===office.id;
        const option = ()=>plenaryView?.gameplay?.officeOptions?.find(action=>action.place===office.id &&
          (kind==='safe' ? ['office-cash','office-breach-safe','office-upgrade-safe'].includes(action.kind) :
            ['office-breach-cabinet','office-upgrade-cabinet'].includes(action.kind)));
        this.registerInteraction(art,()=>!!stash() || !!option(),()=>{
          if (stash()) openStash();
          else {
            const action = option();
            if (action) interact(action);
          }
        });
      },desk=>this.registerInteraction(desk,()=>!campaignControl.disabled,()=>campaignControl.click()));
      this.fog = this.add.graphics().setDepth(3);
      this.fogTexture = this.textures.createCanvas('vision-penumbra',512,512)!;
      this.fogEdge = this.add.image(0,0,this.fogTexture.key).setDepth(3).setVisible(false);
      this.photoRenderer = new PhotoRenderer(this.textures);
      this.children.depthSort();
      this.photoRenderer.loadMap(this.children.getChildren());
      const hasExtinguisher = ()=>!!plenaryView?.gameplay?.inventory.some(item=>item.kind==='extinguisher');
      this.roomFires = createRoomFires(this);
      const extinguishOption = (site:number)=>{
        const player = local.state?.player;
        if (!player || plenaryView?.fire?.site!==site) return;
        return fireOptions(player,plenaryView.fire,undefined,hasExtinguisher());
      };
      this.roomFires.forEach(({flame},site)=>{
        this.registerInteraction(flame,()=>!!extinguishOption(site),()=>{
          const option = extinguishOption(site);
          if (option) actOnFire(option);
        });
      });
      this.officeDoors = this.add.graphics().setDepth(2);
      this.mapProgress = this.add.graphics().setDepth(HEIGHT+31);
      for (const office of privateOffices) {
        const [doorX,doorY,doorWidth,doorHeight] = office.door;
        this.add.text(doorX+doorWidth+3,doorY+doorHeight/2,office.id.padStart(2,'0'),{
          fontFamily:'system-ui',fontSize:'3.2px',color:'#eee0ba',backgroundColor:'#152720',
          align:'left',padding:{x:1.5,y:.5},resolution:4,
        }).setOrigin(0,.5).setDepth(2);
      }
      this.doors = this.add.graphics().setDepth(1);
      for (const [x,y,w,h] of PLENARY_DOORS) {
        this.doors.fillStyle(0x774740).fillRect(x,y,w,h).fillStyle(0xe8aa75).fillRect(x,y+2,w,2);
      }
      this.board = this.add.text(480,562,'',{
        fontFamily:'system-ui',fontSize:'7px',color:'#d6ffd0',backgroundColor:'#111e19',
        align:'center',padding:{x:4,y:2},resolution:3,
      }).setOrigin(.5,0).setDepth(HEIGHT+10);
      this.npcViews = Object.entries(mapNpcs).map(([id,npc])=>{
        const sprite = this.add.sprite(npc.x,npc.y,`npc-${id}`);
        sprite.setOrigin(.5,1).setDisplaySize(38,38).setDepth(npc.y);
        const label = id==='treasurer' && 'counter' in npc ? this.add.text(npc.x,npc.counter.y+24,npc.name,{
          fontFamily:'system-ui',fontSize:'7px',color:'#ffe4a1',backgroundColor:'#142820bb',
          padding:{x:3,y:1},resolution:3,
        }).setOrigin(.5,0).setDepth(1) : undefined;
        if (id==='treasurer') {
          const delivery = ()=>treasuryDeliveries(plenaryView?.gameplay?.inventory ?? [])[0]?.action;
          this.registerInteraction(sprite,()=>!!plenaryView?.gameplay?.locations.includes('treasury') && !!delivery(),()=>{
            const action = delivery();
            if (action) interact(action);
          });
        } else {
          const target = id as NpcId;
          this.registerInteraction(sprite,()=>!!plenaryView?.gameplay?.npcNearby?.includes(target),()=>interact({kind:'open-shop',target}));
        }
        return {sprite,label};
      });
      this.marker = this.add.ellipse(0,0,19,6,0x09110e,.34).setVisible(false);
      this.input.on('pointerdown',(pointer: Phaser.Input.Pointer) => {
        parent.focus({preventScroll:true});
        keys.clear();
        shiftKeys.clear();
        manual = false;
        const {x,y} = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        const target = [...this.interactionTargets].filter(([art,{outline}])=>outline.visible && art.visible)
          .sort(([a],[b])=>(b.parentContainer?.depth ?? b.depth)-(a.parentContainer?.depth ?? a.depth))
          .find(([art])=>hitInteractionArt(art,x,y));
        if (target) {
          destination = undefined;
          target[1].run();
          return;
        }
        if (x>=0 && x<WIDTH && y>=0 && y<HEIGHT) {
          destination = {x,y};
          nextStep = -Infinity;
        }
      });
      loading(1);
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
        this.registerInteraction(icon,()=>!!plenaryView?.gameplay?.nearby.some(entry=>entry.id===item.id),
          ()=>interact({kind:'collect',item:item.id}),marker);
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
          const marker = this.add.container(item.x,item.y,[art]).setDepth(item.kind==='officeRug' ? .5 : 2.5);
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
        this.registerInteraction(art,()=>!!plenaryView?.gameplay?.interactive.some(entry=>entry.id===item.id),
          ()=>inspect(item.id),marker);
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
      if (this.assetsFailed || inLobby) return;
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
          const sent = local.input({motion,sprint});
          manual = keys.size>0 || !sent;
        } else if (local.state.route.length) {
          local.input({sprint});
        } else {
          restMovement(local.state.player);
        }
      }
      this.renderGroundItems();
      this.renderDecorations();
      const officeViews = plenaryView?.gameplay?.offices;
      const officeKey = JSON.stringify(officeViews);
      if (officeKey!==this.officeRenderKey) {
        this.officeRenderKey = officeKey;
        this.officeDoors.clear();
        for (const layout of privateOffices) {
          const office = officeViews?.find(entry=>entry.id===layout.id);
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
      this.mapProgress.clear();
      const channel = plenaryView?.gameplay?.officeChannel;
      if (!negotiating || channel?.kind!=='office-cash') this.safeFraction = 0;
      if (negotiating && channel?.kind==='office-cash') {
        const safe = privateOffices.find(office=>office.id===channel.officeId)?.safe;
        if (safe) {
          const {height,footOffset} = officeFixtures.safe;
          const y = safe.y-footOffset-height-8;
          const fraction = Phaser.Math.Clamp(channel.elapsed/channel.duration,0,1);
          this.safeFraction = reducedMotion.matches || fraction<this.safeFraction ? fraction :
            Phaser.Math.Linear(this.safeFraction,fraction,1-Math.exp(-delta/45));
          drawProgressBar(this.mapProgress,safe.x,y,this.safeFraction);
        }
      }
      const now = performance.now();
      const ownPlayer = local.state?.player;
      const visionRadius = VISION_RADIUS*(plenaryView?.gameplay?.binocularSeconds ? binoculars.multiplier : 1);
      const cooldowns = plenaryView?.gameplay?.stationCooldowns;
      if (negotiating && ownPlayer && cooldowns) {
        for (const {station,duration,point,top} of rechargeFixtures) {
          const remaining = (cooldowns[station] ?? 0)-(now-plenaryViewReceivedAt);
          if (remaining>0 && localPerception(ownPlayer,point,visionRadius).visible) {
            drawProgressBar(this.mapProgress,point.x,top-8,Phaser.Math.Clamp(1-remaining/duration,0,1));
          }
        }
      }
      const gap = visionRadius-this.drawnVisionRadius;
      this.drawnVisionRadius = !negotiating || reducedMotion.matches || Math.abs(gap)<.1
        ? visionRadius : this.drawnVisionRadius+gap*(1-Math.exp(-delta/105));
      const fire = plenaryView?.fire;
      this.roomFires.forEach((effect,site)=>{
        const active = negotiating && fire?.site===site && !fire.paused;
        const visible = active && !!ownPlayer && localPerception(ownPlayer,fireSites[site],this.drawnVisionRadius).visible;
        effect.update(time,active,visible,reducedMotion.matches);
      });
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
      for (const [art,{outline,ready}] of this.interactionTargets) {
        outline.setVisible(negotiating && art.visible && ready());
      }

      for (const [id,view] of this.views) {
        if (!players.some(player => player.id===id)) {
          view.sprite.destroy();
          view.label.destroy();
          view.office.destroy();
          view.items.destroy();
          view.weapon.destroy();
          view.briefcase?.destroy();
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
        const {id,character,direction} = player;
        const {sheet,frame} = characterArt(character);
        let view = this.views.get(id);
        if (running && !own && ownPlayer && (inSession ? !inPlenary(player) : !characterVisible(ownPlayer,player,this.drawnVisionRadius))) {
          view?.sprite.setVisible(false);
          view?.label.setVisible(false);
          view?.office.setVisible(false);
          view?.items.setVisible(false);
          view?.weapon.setVisible(false);
          view?.briefcase?.setVisible(false);
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
        const distance = Math.hypot(sprite.x-player.x,sprite.y-player.y);
        const blend = own && distance>.1 && distance<40 ? 1-Math.exp(-delta/35) : 1;
        const x = Phaser.Math.Linear(sprite.x,player.x,blend);
        const y = Phaser.Math.Linear(sprite.y,player.y,blend);
        const moving = player.moving && Math.hypot(x-sprite.x,y-sprite.y)>.015;
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
        const opacity = latest.knockedOut && !latest.carried ? .68 :
          latest.recoveryProtected && (reducedMotion.matches || Math.floor(time/150)%2===0) ? .4 : 1;
        sprite.setOrigin(.5,downed?.originY ?? 1).setRotation(downed?.rotation ?? (recoil ? 0 : pose?.lean ?? 0))
          .setAlpha(opacity);
        const spriteDepth = y+(latest.carried ? 1 : 0);
        if (sprite.depth!==spriteDepth) sprite.setDepth(spriteDepth);
        sprite.setVisible(true).setPosition(spriteX,spriteY)
          .setFlipX(downed?.flipX ?? recoil?.flipX ?? facing===3);
        view.weapon.setVisible(!!pose);
        if (pose && swing && profile) {
          view.weapon.setTexture(`weapon-${swing.weapon}`).setOrigin(profile.grip,.5)
            .setScale(profile.size/view.weapon.width).setPosition(x+pose.handX,y+pose.handY)
            .setRotation(pose.angle).setDepth(y+(facing===2 ? -.1 : .1));
        }
        const name = player.npc ? NAMES[character] ?? player.nick : player.nick;
        label.setVisible(true).setPosition(x,labelY).setText(latest.pocketing ? `▣ ${name}` : player.phone ? `${player.phone==='game' ? '🎮' : '☎'} ${name}` : name);
        const nameColor = player.npc ? '#b8c0bf' : latest.knockedOut ? '#ffbf9f' : '#fff7df';
        // Phaser redraws and uploads the text texture on every setColor call.
        if (label.style.color!==nameColor) label.setColor(nameColor);
        const grip = briefcaseGrip[NAMES[character]]?.[row];
        const exposed = grip ? (latest.exposed ?? []).filter(item=>!cashAmount(item.kind)) : latest.exposed ?? [];
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
        if (grip && latest.cashInHand && !pose && !combatArt) {
          const walkFrame = typeof sprite.frame.name==='number' ? sprite.frame.name%4 : 0;
          const [handX,handY] = grip[walkFrame];
          const briefcase = view.briefcase ??= this.add.image(0,0,'cash-briefcase').setOrigin(.5,.12).setScale(12/128);
          const side = facing===3 ? -1 : 1;
          briefcase.setPosition(spriteX+(handX-64)*sprite.scaleX*side,spriteY+(handY-128)*sprite.scaleY)
            .setFlipX(facing===3).setAlpha(concealed ? .38*opacity : opacity).setVisible(true)
            .setDepth(spriteDepth+.1);
        } else view.briefcase?.setVisible(false);
        if (own) {
          if (this.marker.depth!==y-1) this.marker.setDepth(y-1);
          this.marker.setPosition(spriteX,latest.carried ? y-2 : spriteY-2).setVisible(true);
          if (inSession) {
            camera.centerOn(plenaryCameraCenter.x,plenaryCameraCenter.y);
          } else camera.centerOn(x,y);
          for (const part of [view.items,label,office]) {
            if (part.depth!==HEIGHT+91) part.setDepth(HEIGHT+91);
          }
          this.fog.setVisible(running);
          this.fogEdge.setVisible(running && !inSession);
          if (running && inSession && !this.fogInSession) {
            this.fogInSession = true;
            this.fogGeometry = undefined;
            this.fog.clear();
            const [left,top,width,height] = PLENARY_BOUNDS;
            const edge = 4000;
            this.fog.fillStyle(0x000000,.66)
              .fillRect(-edge,-edge,edge*2,top+edge)
              .fillRect(-edge,top,left+edge,height)
              .fillRect(left+width,top,edge-left-width,height)
              .fillRect(-edge,top+height,edge*2,edge-top-height);
          } else if (running && !inSession) {
            this.fogInSession = false;
            const wallX = Math.round(x), wallY = Math.round(y), radius = Math.round(this.drawnVisionRadius);
            const barriers = JSON.stringify(ownPlayer?.barriers ?? []);
            const cached = this.fogGeometry;
            if (!cached || cached.x!==wallX || cached.y!==wallY || cached.radius!==radius || cached.barriers!==barriers) {
              this.fogGeometry = {x:wallX,y:wallY,radius,barriers,
                points:wallVision({x:wallX,y:wallY,barriers:ownPlayer?.barriers},radius)};
              const {points} = this.fogGeometry;
              const size = this.fogTexture.width;
              const center = size/2;
              const half = radius + 2;
              const scale = center/half;
              const ctx = this.fogTexture.context;
              ctx.clearRect(0,0,size,size);
              ctx.fillStyle = 'rgba(0,0,0,.62)';
              ctx.fillRect(0,0,size,size);
              ctx.save();
              ctx.globalCompositeOperation = 'destination-out';
              const edge = radius*scale;
              const gradient = ctx.createRadialGradient(center,center,edge*.84,center,center,edge);
              gradient.addColorStop(0,'black');
              gradient.addColorStop(1,'transparent');
              ctx.fillStyle = gradient;
              ctx.beginPath();
              for (const point of points) ctx.lineTo(center+point.x*scale,center+point.y*scale);
              ctx.closePath();
              ctx.fill();
              ctx.restore();
              this.fogTexture.refresh();
              this.fogEdge.setPosition(wallX,wallY).setDisplaySize(half*2,half*2);

              const left = wallX-half, top = wallY-half, right = wallX+half, bottom = wallY+half;
              const extent = 4000;
              this.fog.clear().fillStyle(0x000000,.62)
                .fillRect(-extent,-extent,extent*2,top+extent)
                .fillRect(-extent,top,left+extent,half*2)
                .fillRect(right,top,extent-right,half*2)
                .fillRect(-extent,bottom,extent*2,extent-bottom);
            }
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
    setPlenaryView(view:PlenaryView) {
      plenaryView = view;
      plenaryViewReceivedAt = performance.now();
    },
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
        scene.hideFogEdge();
      }
    },
    setOffices(assignments:Assignment[]) { titles = new Map(assignments.map(({id,office}) => [id,office])); },
    destroy() {
      listeners.abort();
      resizeObserver?.disconnect();
      game.destroy(true);
    },
  };
}
