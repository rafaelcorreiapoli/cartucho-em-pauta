import type Phaser from 'phaser';
import {fireSites,type ExtinguishEffect} from './fire';

const flameSize = 80;
const flameFrames = 16;
const flameKey = 'room-flames';
const emberKey = 'room-fire-ember';

function drawFlames(scene:Phaser.Scene) {
  const texture = scene.textures.createCanvas(flameKey,flameSize*flameFrames,flameSize)!;
  const ctx = texture.context;
  for (let frame=0;frame<flameFrames;frame++) {
    const offset = frame*flameSize;
    const phase = frame/flameFrames*2*Math.PI;
    const sway = Math.sin(phase);
    const curl = Math.cos(phase*2);
    texture.add(frame,0,offset,0,flameSize,flameSize);
    ctx.save();
    ctx.translate(offset+40,73);

    const outer = ctx.createLinearGradient(0,0,0,-70);
    outer.addColorStop(0,'#742425');
    outer.addColorStop(.42,'#cd3722');
    outer.addColorStop(1,'#ef7026');
    ctx.fillStyle = outer;
    ctx.beginPath();
    ctx.moveTo(-4,0);
    ctx.bezierCurveTo(-30,0,-38,-18,-22,-41+curl*6);
    ctx.bezierCurveTo(-23,-29,-13,-28,-13,-37);
    ctx.bezierCurveTo(-18,-50,4,-54,2+sway*7,-72+curl*3);
    ctx.bezierCurveTo(20,-57,10,-43,19,-33);
    ctx.bezierCurveTo(23,-34,29+sway*4,-46-curl*5,25+sway*5,-52);
    ctx.bezierCurveTo(48,-26,29,1,-4,0);
    ctx.fill();

    const inner = ctx.createLinearGradient(0,0,0,-56);
    inner.addColorStop(0,'#ff9b29');
    inner.addColorStop(.48,'#ffb53d');
    inner.addColorStop(1,'#ff7129');
    ctx.fillStyle = inner;
    ctx.beginPath();
    ctx.moveTo(-2,-2);
    ctx.bezierCurveTo(-16,-1,-26,-13,-18,-25+curl*3);
    ctx.bezierCurveTo(-18,-19,-11,-15,-9,-24);
    ctx.bezierCurveTo(-4,-36,-7,-42,7+sway*7,-57+curl*3);
    ctx.bezierCurveTo(6,-43,18,-38,14,-24);
    ctx.bezierCurveTo(20,-22,26,-28,26,-34-curl*4);
    ctx.bezierCurveTo(34,-12,17,0,-2,-2);
    ctx.fill();

    ctx.fillStyle = '#ffe5a0';
    ctx.beginPath();
    ctx.moveTo(0,-3);
    ctx.bezierCurveTo(-14,-4,-15,-14,-7,-23);
    ctx.quadraticCurveTo(-1,-30,1+sway*5,-37+curl*3);
    ctx.bezierCurveTo(15,-27,4,-20,14,-16);
    ctx.bezierCurveTo(19,-10,12,-3,0,-3);
    ctx.fill();
    ctx.restore();
  }
  texture.refresh();

  const ember = scene.add.graphics().fillStyle(0xffffff).fillEllipse(3,4,4,6);
  ember.generateTexture(emberKey,6,8);
  ember.destroy();
}

export function createRoomFires(scene:Phaser.Scene) {
  drawFlames(scene);
  const smokeKey = smokeTexture(scene);
  return fireSites.map(({x,y,bounds:[left,top,width,height]},index)=>{
    const glowKey = `room-fire-glow-${index}`;
    const glow = scene.textures.createCanvas(glowKey,width,height)!;
    const ctx = glow.context;
    const roomX = x-left;
    const roomY = y-top;
    const radius = Math.hypot(Math.max(roomX,width-roomX),Math.max(roomY,height-roomY));
    const light = ctx.createRadialGradient(roomX,roomY,0,roomX,roomY,radius);
    light.addColorStop(0,'rgba(255,126,47,.86)');
    light.addColorStop(.12,'rgba(244,63,30,.66)');
    light.addColorStop(.45,'rgba(207,35,29,.42)');
    light.addColorStop(1,'rgba(144,22,28,.20)');
    ctx.fillStyle = light;
    ctx.fillRect(0,0,width,height);
    glow.refresh();

    const illumination = scene.add.image(left,top,glowKey).setOrigin(0).setDepth(2.5).setVisible(false);
    const flame = scene.add.sprite(x,y,flameKey,0).setOrigin(.5,73/flameSize)
      .setDisplaySize(29,32).setDepth(y+1).setVisible(false);
    const embers = scene.add.particles(x,y-11,emberKey,{
      emitting:false, frequency:38, lifespan:{min:500,max:1200},
      x:{min:-9,max:9}, speedX:{min:-12,max:12}, speedY:{min:-46,max:-22},
      gravityY:-8, rotate:{min:-30,max:30}, maxAliveParticles:30,
      tint:[0xd84221,0xff8b35,0xffda83], scale:{start:.48,end:.09}, alpha:{start:.95,end:0},
    }).setDepth(y+2);

    const smoke = scene.add.particles(x,y-19,smokeKey,{
      emitting:false,frequency:125,lifespan:{min:650,max:1100},
      x:{min:-10,max:10},speedX:{min:-8,max:8},speedY:{min:-22,max:-12},
      scale:{start:.27,end:.77},alpha:{start:.5,end:0},tint:0x666977,maxAliveParticles:12,
    }).setDepth(y+.5);

    return {
      flame,
      update(time:number,active:boolean,visible:boolean,reduced:boolean) {
        illumination.setVisible(active).setAlpha(reduced ? .86 : .85+Math.sin(time/115)*.07+Math.sin(time/43)*.04);
        flame.setVisible(visible).setFrame(reduced ? 0 : Math.floor(time/62)%flameFrames);
        if (visible && !reduced) {
          if (!embers.emitting) embers.start();
          if (!smoke.emitting) smoke.start();
        } else {
          if (embers.emitting) embers.stop(true);
          if (smoke.emitting) smoke.stop(true);
        }
      },
    };
  });
}

function smokeTexture(scene:Phaser.Scene) {
  const key = 'fire-smoke-puff';
  if (scene.textures.exists(key)) return key;
  const texture = scene.textures.createCanvas(key,32,32)!;
  const ctx = texture.context;
  const gradient = ctx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'rgba(236,233,215,.98)');
  gradient.addColorStop(.42,'rgba(173,172,161,.82)');
  gradient.addColorStop(1,'rgba(119,119,110,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,32,32);
  texture.refresh();

  return key;
}

export function createFuseSmoke(scene:Phaser.Scene) {
  const key = smokeTexture(scene);
  const effects = new Map<number,{plume:Phaser.GameObjects.Particles.ParticleEmitter;still:Phaser.GameObjects.Image}>();
  return (visibleSites:readonly number[]|undefined,reduced:boolean)=>{
    const visible = new Set(visibleSites);
    for (const [site,{plume,still}] of effects) if (!visible.has(site)) {
      plume.destroy();
      still.destroy();
      effects.delete(site);
    }
    for (const site of visible) {
      const {x,y} = fireSites[site];
      let effect = effects.get(site);
      if (!effect) {
        const plume = scene.add.particles(x,y-31,key,{
          emitting:false,frequency:95,lifespan:1150,
          speedX:{min:-6,max:6},speedY:{min:-24,max:-18},
          scale:{start:.24,end:.62},alpha:{start:.92,end:0},maxAliveParticles:14,
        }).setDepth(y+2);
        const still = scene.add.image(x,y-40,key).setScale(.55).setDepth(y+2);
        effect = {plume,still};
        effects.set(site,effect);
      }
      effect.still.setVisible(reduced);
      if (reduced) {
        if (effect.plume.emitting) effect.plume.stop(true);
      } else if (!effect.plume.emitting) effect.plume.start();
    }
  };
}

export function createExtinguishEffect(scene:Phaser.Scene) {
  const key = smokeTexture(scene);
  const spray = scene.add.particles(0,0,key,{
    emitting:false,angle:{min:-15,max:15},speed:{min:45,max:100},
    lifespan:{min:200,max:410},scale:{start:.13,end:.48},alpha:{start:.95,end:0},
    tint:[0xffffff,0xddf6ff,0xc2dce8],maxAliveParticles:24,
  });
  const cloud = scene.add.particles(0,0,key,{
    emitting:false,x:{min:-12,max:12},y:{min:-7,max:5},
    speedX:{min:-18,max:18},speedY:{min:-26,max:-8},lifespan:{min:520,max:1150},
    scale:{start:.31,end:.86},alpha:{start:.65,end:0},tint:0x92929c,maxAliveParticles:18,
  });
  return ({site,from}:ExtinguishEffect)=>{
    const target = fireSites[site];
    if (!target) return;
    const {x,y} = target;
    cloud.killAll().setPosition(x,y-14).setDepth(y+3).explode(15);
    if (!from) return;
    const nozzleY = from.y-7;
    const angle = Math.atan2(y-14-nozzleY,x-from.x);
    spray.killAll().setPosition(from.x,nozzleY).setRotation(angle).setDepth(y+4).explode(24);
  };
}

export function showSafeExplosion(scene:Phaser.Scene,point:{x:number;y:number},reduced:boolean) {
  const {x,y} = point;
  if (reduced) {
    const mark = scene.add.circle(x,y-8,12,0xf2b35c,.55).setDepth(y+20);
    scene.time.delayedCall(180,()=>mark.destroy());
    return;
  }
  const key = smokeTexture(scene);
  const sparks = scene.add.particles(x,y-8,key,{
    emitting:false,angle:{min:0,max:360},speed:{min:45,max:155},gravityY:85,
    lifespan:{min:180,max:550},scale:{start:.24,end:0},alpha:{start:1,end:0},
    tint:[0xfff0b8,0xffb03b,0xff5729],blendMode:'ADD',maxAliveParticles:36,
  }).setDepth(y+21);
  const smoke = scene.add.particles(x,y-10,key,{
    emitting:false,x:{min:-8,max:8},y:{min:-5,max:5},
    speedX:{min:-30,max:30},speedY:{min:-45,max:-12},
    lifespan:{min:850,max:1750},scale:{start:.35,end:1.5},alpha:{start:.75,end:0},
    tint:[0x504a43,0x787069,0xaaa299],maxAliveParticles:24,
  }).setDepth(y+20);
  sparks.explode(36);
  smoke.explode(24);
  scene.cameras.main.shake(180,.003);
  scene.time.delayedCall(1900,()=>{sparks.destroy();smoke.destroy();});
}
