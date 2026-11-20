import {expect,test} from 'bun:test';
import type Phaser from 'phaser';
import {sprintDust} from './sprint-dust';

function fixture() {
  const puffs:any[] = [], tweens:any[] = [];
  const scene = {add:{ellipse(x:number,y:number) {
    const puff = {x,y,destroyed:false,setDepth(){return this;},setScale(){return this;},destroy(){this.destroyed=true;}};
    puffs.push(puff);
    return puff;
  }},tweens:{add(config:unknown){tweens.push(config);}}} as unknown as Phaser.Scene;
  return {scene,puffs,tweens};
}

test('sprint clouds trail travel in every direction and clean up after fading',()=>{
  for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1]]) {
    const {scene,puffs,tweens} = fixture();
    sprintDust(scene,100,100,dx,dy);
    expect(puffs).toHaveLength(3);
    for (const tween of tweens) {
      const puff = tween.targets;
      expect((puff.x-100)*dx+(puff.y-99)*dy).toBeLessThan(0);
      expect(tween.alpha).toBe(0);
      expect(tween.duration).toBeLessThan(500);
      tween.onComplete();
      expect(puff.destroyed).toBe(true);
    }
  }
});
test('stationary characters create no clouds',()=>{
  const {scene,puffs,tweens} = fixture();
  sprintDust(scene,100,100,0,0);
  expect(puffs).toHaveLength(0);
  expect(tweens).toHaveLength(0);
});
