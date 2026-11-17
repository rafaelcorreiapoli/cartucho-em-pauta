import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { agendaProject, bills, type PlenaryView } from '../plenary';
import { describeEvidence } from '../politics';
import { DialogDismiss } from './dialog-dismiss';

type BriefActivity = 'secretary' | 'archive';

function PublicRecords({politics}:Pick<PlenaryView,'politics'>) {
  const records = politics?.ledger ?? [];
  if (!records.length) return <p>Nenhum registro público.</p>;
  const names = new Map(politics?.directory.map(({id,name})=>[id,name]));
  return <ol className="grid gap-2">{records.slice().reverse().map(record=>
    <li key={record.id}>{describeEvidence(record,id=>names.get(id) ?? 'Jogador')}</li>
  )}</ol>;
}

const briefTitles = {secretary:'Pauta legislativa',archive:'Registro público'};

export function LegislativeBrief({activity,view}:{activity:BriefActivity;view:PlenaryView}) {
  const project = agendaProject(view);
  const upcoming = view.queuedProjects?.filter(index=>bills[index]!==project) ?? [];
  return <>
    <header className="flex items-center justify-between gap-4">
      <h2 id="legislative-brief-title">{briefTitles[activity]}</h2>
      <DialogDismiss label="Fechar"/>
    </header>
    {activity==='archive' ? <PublicRecords politics={view.politics}/> : <>
      <h3>{project.name}</h3>
      <p>{project.description}</p>
      {upcoming.length>0 && <>
        <h3>Próximos na pauta</h3>
        <ol>{upcoming.map(index=><li key={index}>{bills[index].name}</li>)}</ol>
      </>}
    </>}
  </>;
}

export function mountLegislativeBrief(dialog:HTMLDialogElement) {
  const root = createRoot(dialog);
  return {
    open(activity:BriefActivity,view:PlenaryView) {
      flushSync(()=>root.render(<LegislativeBrief activity={activity} view={view}/>));
      if (!dialog.open) dialog.showModal();
    },
    close() { if (dialog.open) dialog.close(); },
    destroy() {
      if (dialog.open) dialog.close();
      root.unmount();
    },
  };
}
