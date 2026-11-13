import { expect, test } from 'bun:test';
import { canStandInPlenary, inPlenary, isolationRoom, PLENARY_SEATS } from './map';
import { findRoute } from './navigation';
import { PredictedMovement } from './network-movement';
import { applyInput, readInput, restMovement, type ControlState, type MovementInput } from './movement';

test('prediction starts immediately and replays only the inputs the server has not processed', () => {
  const server: ControlState = {
    player:{id:'player',nick:'Player',character:0,x:140,y:146,direction:0,moving:false}, route:[], ack:0,
  };
  const sent: MovementInput[] = [];
  const client = new PredictedMovement(input => sent.push(input));
  client.reconcile(server);
  client.input({motion:{x:1,y:0}});
  client.input({motion:{x:1,y:0}});
  const predicted = client.state!.player.x;
  expect(predicted).toBeGreaterThan(server.player.x);
  applyInput(server,sent[0]);
  client.reconcile(server);
  expect(client.state!.player.x).toBeCloseTo(predicted);
  applyInput(server,sent[1]);
  client.reconcile(server);
  expect(client.state!.player.x).toBeCloseTo(server.player.x);
});

test('all twelve seats are reachable, and plenary movement respects closed doors', () => {
  const outside = {x:480,y:517};
  for (const seat of PLENARY_SEATS) {
    expect(canStandInPlenary(seat.x,seat.y)).toBe(true);
    expect(findRoute(outside,seat).at(-1)).toEqual(seat);
    expect(findRoute(seat,outside,true)).toEqual([]);
    expect(findRoute(seat,PLENARY_SEATS[1],true).at(-1)).toEqual(PLENARY_SEATS[1]);
  }
  const state:ControlState = {
    player:{id:'p',nick:'P',character:0,x:480,y:748,moving:false,direction:0},
    route:[],ack:0,plenary:true,
  };
  applyInput(state,{seq:1,motion:{x:1,y:-1},plenary:true});
  expect(inPlenary(state.player)).toBe(true);
  expect(state.player.y).toBeLessThan(748);
  state.player.y = 548;
  applyInput(state,{seq:2,motion:{x:0,y:-1},plenary:true});
  expect(state.player.y).toBe(548);
  state.plenary = false;
  applyInput(state,{seq:3,motion:{x:0,y:-1}});
  expect(inPlenary(state.player)).toBe(false);
});

test('teleport reconciliation drops pending moves from the previous movement mode', () => {
  const client = new PredictedMovement(() => {});
  const player = {id:'p',nick:'P',character:0,x:140,y:146,moving:false,direction:0};
  client.reconcile({player,route:[],ack:0});
  client.input({motion:{x:1,y:0}});
  const seat = PLENARY_SEATS[0];
  client.reconcile({player:{...player,...seat},route:[],ack:0,plenary:true});
  expect(client.state?.player).toMatchObject(seat);
});


test('sprinting spends stamina in the shared movement step and falls back to walking when empty', () => {
  const state:ControlState = {
    player:{id:'p',nick:'P',character:0,x:140,y:146,direction:0,moving:false,speed:80,stamina:1.25,canSprint:true},
    route:[],ack:0,
  };
  const motion = {x:1,y:0};
  const sent:MovementInput[] = [];
  const client = new PredictedMovement(input=>sent.push(input));
  client.reconcile(state);
  client.input({motion,sprint:true});
  applyInput(state,readInput(sent[0])!);
  expect(state.player).toMatchObject({x:146,stamina:0,sprinting:true});
  client.reconcile(state);
  client.input({motion,sprint:true});
  applyInput(state,readInput(sent[1])!);
  expect(state.player).toMatchObject({x:150,stamina:0});
  expect(state.player.sprinting).toBeUndefined();
  expect(client.state?.player).toEqual(state.player);

  applyInput(state,{seq:3,motion});
  restMovement(state.player);
  expect(state.player.stamina).toBe(2);
  applyInput(state,{seq:4,motion,sprint:true});
  expect(state.player).toMatchObject({x:160,stamina:.75,sprinting:true});

  state.player.carrying = true;
  applyInput(state,{seq:5,motion,sprint:true});
  expect(state.player.x).toBeCloseTo(162.6);
  expect(state.player.sprinting).toBeUndefined();
  expect(state.player.stamina).toBe(1.75);
});

test('isolation prediction confines the player and discards movement on release',()=>{
  const client = new PredictedMovement(()=>{});
  const player = {id:'p',nick:'P',character:0,x:isolationRoom.spawn.x,y:662,moving:false,direction:0};
  client.reconcile({player,route:[],ack:0,isolated:true});
  client.input({motion:{x:0,y:-1}});
  expect(client.state?.player.y).toBe(662);
  client.reconcile({player:{...player,...isolationRoom.exit},route:[],ack:0});
  expect(client.state?.player).toMatchObject(isolationRoom.exit);
  client.input({motion:{x:0,y:-1}});
  expect(client.state?.player.y).toBeLessThan(isolationRoom.exit.y);
});

test('a restored movement controller resumes above the live room acknowledgement',()=>{
  const sent:MovementInput[] = [];
  const client = new PredictedMovement(input=>sent.push(input));
  const player = {id:'p',nick:'P',character:0,x:140,y:146,moving:false,direction:0};
  client.reconcile({player,route:[],ack:70});
  client.input({motion:{x:1,y:0}});
  expect(sent[0]?.seq).toBe(71);
  expect(client.state?.player.x).toBeGreaterThan(player.x);
});

test('prediction keeps the queue bounded and never replays old input after a same-phase teleport',()=>{
  const sent:MovementInput[] = [];
  const client = new PredictedMovement(input=>sent.push(input));
  const player = {id:'p',nick:'P',character:0,x:140,y:146,moving:false,direction:0};
  client.reconcile({player,route:[],ack:0,revision:1});
  for (let i=0;i<20;i++) client.input({motion:{x:1,y:0}});
  expect(sent).toHaveLength(8);
  expect(sent.every(input=>readInput(input)?.revision===1)).toBe(true);
  const spawn = {...player,y:190};
  client.reconcile({player:spawn,route:[],ack:0,revision:2});
  expect(client.state?.player).toEqual(spawn);
  expect(client.input({motion:{x:1,y:0}})).toBe(true);
  expect(sent.at(-1)).toMatchObject({seq:9,revision:2});
});

test('bursty confirmations and a stalled connection do not rewind predicted movement',()=>{
  const server:ControlState = {
    player:{id:'p',nick:'P',character:0,x:140,y:146,moving:false,direction:0,speed:12},
    route:[],ack:0,revision:1,
  };
  const wire:MovementInput[] = [];
  const client = new PredictedMovement(input=>wire.push(input));
  client.reconcile(server);
  let furthest = server.player.x;
  for (let tick=0;tick<45;tick++) {
    if (tick<32) client.input({motion:{x:1,y:0}});
    // Model a transport stall, followed by several queued packets arriving together.
    if (tick>=12 && wire.length) applyInput(server,readInput(wire.shift())!);
    else restMovement(server.player);
    if (tick%4===0 || tick===44) client.reconcile(server);
    const x = client.state!.player.x;
    expect(x+1e-6).toBeGreaterThanOrEqual(furthest);
    furthest = x;
    expect(wire.length).toBeLessThanOrEqual(8);
  }
  expect(wire).toHaveLength(0);
  expect(client.state!.player.x).toBeCloseTo(server.player.x);
  expect(server.player.x).toBeGreaterThan(150);
});
