import {expect,test} from 'bun:test';
import {canActOnFire,extinguisherSpawns,fireRules,fireSites} from './fire';
import {canStand,rooms} from './map';

test('every room has one fire target within reach of a walkable tile',()=>{
  expect(fireSites.map(site=>site.name).sort()).toEqual(rooms.map(room=>room.name).sort());
  for (const [site,{x,y}] of fireSites.entries()) {
    let reachable = false;
    for (let dx=-fireRules.radius;dx<=fireRules.radius && !reachable;dx++) {
      for (let dy=-fireRules.radius;dy<=fireRules.radius && !reachable;dy++) {
        const player = {x:x+dx,y:y+dy};
        reachable = canStand(player.x,player.y) && canActOnFire(player,site);
      }
    }
    expect(reachable).toBe(true);
  }
  for (const {x,y} of extinguisherSpawns) expect(canStand(x,y)).toBe(true);
});
