import {formatImpact,impactTone} from './impact-value';
import {agendaProject,type Outcome} from '../plenary';

function voteParticipation({abstentions=0,absences=0}:Outcome) {
  return [
    abstentions ? `${abstentions} ${abstentions===1 ? 'abstenção' : 'abstenções'}` : '',
    absences ? `${absences} sem voto` : '',
  ].filter(Boolean).join(' · ');
}

export function VoteBrief({outcome,stabilityEnabled=true}:{outcome:Outcome;stabilityEnabled?:boolean}) {
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
      {scores.filter(score=>stabilityEnabled || score.id!=='stability').map(({id,label,icon,value,delta})=><span key={id} title={label}>
        <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+icon}/></svg>
        <strong id={'brief-'+id} data-effect={delta ? impactTone(value) : undefined}>{delta ? formatImpact(value,id==='budget') : value}</strong>
      </span>)}
    </div>
  </>;
}
