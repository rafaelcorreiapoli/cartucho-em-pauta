import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { CSSProperties } from 'react';
import type { ElectionView } from './elections';
import type { PlenaryView } from './plenary';

export function ElectionResult({result}:{result:NonNullable<ElectionView['result']>}) {
  return <section className="grid gap-2">
    <h3>Renovação de Mandato {result.cycle}</h3>
    {result.offices.map((person,index)=>{
      const lost = person.id===result.eliminated;
      const portrait = {'--portrait-column':person.character%2,'--portrait-row':Math.floor(person.character/2)} as CSSProperties;
      return <div className="result-winner" key={person.id} data-effect={lost ? 'loss' : 'neutral'}>
        <span className="portrait" aria-hidden="true" style={portrait}/>
        <span>{index+1}º · {person.name}{lost && <small>Mandato perdido</small>}</span>
        <strong className="tabular-nums">{person.percentage}%</strong>
      </div>;
    })}
  </section>;
}

export function SessionResult({winner,reason,infiltratorName}:Pick<PlenaryView,'winner'|'reason'|'infiltratorName'>) {
  const headline = winner==='Parlamentar' ? 'Os parlamentares venceram' :
    winner==='Infiltrado' ? 'A infiltração venceu' : 'Sessão encerrada';
  return <section>
    <h3>{headline}</h3>
    {reason && <p>{reason}</p>}
    {infiltratorName && <p>Infiltração: <strong>{infiltratorName}</strong></p>}
  </section>;
}

export function mountResults() {
  const dialog = document.querySelector<HTMLDialogElement>('#result-dialog')!;
  const root = createRoot(document.querySelector('#result-content')!);
  return {
    render(view:PlenaryView, previous:PlenaryView | undefined) {
      const election = view.election?.result;
      const electionChanged = election && election.cycle!==previous?.election?.result?.cycle;
      const project = view.outcome;
      const projectChanged = project && project.round!==previous?.outcome?.round;
      const finished = view.phase==='finished' && previous?.phase!=='finished';
      if (finished || electionChanged) {
        flushSync(()=>root.render(<>
          {finished && <SessionResult {...view}/>}
          {electionChanged && <ElectionResult result={election}/>}
        </>));
        document.querySelector<HTMLDialogElement>('#campaign-dialog')?.close();
        document.querySelector<HTMLDialogElement>('#gameplay-dialog')?.close();
        if (!dialog.open) dialog.showModal();
      }
      return projectChanged ? project.passed ? 'approved' : 'rejected' : electionChanged ? 'election' : undefined;
    },
    destroy() { dialog.close(); root.unmount(); },
  };
}
