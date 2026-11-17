import {formatImpact,impactTone} from './impact-value';
import {useState} from 'react';
import {agendaProject,deficitStabilityLoss,type Outcome} from '../plenary';

function voteParticipation({abstentions=0,absences=0}:Outcome) {
  return [
    abstentions ? `${abstentions} ${abstentions===1 ? 'abstenção' : 'abstenções'}` : '',
    absences ? `${absences} sem voto` : '',
  ].filter(Boolean).join(' · ');
}

export function VoteHistory({outcomes}:{outcomes:readonly Outcome[]}) {
  const [selection,setSelection] = useState<{count:number;index:number}>();
  const latest = outcomes.length-1;
  const index = selection?.count===outcomes.length ? selection.index : latest;
  const outcome = outcomes[index];
  const recent = outcomes[latest];
  if (!outcome || !recent) return null;
  const participation = voteParticipation(outcome);
  const step = (delta:number) => setSelection({count:outcomes.length,index:Math.max(0,Math.min(latest,index+delta))});
  const threshold = `${outcome.needed} ${outcome.needed===1 ? 'voto' : 'votos'} a favor para passar`;
  const details = [
    `Estabilidade ${formatImpact(outcome.applied.stability)} · Orçamento ${formatImpact(outcome.applied.budget,true)}`,
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
        <p>{outcome.yes+outcome.no+(outcome.abstentions ?? 0)===0 ? 'Ninguém votou · ' : ''}{threshold}</p>
        {participation && <p>{participation}</p>}
        <p id="outcome">{details}</p>
        {outcome.proposer && <p>Protocolado por {outcome.proposer}</p>}
      </div>
    </section>
    <div className="sr-only" role="status">{agendaProject(recent).name}: {recent.passed ? 'aprovado' : 'rejeitado'}. {recent.yes} a favor, {recent.no} contra. {voteParticipation(recent)}</div>
  </>;
}

export function VoteBrief({outcome}:{outcome:Outcome}) {
  const participation = voteParticipation(outcome);
  const scores = [
    {id:'yes',label:'Votos a favor',icon:'check',value:outcome.yes},
    {id:'no',label:'Votos contra',icon:'cross',value:outcome.no},
    {id:'stability',label:'Variação de estabilidade',icon:'shield',value:outcome.applied.stability,delta:true},
    {id:'budget',label:'Variação do orçamento',icon:'wallet',value:outcome.applied.budget,delta:true},
  ];
  return <>
    <div><strong id="brief-verdict">{outcome.passed ? 'Projeto aprovado' : 'Projeto rejeitado'}</strong><span id="brief-project">{agendaProject(outcome).name}</span></div>
    {participation && <small>{participation}</small>}
    <div className="brief-scores">
      {scores.map(({id,label,icon,value,delta})=><span key={id} title={label}>
        <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+icon}/></svg>
        <strong id={'brief-'+id} data-effect={delta ? impactTone(value) : undefined}>{delta ? formatImpact(value,id==='budget') : value}</strong>
      </span>)}
    </div>
  </>;
}
