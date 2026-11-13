import {expect,test} from 'bun:test';
import {createGameplayMetrics} from './gameplay-metrics';

test('metrics expose aggregate counts and log discrepancies privately',()=>{
  const alerts:string[] = [];
  const metrics = createGameplayMetrics(message=>alerts.push(message));
  metrics.increment('matches_started');
  metrics.finish('private-room',0);
  expect(alerts).toEqual([]);
  metrics.increment('matches_started');
  metrics.increment('reconnects');
  metrics.finish('private-room',-0.5);
  expect(alerts.map(alert=>JSON.parse(alert))).toEqual([{event:'economy-discrepancy',roomId:'private-room',discrepancy:-0.5}]);
  const exposition = metrics.exposition();
  expect(exposition).toContain('congresso_matches_started_total 2\n');
  expect(exposition).toContain('congresso_matches_finished_total 2\n');
  expect(exposition).toContain('congresso_reconnects_total 1\n');
  expect(exposition).toContain('congresso_economy_discrepancies_total 1\n');
  expect(exposition).not.toContain('private-room');
});
