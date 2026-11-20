import type Phaser from 'phaser';

/** Footfall clouds drift opposite the actual travel direction. */
export function sprintDust(scene:Phaser.Scene,x:number,y:number,dx:number,dy:number) {
  const length = Math.hypot(dx,dy);
  if (!length) return;
  const bx = -dx/length, by = -dy/length;
  for (let i=0;i<3;i++) {
    const spread = (i-1)*1.6;
    const puff = scene.add.ellipse(x+bx*4-by*spread,y+by*4+bx*spread-1,3+i,2+i*.5,0xe6dfc7,.38)
      .setDepth(y-.5).setScale(.6);
    scene.tweens.add({targets:puff,x:puff.x+bx*(5+i*2),y:puff.y+by*4-4-i,
      scaleX:1.7,scaleY:1.5,alpha:0,duration:340+i*55,ease:'Sine.Out',onComplete:()=>puff.destroy()});
  }
}
