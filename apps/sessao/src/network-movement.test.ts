import { expect, test } from 'bun:test';
import { canStandInPlenary, inPlenary, PLENARY_SEATS } from './map';
import { findRoute } from './navigation';
import { PredictedMovement } from './network-movement';
import { applyInput, type ControlState, type MovementInput } from './movement';

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
