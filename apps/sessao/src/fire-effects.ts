import type Phaser from 'phaser';
import {fireSites} from './fire';

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

    return {
      flame,
      update(time:number,active:boolean,visible:boolean,reduced:boolean) {
        illumination.setVisible(active).setAlpha(reduced ? .86 : .85+Math.sin(time/115)*.07+Math.sin(time/43)*.04);
        flame.setVisible(visible).setFrame(reduced ? 0 : Math.floor(time/62)%flameFrames);
        if (visible && !reduced) {
          if (!embers.emitting) embers.start();
        } else if (embers.emitting) embers.stop(true);
      },
    };
  });
}

export function createFuseSmoke(scene:Phaser.Scene) {
  const key = 'incendiary-smoke';
  const texture = scene.textures.createCanvas(key,32,32)!;
  const ctx = texture.context;
  const gradient = ctx.createRadialGradient(16,16,0,16,16,16);
  gradient.addColorStop(0,'rgba(221,219,204,.95)');
  gradient.addColorStop(.42,'rgba(158,156,144,.78)');
  gradient.addColorStop(1,'rgba(119,119,110,0)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0,0,32,32);
  texture.refresh();

  const plume = scene.add.particles(0,0,key,{
    emitting:false,frequency:120,lifespan:1100,
    speedX:{min:-7,max:7},speedY:{min:-25,max:-16},
    scale:{start:.13,end:.52},alpha:{start:.8,end:0},maxAliveParticles:10,
  });
  const still = scene.add.image(0,0,key).setScale(.55).setVisible(false);
  let site:number|undefined;
  return (visibleSite:number|undefined,reduced:boolean)=>{
    if (site!==visibleSite && plume.emitting) plume.stop(true);
    site = visibleSite;
    still.setVisible(site!==undefined && reduced);
    if (site===undefined) return;
    const {x,y} = fireSites[site];
    if (reduced) {
      if (plume.emitting) plume.stop(true);
      still.setPosition(x,y-25).setDepth(y+2);
    } else if (!plume.emitting) {
      plume.setPosition(x,y-16).setDepth(y+2).start();
    }
  };
}
