import {sprintDust} from './sprint-dust';
import { stationRecharge, type RechargeStation } from './station-recharge';
import { createInteractionOutline, hitInteractionArt } from './interaction-outline';
import {plenaryCameraCenter,plenaryZoom} from './plenary-camera';
import {wallVision} from './visibility';
import {canActOnFire,fireSites,type ExtinguishEffect,type FireCommand} from './fire';
import {createRoomFires,createFuseSmoke,createExtinguishEffect,showSafeExplosion} from './fire-effects';
import {powerOption,powerRules,type PowerAction} from './power';
import { decorPoint, depositingAtSafe, officeDoorPoint, officeFixtures, privateOffices } from './private-offices';
import type { CombatCue } from './game-audio';
import { playBloodImpact, playComicImpact } from './comic-impact';
import { npcEnabled, mapNpcs, type NpcId } from './npcs';
import { binoculars, xray } from './equipment';
import { treasuryDeliveries, type GroundItem, type GameplayAction } from './gameplay';
import { hudConsumesKeys } from './game-keys';
import Phaser from 'phaser';
import {projectWorldSnapshot} from './world-snapshot';
import { agendaProject, bills, stations, type Phase, type PlenaryView, type Station } from './plenary';
import { installationArt, installationSites } from './installations';
import { drawMap, updateSafeArt } from './draw-map';
import { PhotoRenderer } from './photo-renderer';
import {preloadWorldArt,createWorldAnimations,createActorView,updateActorView,createGroundArt,createDecorationArt,decorationLabel,createInstallationFrame,createMapNpc,drawOfficeState,type ActorView} from './world-art';
import { inPhotoFrame, type Decoration, type PhotoScene } from './photography';
import { PlayerHistory, PredictedMovement } from './network-movement';
import { restMovement, STEP_MS, type ControlState, type MovementInput } from './movement';
import { furnishings, HEIGHT, inPlenary, localPerception, characterVisible, worldVisible, PLENARY_BOUNDS, PLENARY_DOORS, sprintMultiplier, VISION_RADIUS, WIDTH, type Motion, type Player } from './map';

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
  combatSound:(cue:CombatCue,level:number,pan:number)=>void, interact:(action:GameplayAction)=>void, actOnFire:(action:FireCommand)=>void, actOnPower:(action:PowerAction)=>void, inspect:(id:number)=>void, openStash:()=>void, openSecurity:()=>void, loading:(progress:number)=>void) {
  let players: Player[] = [];
  let worldSnapshot = projectWorldSnapshot();
  let phase:Phase = 'lobby';
  let phoneInset = 0;
  let inLobby = true;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  let negotiating = false;
  let plenaryView:PlenaryView | undefined;
  let plenaryViewReceivedAt = 0;
  let running = false;
  let resizeObserver:ResizeObserver | undefined;
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
  const movementPaused = () => plenaryView?.ballotCountdown!==undefined;
  document.addEventListener('keydown', event => {
    if (movementPaused() || event.defaultPrevented || event.isComposing || event.ctrlKey || event.altKey || event.metaKey ||
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
    private views = new Map<string,ActorView>();
    private groundMarkers = new Map<number,Phaser.GameObjects.Container>();
    private renderedGround?:readonly GroundItem[];
    private renderedDecorations?:readonly Decoration[];
    private installed = new Map<number,{marker:Phaser.GameObjects.Container; label?:Phaser.GameObjects.Text; mark?:Phaser.GameObjects.Text}>();
    photoRenderer?:PhotoRenderer;
    private interactionTargets = new Map<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text,{
      outline:Phaser.GameObjects.Image;
      ready:()=>boolean;
      run:()=>void;
      hit:(x:number,y:number)=>boolean;
    }>();

    private registerInteraction(art:Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Text,
      ready:()=>boolean,run:()=>void,container?:Phaser.GameObjects.Container,
      hit = (x:number,y:number)=>hitInteractionArt(art,x,y)) {
      const outline = createInteractionOutline(this,art);
      if (container) container.addAt(outline,container.getIndex(art));
      else outline.setDepth(art.depth-.01);
      this.interactionTargets.set(art,{outline,ready,run,hit});
      art.once('destroy',()=>this.interactionTargets.delete(art));
    }
    private installationFixtures: {point:Motion; art:Phaser.GameObjects.Image}[] = [];
    private mapLabels:Phaser.GameObjects.Text[] = [];
    private securityTerminal?:Phaser.GameObjects.Image;
    private textResolution = 3;
    private safeFraction = 0;
    private safeArt = new Map<string,Phaser.GameObjects.Image>();
    private drawnVisionRadius = VISION_RADIUS;
    fog!:Phaser.GameObjects.Graphics;
    hideFogEdge() { this.fogEdge?.setVisible(false); }

    private fogEdge!:Phaser.GameObjects.Image;
    private fogTexture!:Phaser.Textures.CanvasTexture;
    private fogInSession = false;
    private fogGeometry?: {x:number;y:number;radius:number;barriers:string;points:ReturnType<typeof wallVision>};
    private roomFires!:ReturnType<typeof createRoomFires>;
    extinguishEffect!:ReturnType<typeof createExtinguishEffect>;
    private fuseSmoke!:ReturnType<typeof createFuseSmoke>;
    private marker!: Phaser.GameObjects.Ellipse;
    private npcViews:{id:string;sprite:Phaser.GameObjects.Sprite;label?:Phaser.GameObjects.Text}[] = [];


    private assetsFailed = false;

    preload() {
      this.load.on('progress',(value:number)=>loading(value*.99));
      this.load.on('loaderror',()=>{ this.assetsFailed = true; loading(-1); });
      const lobbyArt = ['logo-infiltrados.webp','sala-articulacao.webp','congress-saved.webp','congress-destroyed.webp',...bills.map(bill=>bill.icon)];
      for (const npc of Object.values(mapNpcs)) if ('portrait' in npc) lobbyArt.push(npc.portrait);
      for (const asset of lobbyArt) this.load.image(`preload-${asset}`,`${import.meta.env.BASE_URL}assets/${asset}`);

      preloadWorldArt(this);
    }
    private tutorialMarker?:Phaser.GameObjects.Graphics;
    create() {
      if (this.assetsFailed) return;
      this.cameras.main.setVisible(!inLobby);
      createWorldAnimations(this);
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
        if (kind==='safe') this.safeArt.set(office.id,art);
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
      },art=>{
        this.securityTerminal = art;
        this.registerInteraction(art,()=>plenaryView?.surveillanceEnabled!==false && !!plenaryView?.gameplay?.security,openSecurity);
      },(fixture,panel)=>{
        const option = ()=>{
          const player = local.state?.player;
          if (!player || !running || !plenaryView?.gameplay || plenaryView.ballotCountdown!==undefined) return;
          return powerOption(player,panel,plenaryView.outage,plenaryView.canSabotagePower);
        };
        this.registerInteraction(fixture,()=>!!option(),()=>{
          const action = option();
          if (action) actOnPower(action);
        });
      });
      this.fog = this.add.graphics().setDepth(3);
      this.fogTexture = this.textures.createCanvas('vision-penumbra',512,512)!;
      this.fogEdge = this.add.image(0,0,this.fogTexture.key).setDepth(3).setVisible(false);
      this.photoRenderer = new PhotoRenderer(this);
      this.events.once('shutdown',()=>this.photoRenderer?.destroy());
      this.roomFires = createRoomFires(this);
      this.fuseSmoke = createFuseSmoke(this);
      this.extinguishEffect = createExtinguishEffect(this);
      const extinguishOption = (site:number)=>{
        const player = local.state?.player;
        const option = plenaryView?.fireInteraction?.option;
        return option?.kind==='extinguish' && plenaryView?.fires?.some(fire=>fire.site===site) && player && canActOnFire(player,site)
          ? {...option,site} : undefined;
      };
      this.roomFires.forEach(({flame},site)=>{
        this.registerInteraction(flame,()=>!!extinguishOption(site),()=>{
          const option = extinguishOption(site);
          if (option) actOnFire(option);
        });
      });
      for (const [place,{point,kind}] of Object.entries(installationSites)) {
        if (kind==='pizza') continue;
        const {width,height} = installationArt[kind];
        const art = createInstallationFrame(this,point,kind).setVisible(false);
        this.installationFixtures.push({point,art});
        const installed = () => worldSnapshot.decorations.find(item=>item.kind===kind && !item.privateOffice && item.x===point.x && item.y===point.y);
        const availableItem = () => {
          const gameplay = plenaryView?.gameplay;
          if (!gameplay?.installable.includes(place)) return;
          return gameplay.inventory.find(item=>item.kind===kind);
        };
        this.registerInteraction(art,()=>{
          const decoration = installed();
          return decoration ? !!plenaryView?.gameplay?.interactive.some(item=>item.id===decoration.id) : !!availableItem();
        },()=>{
          const decoration = installed();
          if (decoration) {
            inspect(decoration.id);
          } else {
            const item = availableItem();
            if (item) interact({kind:'install',item:item.id,place});
          }
        },undefined,(x,y)=>kind==='portrait' && !installed()
          ? Math.abs(x-art.x)<=width/2+8 && Math.abs(y-art.y)<=height/2+8
          : hitInteractionArt(art,x,y));

      }
      this.officeDoors = this.add.graphics().setDepth(2);
      this.mapProgress = this.add.graphics().setDepth(HEIGHT+31);
      for (const office of privateOffices) {
        const point = decorPoint(office,'portrait');
        const frame = createInstallationFrame(this,point,'portrait').setVisible(false);
        this.installationFixtures.push({point,art:frame});
        const install = ()=>plenaryView?.gameplay?.officeOptions?.find(option=>option.kind==='office-install' && option.place===office.id);
        this.registerInteraction(frame,()=>!!install(),()=>{
          const action = install();
          if (action) interact(action);
        });

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
        const {sprite,label} = createMapNpc(this,id,npc);
        if (id==='treasurer') {
          const delivery = ()=>treasuryDeliveries(plenaryView?.gameplay?.inventory ?? [])[0]?.action;
          this.registerInteraction(sprite,()=>!!plenaryView?.gameplay?.locations.includes('treasury') && !!delivery(),()=>{
            const action = delivery();
            if (action) interact(action);
          });
        } else {
          const target = id as NpcId;
          this.registerInteraction(sprite,()=>!!plenaryView?.gameplay?.npcNearby?.includes(target),()=>interact({kind:'catalog' in npc && npc.catalog ? 'open-shop' : 'talk',target}));
        }
        return {id,sprite,label};
      });
      this.marker = this.add.ellipse(0,0,19,6,0x09110e,.34).setVisible(false);
      this.input.on('pointerdown',(pointer: Phaser.Input.Pointer) => {
        if (movementPaused()) return;
        parent.focus({preventScroll:true});
        keys.clear();
        shiftKeys.clear();
        manual = false;
        const {x,y} = this.cameras.main.getWorldPoint(pointer.x,pointer.y);
        const target = [...this.interactionTargets].filter(([art,{outline}])=>outline.visible && art.visible)
          .sort(([a],[b])=>(b.parentContainer?.depth ?? b.depth)-(a.parentContainer?.depth ?? a.depth))
          .find(([,interaction])=>interaction.hit(x,y));
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
      const {ground:groundItems} = worldSnapshot;
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
        const {marker,icon} = createGroundArt(this,item);
        this.groundMarkers.set(item.id,marker);
        this.registerInteraction(icon,()=>!!plenaryView?.gameplay?.nearby.some(entry=>entry.id===item.id),
          ()=>interact({kind:'collect',item:item.id}),marker);
      }
    }

    private renderDecorations() {
      const {decorations} = worldSnapshot;
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
        const entry = createDecorationArt(this,item,this.textResolution);
        const {marker,art} = entry;
        this.installed.set(item.id,entry);
        if (item.privateOffice || item.kind==='pizza') this.registerInteraction(art,
          ()=>!!plenaryView?.gameplay?.interactive.some(entry=>entry.id===item.id),()=>inspect(item.id),marker);
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
      if (!movementPaused() && local.state && time>=nextStep) {
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
        drawOfficeState(this.officeDoors,officeViews);
      }
      for (const layout of privateOffices) {
        const art = this.safeArt.get(layout.id);
        if (!art) continue;
        const open = negotiating && depositingAtSafe(layout,players);
        updateSafeArt(art,open);
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
      const powerOut = !!plenaryView?.outage;
      const visionRadius = VISION_RADIUS*(plenaryView?.gameplay?.binocularSeconds ? binoculars.multiplier : 1)*
        (powerOut ? powerRules.visionFactor : 1);
      const cooldowns = plenaryView?.gameplay?.stationCooldowns;
      if (negotiating && ownPlayer && cooldowns) {
        for (const {station,duration,point,top} of rechargeFixtures) {
          const remaining = (cooldowns[station] ?? 0)-(phase==='ballot' || phase==='hearing' ? 0 : now-plenaryViewReceivedAt);
          if (remaining>0 && localPerception(ownPlayer,point,visionRadius).visible) {
            drawProgressBar(this.mapProgress,point.x,top-8,Phaser.Math.Clamp(1-remaining/duration,0,1));
          }
        }
      }
      const gap = visionRadius-this.drawnVisionRadius;
      this.drawnVisionRadius = !negotiating || reducedMotion.matches || Math.abs(gap)<.1
        ? visionRadius : this.drawnVisionRadius+gap*(1-Math.exp(-delta/105));
      const target = plenaryView?.tutorial?.target;
      this.tutorialMarker ??= this.add.graphics().setDepth(HEIGHT+32);
      this.tutorialMarker.clear();
      if (target && !plenaryView?.tutorial?.complete) {
        this.tutorialMarker.lineStyle(2,0xffdc75,1).strokeCircle(target.x,target.y,12+Math.sin(time/250)*2);
        this.tutorialMarker.lineBetween(target.x-5,target.y-21,target.x,target.y-15);
        this.tutorialMarker.lineBetween(target.x+5,target.y-21,target.x,target.y-15);
      }
      const fires = plenaryView?.fires;
      this.fuseSmoke(negotiating ? plenaryView?.fireInteraction?.smoke : undefined,reducedMotion.matches);
      this.roomFires.forEach((effect,site)=>{
        const active = negotiating && !!fires?.some(fire=>fire.site===site && !fire.paused);
        const visible = active && !!ownPlayer && localPerception(ownPlayer,fireSites[site],this.drawnVisionRadius).visible;
        effect.update(time,active,visible,reducedMotion.matches);
      });
      for (const {id,sprite,label} of this.npcViews) {
        const visible = npcEnabled(id,plenaryView?.projectVotingEnabled!==false,plenaryView?.decorationsEnabled!==false,plenaryView?.portraitsAndVipEnabled!==false) && (!running || (negotiating && !!ownPlayer && localPerception(ownPlayer,sprite,visionRadius).visible));
        sprite.setVisible(visible);
        label?.setVisible(visible);
      }
      const inSession = !!local.state?.plenary;
      this.doors.setVisible(inSession);
      const agenda = plenaryView?.project!==undefined ? agendaProject(plenaryView) : undefined;
      this.securityTerminal?.setVisible(plenaryView?.surveillanceEnabled!==false);
      this.board.setVisible(plenaryView?.projectVotingEnabled!==false);
      this.board.setText(agenda && plenaryView && running ? `${agenda.name} · ${plenaryView.remaining}s` : 'Nenhum projeto em pauta');
      const camera = this.cameras.main;
      const cssWidth = parent.clientWidth || 1;
      const cssHeight = parent.clientHeight || 1;
      const density = camera.width/cssWidth;
      const normalZoom = Math.max(1.5,Math.min(cssWidth/550,cssHeight/290),cssHeight/(cssWidth<=680 ? 310 : 360));
      const roomOnRight = Math.max(0,cssWidth-phoneInset);
      const phoneZoom = phoneInset ? Math.min(normalZoom,Math.max(.95,roomOnRight/120)) : normalZoom;
      const cssZoom = inSession ? plenaryZoom(normalZoom,cssWidth,cssHeight) : phoneZoom;
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
      for (const {point,art} of this.installationFixtures) {
        art.setVisible(plenaryView?.portraitsAndVipEnabled!==false && !!ownPlayer && localPerception(ownPlayer,point,visionRadius).visible);
      }
      for (const [art,{outline,ready}] of this.interactionTargets) {
        outline.setVisible(running && art.visible && ready());
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
        const {id,character,direction,visitor} = player;
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
          view = createActorView(this,player,this.textResolution);
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
        if (moving && time>=view.nextStep && (own || ownPlayer)) {
          const distance = own ? 0 : Math.hypot(x-ownPlayer!.x,y-ownPlayer!.y);
          const level = own ? .22 : Math.max(0,1-distance/75)*.08;
          if (level) footstep(level,own ? 0 : Phaser.Math.Clamp((x-ownPlayer!.x)/85,-1,1));
          if (player.sprinting && !latest.knockedOut && !latest.carried && !reducedMotion.matches) {
            sprintDust(this,x,y,x-sprite.x,y-sprite.y);
          }
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
        const {spriteX,spriteY} = updateActorView(this,view,{...latest,direction,character,visitor,moving:player.moving,sprinting:player.sprinting},x,y,moving,time,{
          reducedMotion:reducedMotion.matches,concealed:own && !!plenaryView?.gameplay?.concealmentSeconds,
          showStatus:running || worldSnapshot.officeHolders.has(id),
        });
        if (own) {
          if (this.marker.depth!==y-1) this.marker.setDepth(y-1);
          this.marker.setPosition(spriteX,latest.carried ? y-2 : spriteY-2).setVisible(true);
          if (inSession) {
            camera.centerOn(plenaryCameraCenter.x,plenaryCameraCenter.y);
          } else {
            const offset = phoneInset ? Math.max(0,phoneInset+Math.min(110,roomOnRight/2)-cssWidth/2) : 0;
            camera.centerOn(x-offset/cssZoom,y);
          }
          for (const part of [view.items,label,office]) {
            if (part.depth!==HEIGHT+91) part.setDepth(HEIGHT+91);
          }
          this.fog.setVisible(running);
          const roomFog = inSession && !powerOut;
          this.fogEdge.setVisible(running && !roomFog);
          if (running && roomFog && !this.fogInSession) {
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
          } else if (running && !roomFog) {
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
    drawPhoto(canvas:HTMLCanvasElement, captured?:PhotoScene) {
      if (!scene.sys.isActive() || !scene.photoRenderer) return;
      scene.photoRenderer.surveillanceEnabled = plenaryView?.surveillanceEnabled!==false;
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
        center,breaches,time:scene.time.now,offices:plenaryView?.gameplay?.offices,
        openSafes:privateOffices.filter(office=>depositingAtSafe(office,players)).map(office=>office.id),
        features:{surveillance:plenaryView?.surveillanceEnabled!==false,projectVoting:plenaryView?.projectVotingEnabled!==false,
          decorations:plenaryView?.decorationsEnabled!==false,portraitsAndVip:plenaryView?.portraitsAndVipEnabled!==false},
        people:players.filter(person=>person.id!==ownId && inPhotoFrame(center,person,true)).map(person=>({
          ...person,name:person.nick,
        })),
        ground:worldSnapshot.ground.filter(item=>inPhotoFrame(center,item)),
        decorations:worldSnapshot.decorations.filter(item=>inPhotoFrame(center,item)),
      });
    },
    showSafeExplosion(point:Motion) {
      if (scene.sys.isActive()) showSafeExplosion(scene,point,reducedMotion.matches);
    },
    showExtinguishEffect(effect:ExtinguishEffect) {
      if (scene.sys.isActive() && !reducedMotion.matches) scene.extinguishEffect?.(effect);
    },
    pulseStation(key:Station) { if (scene.sys.isActive()) scene.pulseStation(key); },
    playerHead() { return scene.sys.isActive() ? scene.playerHead() : undefined; },
    setPhoneInset(width:number) { phoneInset = width; },
    clearPrivateVision() {
      plenaryView = undefined;
      worldSnapshot = projectWorldSnapshot();
    },
    setPlenaryView(view:PlenaryView) {
      const startingCountdown = view.ballotCountdown!==undefined && plenaryView?.ballotCountdown===undefined;
      const openingBallot = view.phase!==phase && (view.phase==='ballot' || view.phase==='hearing');
      if (startingCountdown || openingBallot) {
        stop();
        manual = false;
        destination = undefined;
      }
      plenaryView = view;
      worldSnapshot = projectWorldSnapshot(view);
      plenaryViewReceivedAt = performance.now();
      if (phase===view.phase) return;
      phase = view.phase;
      inLobby = phase==='lobby';
      if (scene.sys.isActive()) scene.cameras.main.setVisible(!inLobby);
      negotiating = phase==='negotiation';
      running = negotiating || phase==='ballot' || phase==='hearing';
      if (!running) {
        scene.fog?.setVisible(false);
        scene.hideFogEdge();
      }
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
    destroy() {
      listeners.abort();
      resizeObserver?.disconnect();
      game.destroy(true);
    },
  };
}
