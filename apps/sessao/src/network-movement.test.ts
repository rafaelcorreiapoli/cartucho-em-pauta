import { expect, test } from 'bun:test';
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
