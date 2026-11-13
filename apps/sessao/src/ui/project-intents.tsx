import {createRoot} from 'react-dom/client';
import {voteIntentSummary,type PlenaryView,type Vote} from '../plenary';

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

export function mountProjectIntents(host:HTMLElement,id:string,declare:(intent:Intent)=>void) {
  const root = createRoot(host);
  let key = '';
  return {
    render(view:PlenaryView) {
      const next = JSON.stringify([view.phase,!!view.hearing,view.mandate,view.politics?.suspended,view.voteIntents]);
      if (next===key) return;
      key = next;
      root.render(<ProjectIntents view={view} id={id} declare={declare}/>);
    },
    destroy() { root.unmount(); },
  };
}
