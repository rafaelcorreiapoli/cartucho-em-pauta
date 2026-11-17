import {agendaProject,voteIntentSummary,type PlenaryView,type Vote} from '../plenary';

type Intent = Vote|'clear';
const choices = [['yes','Pretendo aprovar'],['no','Pretendo rejeitar'],['clear','Retirar']] as const;

export function ProjectIntents({view,id,declare}:{view:PlenaryView;id:string;declare:(intent:Intent)=>void}) {
  const summary = view.hearing || view.projectVoteExpired ? '' : voteIntentSummary(view.voteIntents);
  const ownIntent = view.voteIntents?.find(intent=>intent.id===id)?.vote;
  const canDeclare = view.phase==='negotiation' && view.project!==undefined && !view.projectVoteExpired && !view.cassationIn && view.mandate && !view.politics?.suspended;
  return <>
    {summary && <p id="intent-summary" aria-label="Intenções de voto">{summary}</p>}
    {canDeclare && <div id="intent-controls" className="flex gap-2" role="group" aria-label="Declarar intenção de voto">
      {choices.filter(([vote])=>vote!=='clear' || ownIntent).map(([vote,label])=>
        <button key={vote} type="button" className="hud-button hud-button--secondary" data-intent={vote}
          aria-pressed={vote==='clear' ? undefined : ownIntent===vote} onClick={()=>declare(vote)}>{label}</button>)}
    </div>}
  </>;
}

export function projectDetailsState(view:PlenaryView) {
  const {hearing,phase} = view;
  const project = view.project===undefined ? undefined : agendaProject(view);
  const objection = !hearing && (phase==='negotiation' || phase==='ballot') ? view.election?.objection : undefined;
  const clue = hearing ? '' : [
    view.auditNote,
    view.reportedFraud ? 'Fraude denunciada. O painel mostra os números reais.' :
      view.audit==='fraud' ? 'Fraude encontrada. Vá ao Painel para corrigir os números.' :
      view.audit==='clean' ? 'A auditoria conferiu os valores do painel.' : '',
    project && !view.projectVoteExpired && view.role==='Infiltrado' && !view.canFraud && !view.reportedFraud &&
      'Você alterou os números que os outros veem no painel.',
  ].filter(Boolean).join(' ');
  return {
    title:hearing?.target ?? project?.name ?? 'Nenhum projeto em pauta',
    description:hearing ? '' : project?.description ?? 'Escolha um projeto na Secretaria e leve o documento ao Protocolo.',
    electorate:phase==='negotiation' ? view.electorate : undefined,
    quorum:phase==='negotiation' && project ? view.billQuorum : undefined,
    objection:objection ? `${objection} contestou o projeto.` : '',
    hearingResult:view.hearingResult,
    clue,
  };
}

export function ProjectDetails({view,id,declare}:Parameters<typeof ProjectIntents>[0]) {
  const {title,description,electorate,quorum,objection,hearingResult,clue} = projectDetailsState(view);
  return <>
    <h2 id="project-details-title">{title}</h2>
    <p id="bill-description">{description}</p>
    {electorate!==undefined && <p>Parlamentares aptos a votar: {electorate}{quorum!==undefined && ` · Votos a favor para aprovar: ${quorum}`}</p>}
    <ProjectIntents view={view} id={id} declare={declare}/>
    <p className="hud-feedback" id="bill-objection" hidden={!objection}>{objection}</p>
    <p className="hud-feedback" id="hearing-result" role="status" hidden={!hearingResult}>{hearingResult}</p>
    <p className="hud-feedback" id="clue" role="status" hidden={!clue}>{clue}</p>
  </>;
}
