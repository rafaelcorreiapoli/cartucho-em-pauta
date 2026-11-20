import { expect, test } from 'bun:test';
import { canStand, roomAt, securityRoom, type Player } from './map';
import { findRoute } from './navigation';
import { canUseSecurityTerminal, securityCameras, securityCameraSees } from './security';

test('the security terminal is reachable from the public map',()=>{
  const start = {x:170,y:146};
  const atTerminal = {x:securityRoom.terminal.x,y:securityRoom.terminal.y+15};
  const player:Player = {...atTerminal,id:'p',nick:'Jogador',character:0,direction:0,moving:false};

  expect(canStand(atTerminal.x,atTerminal.y)).toBe(true);
  expect(canStand(1045,341)).toBe(false);
  expect(roomAt({x:931,y:308})).toBe('Lanchonete');
  expect(findRoute(start,atTerminal).at(-1)).toEqual(atTerminal);
  expect(roomAt(atTerminal)).toBe(securityRoom.name);
  expect(canUseSecurityTerminal(player)).toBe(true);
  expect(canUseSecurityTerminal({...player,knockedOut:true})).toBe(false);
  expect(canUseSecurityTerminal({...player,carried:true})).toBe(false);
});

test('the institutional cameras cover their whole rectangular area',()=>{
  for (const camera of securityCameras) {
    expect(securityCameraSees(camera,camera,camera)).toBe(true);
    const [x,y,w,h]=camera.area;
    for (const point of [{x:x+.5,y:y+.5},{x:x+w-.5,y:y+.5},{x:x+.5,y:y+h-.5},{x:x+w-.5,y:y+h-.5}]) {
      expect(securityCameraSees(camera,camera,point)).toBe(true);
    }
    expect(securityCameraSees(camera,camera,{x:x-1,y:y+h/2})).toBe(false);
    expect(securityCameraSees(camera,camera,{x:x+w,y:y+h/2})).toBe(false);
    expect(securityCameraSees(camera,camera,securityRoom.terminal)).toBe(false);
    expect(roomAt(camera)).toBe(camera.id==='corridor' ? 'Corredor' : camera.label);
  }

  const coffee = securityCameras[1];
  const point = {x:210,y:215};
  expect(securityCameraSees(coffee,coffee,point)).toBe(true);
  expect(securityCameraSees(coffee,{...coffee,barriers:[[212,205,1,15]]},point)).toBe(true);
  expect(securityCameraSees(coffee,coffee,{x:215,y:150})).toBe(false);
});

test('the security network covers technical support and the treasury',()=>{
  expect(securityCameras.find(camera=>camera.id==='technical')?.label).toBe('Apoio Técnico');
  expect(securityCameras.find(camera=>camera.id==='treasury')?.label).toBe('Tesouraria');
});
