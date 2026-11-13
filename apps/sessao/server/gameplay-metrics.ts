const metrics = {
  simulation_ticks: 'Simulation ticks in active rooms.',
  simulation_gaps_over_100ms: 'Active room ticks starting more than 100 ms after the previous tick.',
  simulation_work_over_50ms: 'Active room ticks whose synchronous work exceeds 50 ms.',
  matches_started: 'Matches started.',
  matches_finished: 'Matches finished or abandoned.',
  reconnects: 'Players who reconnected to an active match.',
  economy_discrepancies: 'Finished matches with a nonzero economy discrepancy.',
} as const;

export function createGameplayMetrics(alert:(message:string)=>void = message=>console.error(message)) {
  const counts = new Map<keyof typeof metrics,number>();
  function increment(metric:keyof typeof metrics) {
    counts.set(metric,(counts.get(metric) ?? 0)+1);
  }
  return {
    increment,
    observeSimulation(gapMs:number|undefined,workMs:number) {
      increment('simulation_ticks');
      if (gapMs!==undefined && gapMs>100) increment('simulation_gaps_over_100ms');
      if (workMs>50) increment('simulation_work_over_50ms');
    },
    finish(roomId:string,discrepancy:number) {
      increment('matches_finished');
      if (!discrepancy) return;
      increment('economy_discrepancies');
      alert(JSON.stringify({event:'economy-discrepancy',roomId,discrepancy}));
    },
    exposition() {
      return (Object.keys(metrics) as (keyof typeof metrics)[]).map(metric=>{
        const name = `congresso_${metric}_total`;
        return `# HELP ${name} ${metrics[metric]}\n# TYPE ${name} counter\n${name} ${counts.get(metric) ?? 0}\n`;
      }).join('');
    },
  };
}

export const gameplayMetrics = createGameplayMetrics();
