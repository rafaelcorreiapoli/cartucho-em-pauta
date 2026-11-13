import {createRoot} from 'react-dom/client';
import {agendaProject,voteIntentSummary,type PlenaryView,type Vote} from '../plenary';

type Intent = Vote|'clear';
const choices = [['yes','Pretendo aprovar'],['no','Pretendo rejeitar'],['clear','Retirar']] as const;

export function ProjectIntents({view,id,declare}:{view:PlenaryView;id:string;declare:(intent:Intent)=>void}) {
  const summary = view.hearing ? '' : voteIntentSummary(view.voteIntents);
  const ownIntent = view.voteIntents?.find(intent=>intent.id===id)?.vote;
  const canDeclare = view.phase==='negotiation' && view.mandate && !view.politics?.suspended;
  return <>
    {summary && <p id="intent-summary" aria-label="Intenções de voto">{summary}</p>}
    {canDeclare && <div id="intent-controls" className="flex gap-2" role="group" aria-label="Declarar intenção de voto">
      {choices.filter(([vote])=>vote!=='clear' || ownIntent).map(([vote,label])=>
        <button key={vote} type="button" className="hud-button hud-button--secondary" data-intent={vote}
          aria-pressed={vote==='clear' ? undefined : ownIntent===vote} onClick={()=>declare(vote)}>{label}</button>)}
    </div>}
  </>;
}

function detailsState(view:PlenaryView) {
  const {hearing,phase} = view;
  const project = agendaProject(view);
  const objection = !hearing && (phase==='negotiation' || phase==='ballot') ? view.election?.objection : undefined;
  const clue = hearing ? '' : [
    view.auditNote,
    view.amended && 'Emenda protocolada. Os efeitos já estão atualizados.',
    view.reportedFraud ? 'Fraude denunciada. O painel mostra os números reais.' :
      view.audit==='fraud' ? 'Fraude encontrada. Vá ao Painel para corrigir os números.' :
      view.audit==='clean' ? 'A auditoria conferiu os valores do painel.' : '',
    view.role==='Infiltrado' && !view.canFraud && !view.reportedFraud &&
      'Você alterou os números que os outros veem no painel.',
  ].filter(Boolean).join(' ');
  return {
    title:hearing?.target ?? project.name,
    description:hearing ? '' : project.description,
    objection:objection ? `${objection} contestou o projeto: aprovação exige ${view.billQuorum} votos.` : '',
    hearingResult:view.hearingResult,
    clue,
  };
}

export function ProjectDetails({view,id,declare}:Parameters<typeof ProjectIntents>[0]) {
  const {title,description,objection,hearingResult,clue} = detailsState(view);
  return <>
    <h2 id="project-details-title">{title}</h2>
    <p id="bill-description">{description}</p>
    <ProjectIntents view={view} id={id} declare={declare}/>
    <p className="hud-feedback" id="bill-objection" hidden={!objection}>{objection}</p>
    <p className="hud-feedback" id="hearing-result" role="status" hidden={!hearingResult}>{hearingResult}</p>
    <p className="hud-feedback" id="clue" role="status" hidden={!clue}>{clue}</p>
  </>;
}

export function mountProjectDetails(host:HTMLElement,id:string,declare:(intent:Intent)=>void) {
  const root = createRoot(host);
  let key = '';
  return {
    render(view:PlenaryView) {
      const next = JSON.stringify([detailsState(view),view.phase,!!view.hearing,view.mandate,view.politics?.suspended,view.voteIntents]);
      if (next===key) return;
      key = next;
      root.render(<ProjectDetails view={view} id={id} declare={declare}/>);
    },
    destroy() { root.unmount(); },
  };
}
