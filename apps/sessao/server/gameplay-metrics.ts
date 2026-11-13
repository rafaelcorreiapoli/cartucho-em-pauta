const metrics = {
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
