import {expect,test} from 'bun:test';
import {canActOnFire,extinguisherSpawns,fireRules,fireSites} from './fire';
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
