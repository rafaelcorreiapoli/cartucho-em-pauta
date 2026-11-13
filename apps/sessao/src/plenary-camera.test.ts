import {expect,test} from 'bun:test';
import {PLENARY_SEATS} from './map';
import {plenaryCameraCenter,plenaryZoom} from './plenary-camera';

test.each([[1024,500],[1440,703],[1920,880]])('all seats and their avatar bounds fit the plenary camera at %s×%s', (width,height)=>{
  const zoom = plenaryZoom(4,width,height);
  for (const seat of PLENARY_SEATS) {
    const x = width/2+(seat.x-plenaryCameraCenter.x)*zoom;
    const y = height/2+(seat.y-plenaryCameraCenter.y)*zoom;
    expect(x-19*zoom).toBeGreaterThan(0);
    expect(x+19*zoom).toBeLessThan(width);
    expect(y-56*zoom).toBeGreaterThan(0);
    expect(y+14*zoom).toBeLessThan(height);
  }
});
