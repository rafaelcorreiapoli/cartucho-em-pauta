import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { agendaProject, bills, type PlenaryView } from '../plenary';
import { DialogDismiss } from './dialog-dismiss';
import { ProjectImpact } from './project-impact';

type BriefActivity = 'secretary' | 'support';

export function LegislativeBrief({activity,view}:{activity:BriefActivity;view:PlenaryView}) {
  const project = agendaProject(view);
  const upcoming = view.queuedProjects?.filter(index=>bills[index]!==project) ?? [];
  return <>
    <header className="flex items-center justify-between gap-4">
      <h2 id="legislative-brief-title">{activity==='secretary' ? 'Pauta legislativa' : 'Impacto do projeto'}</h2>
      <DialogDismiss label="Fechar">×</DialogDismiss>
    </header>
    <h3>{project.name}</h3>
    <p>{project.description}</p>
    {activity==='support' ? <div className="flex flex-wrap gap-3">
      <ProjectImpact yes={view.yes} no={view.no} idPrefix="brief-"/>
    </div> : upcoming.length>0 && <>
      <h3>Próximos na pauta</h3>
      <ol>{upcoming.map(index=><li key={index}>{bills[index].name}</li>)}</ol>
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
