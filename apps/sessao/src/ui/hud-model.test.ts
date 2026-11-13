import {expect,test} from 'bun:test';
import {PlenaryMatch} from '../../server/PlenaryMatch';
import type {Player} from '../map';
import {terminals} from '../gameplay';
import {createHudModel} from './hud-model';

const player:Player = {id:'rafa',nick:'Rafa',character:0,direction:0,moving:false,...terminals.coffee.point};

test('movement snapshots only notify stamina consumers when the displayed value changes',()=>{
  const hud = createHudModel();
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  hud.profile.subscribe(()=>updates.push('profile'));
  const unsubscribe = hud.stamina.subscribe(()=>updates.push('stamina'));
  hud.player({...player,stamina:89.9,staminaMax:110});
  const snapshot = hud.stamina.get();
  const moved = {...player,x:player.x+10,stamina:89.1,staminaMax:110};
  hud.player(moved);
  expect(hud.stamina.get()).toBe(snapshot);
  expect(snapshot).toEqual({current:89,max:110});
  expect(updates).toEqual(['stamina']);
  unsubscribe();
  hud.player({stamina:90,staminaMax:110});
  expect(updates).toEqual(['stamina']);
});

test('a server mission completion updates agenda and XP without repainting public metrics',()=>{
  const hud = createHudModel();
  const match = new PlenaryMatch(1);
  match.start(player.id,[{...player}],0,()=>0);
  const view = ()=>match.view(player.id,[player.id],0);
  hud.render(view());
  expect(hud.agenda.get()?.active.some(mission=>mission.kind==='cafe')).toBe(true);
  const updates:string[] = [];
  hud.congress.subscribe(()=>updates.push('congress'));
  hud.profile.subscribe(()=>updates.push('profile'));
  hud.agenda.subscribe(()=>updates.push('agenda'));
  expect(match.roomActivity(player,'coffee',1)?.activity).toBe('coffee');
  hud.render(view());
  hud.render(view());
  expect(updates).toEqual(['profile','agenda']);
  expect(hud.profile.get()?.xp).toBe(20);
  expect(hud.agenda.get()?.announcement).toContain('Concluído');
  expect(hud.agenda.get()?.recent.map(mission=>mission.kind)).toEqual(['cafe']);

  const reconnected = createHudModel();
  reconnected.render(view());
  expect(reconnected.profile.get()).toEqual(hud.profile.get());
  expect(reconnected.agenda.get()?.recent).toEqual(hud.agenda.get()?.recent);
  expect(reconnected.agenda.get()?.announcement).toBe('');

  hud.render({...view(),phase:'lobby'});
  expect(hud.profile.get()).toBeUndefined();
  expect(hud.resources.get()).toBeUndefined();
  expect(hud.agenda.get()).toBeUndefined();
});
