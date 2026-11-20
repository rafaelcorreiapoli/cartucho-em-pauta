import {expect,test} from 'bun:test';
import {fireIntensity,canActOnFire,extinguisherSpawns,fireRules,fireSites} from './fire';
import {canStand,furnishings,rooms} from './map';
import {privateOffices} from './private-offices';

test('every room has fire targets within reach of a walkable tile',()=>{
  expect([...new Set(fireSites.map(site=>site.name))].sort()).toEqual(rooms.map(room=>room.name).sort());
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


test('all green cabinets and private office cabinets are flammable targets',()=>{
  const cabinets = [
    ...furnishings.filter(prop=>'frame' in prop && prop.frame===4).map(({area:[x,y,w,h]})=>({x:x+w/2,y:y+h})),
    ...privateOffices.map(office=>office.cabinet),
  ];
  expect(cabinets).toHaveLength(11);
  for (const cabinet of cabinets) {
    const sites = fireSites.filter(site=>site.x===cabinet.x && site.y===cabinet.y);
    expect(sites).toHaveLength(1);
    expect(sites[0].object).toBe('Armário');
  }
});

test('fire ambience grows near the source, stays within its room and ignores paused fires',()=>{
  const site = 0;
  const target = fireSites[site];
  const fire = {site,remaining:1000,damage:2,paused:false};
  expect(fireIntensity(target,[fire])).toBe(1);
  const [left,top,width,height] = target.bounds;
  const far = {x:left+width/2,y:top+height/2};
  expect(fireIntensity(far,[fire])).toBeGreaterThan(0);
  expect(fireIntensity(far,[fire])).toBeLessThan(1);
  expect(fireIntensity(fireSites.find(other=>other.name!==target.name),[fire])).toBe(0);
  expect(fireIntensity(target,[{...fire,paused:true}])).toBe(0);
  expect(fireIntensity(undefined,[fire])).toBe(0);
  expect(fireIntensity(target,[])).toBe(0);
  expect(fireIntensity(target,[fire,fire])).toBe(1);
});
