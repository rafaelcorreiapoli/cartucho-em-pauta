import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {agendaProject,deficitStabilityLoss,type Outcome} from '../plenary';

export function VoteHistory({outcomes}:{outcomes:readonly Outcome[]}) {
  const [selection,setSelection] = useState<{count:number;index:number}>();
  const latest = outcomes.length-1;
  const index = selection?.count===outcomes.length ? selection.index : latest;
  const outcome = outcomes[index];
  const recent = outcomes[latest];
  if (!outcome || !recent) return null;
  const step = (delta:number) => setSelection({count:outcomes.length,index:Math.max(0,Math.min(latest,index+delta))});
  const signed = (value:number) => value>0 ? '+'+value : String(value);
  const threshold = `${outcome.needed} ${outcome.needed===1 ? 'voto' : 'votos'} a favor para passar`;
  const details = [
    `Estabilidade ${signed(outcome.applied.stability)} · Orçamento ${signed(outcome.applied.budget)}`,
    outcome.deficit ? `Déficit: −${deficitStabilityLoss(outcome.deficit)} de estabilidade` : '',
    outcome.fraud ? 'O painel foi fraudado' : '',
  ].filter(Boolean).join(' · ');
  return <>
    <summary><svg className="hud-glyph" aria-hidden="true"><use href="#icon-ballot"/></svg><strong>Histórico</strong></summary>
    <section id="last-vote" className="vote-result" aria-label="Resultado" data-result={outcome.passed ? 'passed' : 'failed'}>
      <header>
        <button type="button" aria-label="Votação anterior" disabled={index===0} onClick={()=>step(-1)}>‹</button>
        <span className="vote-result-title" aria-live="polite"><strong id="outcome-summary">{outcome.passed ? 'Passou!' : 'Caiu!'}</strong><span id="outcome-bill">{agendaProject(outcome).name}</span></span>
        <button type="button" aria-label="Próxima votação" disabled={index===latest} onClick={()=>step(1)}>›</button>
      </header>
      <div id="vote-pages" role="group" aria-label={`Votação ${index+1} de ${outcomes.length}`}>
        {outcomes.map((result,page)=><span key={result.round} aria-hidden="true" data-current={page===index}/>)}
      </div>
      <div className="vote-result-body">
        <div className="vote-scoreboard">
          <div className="vote-team vote-team-yes">
            <span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-check"/></svg> A favor</span><strong>{outcome.yes}</strong>
          </div>
          <span className="vote-versus" aria-hidden="true">×</span>
          <div className="vote-team vote-team-no">
            <span><svg className="hud-glyph" aria-hidden="true"><use href="#icon-cross"/></svg> Contra</span><strong>{outcome.no}</strong>
          </div>
        </div>
        <p>{outcome.yes+outcome.no===0 ? 'Ninguém votou · ' : ''}{threshold}</p>
        <p id="outcome">{details}</p>
      </div>
    </section>
    <div className="sr-only" role="status">{agendaProject(recent).name}: {recent.passed ? 'aprovado' : 'rejeitado'}. {recent.yes} a favor, {recent.no} contra.</div>
  </>;
}

export function mountVoteHistory(history:HTMLDetailsElement) {
  const root = createRoot(history);
  return {
    render(outcomes:readonly Outcome[]) {
      history.hidden = !outcomes.length;
      if (!outcomes.length) history.open = false;
      root.render(outcomes.length ? <VoteHistory outcomes={outcomes}/> : null);
    },
    destroy() {
      history.open = false;
      history.hidden = true;
      root.unmount();
    },
  };
}
