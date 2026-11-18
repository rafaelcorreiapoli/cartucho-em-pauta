import {HudHelp} from './hud-help';
import {billVoteKeys,projectVoteLabels} from './ballot-shortcuts';
import {formatImpact,impactTone} from './impact-value';
import {HudIcon} from './hud-icon';
import {useState,type CSSProperties} from 'react';
import {agendaProject,bills,BALLOT_MS,pingaProgram,type BillVote,type Impact,type PlenaryView} from '../plenary';
import {money} from '../politics';
import {PhoneContactFace} from './phone-call';
import './project-ballot.css';

const choices = [
  {vote:'yes',label:'SIM',action:projectVoteLabels.yes,key:billVoteKeys.yes,symbol:'✓'},
  {vote:'no',label:'NÃO',action:projectVoteLabels.no,key:billVoteKeys.no,symbol:'×'},
  {vote:'abstain',label:'Abstenções',action:projectVoteLabels.abstain,key:billVoteKeys.abstain,symbol:'○'},
] as const;


function ImpactValue({value,currency=false}:{value:number;currency?:boolean}) {
  return <b className="project-impact-value" data-effect={impactTone(value)}>{formatImpact(value,currency)}</b>;
}

export function ProjectImpact({impact,budget,approved,detail}:{impact:Impact;budget:number;approved:boolean;detail?:string}) {
  const balance = Math.round((budget+Math.min(0,impact.budget))*10)/10;
  return <div className="project-ballot-impact" data-choice={approved?'yes':'no'}>
    <strong><HudIcon name={approved?'check':'cross'}/>{approved?'Se aprovado':'Se rejeitado'}</strong>
    <span><HudIcon name="shield"/><ImpactValue value={impact.stability}/> Estabilidade</span>
    <span><HudIcon name="wallet"/><ImpactValue value={impact.budget} currency/> do orçamento</span>
    {balance<0 && <small className="project-ballot-deficit">Dívida após a votação de {money(-balance)}</small>}
    {detail && <small>{detail}</small>}
  </div>;
}

type Props = Pick<PlenaryView,'round'|'project'|'proposer'|'remaining'|'budget'|'yes'|'no'|'billQuorum'|'billVoters'|'vote'|'botMessages'> & {
  ownId:string; eligible:boolean; onExpansion?:(expanded:boolean)=>void; cast:(choice:BillVote)=>void;
};

export function ProjectBallot({round,project,proposer,remaining,budget,yes,no,billQuorum,billVoters=[],vote,botMessages,ownId,eligible,cast,onExpansion}:Props) {
  const [expanded,setExpanded] = useState(true);
  const bill = agendaProject({round,project});
  const index = project ?? round%bills.length;
  const counts = {yes:0,no:0,abstain:0,pending:0};
  for (const person of billVoters) counts[person.vote ?? 'pending']++;

  const self = billVoters.find(person=>person.id===ownId);
  const clock = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  return <section className="project-ballot" aria-label="Votação de projeto">
    <HudHelp className="project-ballot-handle" help={expanded ? "Recolha o painel de votação." : "Abra o painel para acompanhar e votar."} aria-expanded={expanded} aria-controls="project-ballot-body"
      aria-label={expanded?'Recolher votação':'Expandir votação'} onClick={()=>{ setExpanded(!expanded); onExpansion?.(!expanded); }}>
      <svg className="hud-glyph project-ballot-chevron" viewBox="0 0 12 12" aria-hidden="true">
        <path d="M2 4l4 4 4-4"/>
      </svg>
      {!expanded && <><strong>{bill.name}{proposer && <small> · {proposer}</small>}</strong><time>{clock}</time></>}
    </HudHelp>
    <div className="project-ballot-body" id="project-ballot-body" hidden={!expanded}>
      <div className="project-ballot-project">
        <header className="project-ballot-banner">
          <img className="project-ballot-art" src={import.meta.env.BASE_URL+'assets/'+bill.icon} width="72" height="72" alt=""/>
          <div className="project-ballot-title"><small>Projeto {String(index+1).padStart(2,'0')}</small><h2>{bill.name}</h2>{proposer && <small>Protocolado por {proposer}</small>}<p>{bill.description}</p></div>
          <ProjectImpact impact={yes} budget={budget} approved detail={bill.effect?.kind==='allowance' ? 'Pagamento único por mandato' :
            bill.effect?.kind==='treasury-xp' ? `Até +${bill.effect.bonus} XP por entrega · ${bill.effect.duration/1000} s` :
            bill.effect?.kind==='pinga-distribution' ? pingaProgram.detail : bill.effect?.kind==='policy' ? bill.effect.detail : bill.effect?.kind==='fire-safety' ? 'Mais tempo entre incêndios até o fim da partida' : undefined}/>
          <ProjectImpact impact={no} budget={budget} approved={false}/>
        </header>
        {botMessages?.length ? <ul className="project-ballot-discussion" aria-label="Falas dos bots no Plenário" aria-live="polite">
          {botMessages.map(({name,text})=><li key={name}><strong>{name}</strong> {text}</li>)}
        </ul> : null}
      </div>
      <div className="project-ballot-content">
        <div className="project-ballot-timer">
          <HudIcon name="ballot"/><strong>Votação em andamento</strong>
          <progress className="animated-progress" aria-label="Tempo restante" value={remaining} max={BALLOT_MS/1000}
            style={{'--meter-ratio':remaining/(BALLOT_MS/1000)} as CSSProperties}/>
          <time><HudIcon name="clock"/>{clock}</time>
        </div>
        <div className="project-ballot-score">
          <div className="project-ballot-summary">
            {choices.map(({vote:choice,label})=><span key={choice} data-choice={choice}>{label} <strong>{counts[choice]}</strong></span>)}
            <span data-choice="pending">Pendentes <strong>{counts.pending}</strong></span>
            <span>Total <strong>{billVoters.length}</strong></span><span>{billQuorum} para aprovar</span>
          </div>
          {billVoters.length>0 && <ul className="project-ballot-roster" aria-label="Votos dos parlamentares">
            {billVoters.map(person=>{
              const state = person.vote ?? 'pending';
              const label = state==='yes' ? 'SIM' : state==='no' ? 'NÃO' : state==='abstain' ? 'Abstenção' : 'Pendente';
              return <HudHelp as="li" key={person.id} data-choice={state} data-vote-state={state} help={`${person.name} · ${label}`}>
                <PhoneContactFace person={person}/><span className="project-voter-name">{person.name}</span>
                <b><span aria-hidden="true">{state==='abstain' ? '○' : state==='pending' ? '?' : label}</span><span className="sr-only">{label}</span></b>
              </HudHelp>;
            })}
          </ul>}
        </div>
      </div>
      <footer className="project-ballot-footer">
        <div className="project-ballot-self">{self && <PhoneContactFace person={self}/>}
          <div>Seu voto<strong role="status">{vote ? vote==='abstain'?'Abstenção':vote==='yes'?'SIM':'NÃO' : eligible?'Aguardando…':'Sem direito a voto'}</strong></div>
        </div>
        {choices.map(choice=><HudHelp help={choice.vote==="abstain" ? "Registre uma abstenção." : choice.vote==="yes" ? "Vote a favor do projeto." : "Vote contra o projeto."} key={choice.vote} className="project-vote-button" data-choice={choice.vote}
          data-vote={choice.vote} aria-keyshortcuts={choice.key} aria-pressed={vote===choice.vote} disabled={!eligible}
          onClick={()=>cast(choice.vote)}><b aria-hidden="true">{choice.symbol}</b>{choice.action}<kbd className="action-key" aria-hidden="true">{choice.key}</kbd></HudHelp>)}
      </footer>
    </div>
  </section>;
}
