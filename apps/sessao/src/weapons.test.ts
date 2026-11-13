import {expect,test} from 'bun:test';
import {weaponImpactSegment,weaponPose,weapons} from './weapons';

test.each([0,Math.PI/2,Math.PI,-Math.PI/2])('the baton thrust follows its heading at %s radians',angle=>{
  const swing = {weapon:'baton',startedAt:0,angle} as const;
  const impact = weaponPose(swing,weapons.baton.impactMs/weapons.baton.swingMs);
  const start = weaponPose(swing,0);
  const end = weaponPose(swing,1);
  const {handle,tip} = weaponImpactSegment(swing);
  expect(impact.angle).toBe(angle);
  expect((impact.handX-start.handX)*Math.cos(angle)+(impact.handY-start.handY)*Math.sin(angle)).toBeCloseTo(13);
  expect(tip.x-handle.x).toBeCloseTo(Math.cos(angle)*weapons.baton.size);
  expect(tip.y-handle.y).toBeCloseTo(Math.sin(angle)*weapons.baton.size);
  expect(end).toEqual(start);
});
