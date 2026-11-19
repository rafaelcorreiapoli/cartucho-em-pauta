import {expect,test} from 'bun:test';
import {Visitors} from './Visitors';
import {VisitorRobberies} from './VisitorRobberies';
import {Gameplay} from './Gameplay';
import {PlenaryMatch} from './PlenaryMatch';
import {npcRules,visitorRoster,visitorSheets} from '../src/visitors';
import {NAMES,canStand,roomAt,type Player} from '../src/map';
import {fieldActions} from '../src/ui/field-actions';
import {characterArt,downedArt,hitArt} from '../src/character-art';
import {payrollRules} from '../src/plenary';

function fixture() {
  const humans:Player[] = ['a','b'].map(id=>({id,nick:id,character:0,direction:0,moving:false,x:140,y:146}));
  const match = new PlenaryMatch(1); match.start('a',humans,0,()=>0);
  const game = new Gameplay(); game.reset(0,()=>0,humans,()=>0);
  const visitors = new Visitors(); visitors.reset(2,0,()=>0);
  for (const visitor of visitors.players) match.addVisitor(visitor);
  const robberies = new VisitorRobberies(visitors,game);
  const world = (now:number)=>match.gameplayWorld([...humans,...visitors.players],now,()=>false);
  return {humans,match,game,visitors,robberies,world};
}

test('visitor roster is independent of parliamentarian appearances and uses distinct rooms for the full roster',()=>{
  const visitors = new Visitors(); visitors.reset(visitorRoster.length,0,()=>0);
  expect(visitors.players.map(player=>player.nick)).toEqual(visitorRoster.map(visitor=>visitor.name));
  expect(new Set(visitors.players.map(player=>player.visitor)).size).toBe(visitorRoster.length);
  expect(new Set(visitors.players.map(roomAt)).size).toBe(visitorRoster.length);
  for (const visitor of visitors.players) {
    expect(visitor.npc).toBe(true); expect(visitor.bot).toBeUndefined();
    expect(NAMES as readonly string[]).not.toContain(visitor.nick);
    expect(canStand(visitor.x,visitor.y)).toBe(true);
  }
});

test('NPC render keys differ from human and bot keys even with the same base character',async()=>{
  expect(characterArt(0).sheet.key).toBe('players');
  for (const {id} of visitorRoster) {
    expect(characterArt(0,id).sheet.key).toBe(`${id}-walk`);
    expect(hitArt(0,3,110,id)).toMatchObject({key:`${id}-hit`,frame:6,flipX:true});
    expect(downedArt(0,2,8000,id)).toMatchObject({key:`${id}-fall`,frame:11});
  }
  expect(visitorSheets).toHaveLength(visitorRoster.length*3);
  for (const sheet of visitorSheets) expect(await Bun.file(new URL(`../public/${sheet.path}`,import.meta.url)).exists()).toBe(true);
});

test('visitors carry per-character cash and never have a mandate, office, salary or payable vote',()=>{
  const {humans,visitors,match,world} = fixture();
  for (const visitor of visitors.players) {
    expect(world(0).wallet!(visitor.id)).toBe(visitorRoster.find(entry=>entry.id===visitor.visitor)!.wallet);
    expect(world(0).office(visitor.id)).toBeUndefined();
    expect(world(0).hasMandate!(visitor.id)).toBe(false);
    match.vote(visitor.id,'yes',1);
    expect(Reflect.get(match,'votes').has(visitor.id)).toBe(false);
    expect(world(0).payNpc!('a',visitor.id,1)).toBe(false);
  }
  const before = visitors.players.map(visitor=>world(0).wallet!(visitor.id));
  match.advance(payrollRules.interval);
  expect(visitors.players.map(visitor=>world(payrollRules.interval).wallet!(visitor.id))).toEqual(before);
  expect(match.view('a',humans.map(player=>player.id),payrollRules.interval).electorate).toBe(2);
});

test('robbery requires a knockout, yields one physical cash lot and cannot duplicate it',()=>{
  const {humans:[a,b],visitors,game,robberies,world,match} = fixture();
  const visitor = visitors.players[0]; Object.assign(visitor,{x:a.x+8,y:a.y}); Object.assign(b,{x:a.x-8,y:a.y});
  const amount = world(1).wallet!(visitor.id); const wallet = world(1).wallet!(a.id);
  expect(robberies.act(a,{kind:'rob',target:visitor.id},world(1))).toContain('nocauteado');
  for (const kind of ['talk','sign','vote']) expect(robberies.act(a,{kind,target:visitor.id},world(1))).toContain('não negociam');
  visitor.knockedOut = true;
  for (const player of [a,b]) robberies.act(player,{kind:'rob',target:visitor.id},world(2));
  expect(robberies.robberyTarget(a.id)).toEqual({x:visitor.x,y:visitor.y,direction:visitor.direction});
  robberies.tick(world(2+npcRules.robberyMs),true);
  expect(robberies.robberyTarget(a.id)).toBeUndefined();
  expect(world(3).wallet!(visitor.id)).toBe(0);
  expect(world(3).wallet!(a.id)).toBe(wallet);
  expect(game.view(a,world(3)).inventory).toContainEqual(expect.objectContaining({kind:'briefcase',cash:amount}));
  expect(game.view(b,world(3)).inventory).toEqual([]);
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
});

test('the contextual HUD only offers robbery on a downed visitor and can cancel it',()=>{
  const {humans:[a],visitors,robberies,game,match,world} = fixture();
  const visitor = visitors.players[0]; Object.assign(visitor,{x:a.x+8,y:a.y});
  const buttons = ()=>fieldActions({...match.view(a.id,[a.id],1),gameplay:{...game.view(a,world(1)),
    visitors:robberies.nearby(a),robberyProgress:robberies.robberyProgress(a.id,1)}},a,world(1).players);
  expect(buttons().some(button=>button.action.kind==='npc-deal')).toBe(false);
  visitor.knockedOut = true;
  expect(buttons().filter(button=>button.target?.id===visitor.id)).toHaveLength(1);
  const rob = buttons().find(button=>button.label.includes('Roubar dinheiro'))!;
  if (rob.action.kind!=='npc-deal') throw Error('Missing robbery action');
  robberies.act(a,rob.action.request,world(1));
  const cancel = buttons().find(button=>button.label==='Cancelar roubo')!;
  if (cancel.action.kind!=='npc-deal') throw Error('Missing cancellation');
  robberies.act(a,cancel.action.request,world(1));
  expect(robberies.robberyTarget(a.id)).toBeUndefined();
  robberies.tick(world(1+npcRules.robberyMs),true);
  expect(world(1).wallet!(visitor.id)).toBeGreaterThan(0);
  expect(game.view(a,world(1)).inventory).toEqual([]);
});

test('moving away interrupts robbery without removing visitor cash',()=>{
  const {humans:[a],visitors,robberies,world} = fixture();
  const visitor = visitors.players[0]; Object.assign(visitor,{x:a.x+8,y:a.y,knockedOut:true});
  robberies.act(a,{kind:'rob',target:visitor.id},world(1)); a.x += 40;
  robberies.tick(world(1+npcRules.robberyMs),true);
  expect(robberies.robberyProgress(a.id,4000)).toBeUndefined();
  expect(world(4000).wallet!(visitor.id)).toBe(7);
});

test('periodic departures retire unclaimed cash and new arrivals do not duplicate identities or money',()=>{
  const {visitors,game,match,world} = fixture();
  const oldIds = visitors.players.map(player=>player.id);
  const update = (now:number)=>visitors.maintain(now,player=>match.addVisitor(player),player=>match.removeVisitor(player.id),()=>0);
  update(npcRules.lifetimeMs);
  expect(visitors.players).toHaveLength(1);
  expect(oldIds).not.toContain(visitors.players[0].id);
  expect(match.economySummary(game.physicalCash())).toMatchObject({expired:16,discrepancy:0});
  update(npcRules.lifetimeMs+npcRules.spawnMs);
  expect(visitors.players).toHaveLength(2);
  expect(new Set(visitors.players.map(player=>player.visitor)).size).toBe(2);
  for (const id of oldIds) expect(world(1).wallet!(id)).toBe(0);
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
});

test('a knocked out or carried visitor remains available past its scheduled departure',()=>{
  const visitors = new Visitors(); visitors.reset(2,0,()=>0);
  const [down,carried] = visitors.players; down.knockedOut = true; carried.carried = true;
  const removed:string[] = [];
  visitors.maintain(npcRules.lifetimeMs,()=>{},player=>removed.push(player.id),()=>0);
  expect(removed).toEqual([]); expect(visitors.players).toHaveLength(2);
  down.knockedOut = undefined; carried.carried = undefined;
  visitors.maintain(npcRules.lifetimeMs+1,()=>{},player=>removed.push(player.id),()=>0);
  expect(removed).toEqual([down.id,carried.id]);
});

test('visitors use valid walking routes and stop after arriving',()=>{
  const visitors = new Visitors(); visitors.reset(1,0,()=>0);
  const [visitor] = visitors.players;
  for (let i=0;i<200;i++) { visitors.tick(i*50,.05,true); expect(canStand(visitor.x,visitor.y)).toBe(true); }
  const member = Reflect.get(visitors,'members').get(visitor.id);
  Object.assign(visitor,{x:136,y:146}); member.route = [{x:140,y:146}];
  visitors.tick(20_000,.1,true); visitors.tick(20_100,.1,true);
  expect(visitor).toMatchObject({x:140,y:146,moving:false});
});

test('photos and camera scenes retain visitor identities instead of the base parliamentarian skin',()=>{
  const {humans:[a],visitors,game,world} = fixture();
  const visitor = visitors.players[0]; Object.assign(visitor,{x:a.x+8,y:a.y});
  game.act(a,{kind:'photo'},world(1));
  const photo = game.photoView(a.id,1).album[0].photo;
  expect(photo.people.find(person=>person.id===visitor.id)).toMatchObject({name:'Nestor Cerveró',visitor:'nestor-cervero',character:0});
  const camera = Reflect.get(game,'cameraScene').call(game,a,a,world(2),()=>true);
  expect(camera.people.find((person:Player)=>person.id===visitor.id)).toMatchObject({name:'Nestor Cerveró',visitor:'nestor-cervero',character:0});
});

test('a robbed visitor departs after recovering and only robbery is available on its body',()=>{
  const {humans:[a],visitors,robberies,game,match,world} = fixture();
  const visitor = visitors.players[0]; Object.assign(visitor,{x:a.x+8,y:a.y,knockedOut:true});
  for (const kind of ['aid','carry','inspect-down'] as const) {
    expect(game.act(a,{kind,target:visitor.id},world(1))).not.toBeUndefined();
    expect(visitor.knockedOut).toBe(true); expect(visitor.carried).toBeUndefined();
  }
  robberies.act(a,{kind:'rob',target:visitor.id},world(1));
  robberies.tick(world(1+npcRules.robberyMs),true);
  visitor.knockedOut = undefined;
  visitors.maintain(4000,player=>match.addVisitor(player),player=>match.removeVisitor(player.id),()=>0);
  expect(visitors.players.some(player=>player.id===visitor.id)).toBe(false);
  expect(match.economySummary(game.physicalCash()).discrepancy).toBe(0);
});
