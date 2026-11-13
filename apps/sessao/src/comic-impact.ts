import Phaser from 'phaser';

export function playComicImpact(scene:Phaser.Scene, x:number, y:number, hit:number, resolution:number) {
  const burst = scene.add.graphics();
  const points = Array.from({length:20},(_,index)=>{
    const angle = index/20*Math.PI*2;
    const radius = index%2===0 ? 24 : 13;
    return new Phaser.Math.Vector2(Math.cos(angle)*radius*1.3,Math.sin(angle)*radius*.8);
  });
  burst.fillStyle(0xffde68).lineStyle(2,0x483424).fillPoints(points,true).strokePoints(points,true);
  const text = scene.add.text(0,-1,Math.floor(hit/50)%3===0 ? 'BAM!' : 'POW!',{
    resolution,fontFamily:'Arial Black, Arial',fontSize:'14px',fontStyle:'bold italic',
    color:'#a13a26',stroke:'#fff0ad',strokeThickness:2,
  }).setOrigin(.5);
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const punch = scene.add.container(x,y,[burst,text]).setDepth(HEIGHT_ABOVE_PLAYERS)
    .setAngle(Math.floor(hit/50)%2===0 ? -12 : 10).setScale(reduced ? .75 : .3);
  if (!reduced) scene.tweens.add({targets:punch,scale:.75,duration:90,ease:'Back.Out'});
  scene.tweens.add({
    targets:punch,y:reduced ? y : y-15,alpha:0,delay:140,duration:220,
    onComplete:()=>punch.destroy(true),
  });
}

const HEIGHT_ABOVE_PLAYERS = 1200;

export function playBloodImpact(scene:Phaser.Scene,x:number,y:number) {
  const texture = 'blood-impact-dot';
  if (!scene.textures.exists(texture)) {
    const dot = scene.add.graphics().fillStyle(0xffffff).fillCircle(2,2,2);
    dot.generateTexture(texture,4,4);
    dot.destroy();
  }
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const drops = scene.add.particles(x,y,texture,{
    emitting:false,lifespan:{min:220,max:410},speedX:{min:-28,max:28},
    speedY:{min:-56,max:-16},gravityY:160,scale:{start:.62,end:.14},
    alpha:{start:.95,end:0},tint:[0xa72c25,0xc13c2c,0x791e20],
  }).setDepth(HEIGHT_ABOVE_PLAYERS-1);
  drops.explode(reduced ? 3 : 8);
  scene.time.delayedCall(450,()=>drops.destroy());
}
