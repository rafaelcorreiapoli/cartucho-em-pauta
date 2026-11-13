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

test('simulation metrics separate late ticks from expensive synchronous work',()=>{
  const metrics = createGameplayMetrics();
  metrics.observeSimulation(undefined,2);
  metrics.observeSimulation(100,50);
  metrics.observeSimulation(101,4);
  metrics.observeSimulation(50,51);
  const exposition = metrics.exposition();
  expect(exposition).toContain('congresso_simulation_ticks_total 4\n');
  expect(exposition).toContain('congresso_simulation_gaps_over_100ms_total 1\n');
  expect(exposition).toContain('congresso_simulation_work_over_50ms_total 1\n');
});
