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

type Props = Pick<PlenaryView,'round'|'project'|'proposer'|'remaining'|'budget'|'yes'|'no'|'billQuorum'|'billVoters'|'vote'> & {
  ownId:string; eligible:boolean; onExpansion?:(expanded:boolean)=>void; cast:(choice:BillVote)=>void;
};

export function ProjectBallot({round,project,proposer,remaining,budget,yes,no,billQuorum,billVoters=[],vote,ownId,eligible,cast,onExpansion}:Props) {
  const [expanded,setExpanded] = useState(true);
  const bill = agendaProject({round,project});
  const index = project ?? round%bills.length;
  const art = bill.banner;
  const voters = (choice?:BillVote) => billVoters.filter(person=>person.vote===choice);
  const count = (choice?:BillVote) => voters(choice).length;

  function portraits(choice?:BillVote) {
    const label = choice==='yes' ? 'SIM' : choice==='no' ? 'NÃO' : choice==='abstain' ? 'Abstenção' : 'Pendente';
    return <ul aria-label={label}>{voters(choice).map(person=>
      <li key={person.id} data-vote-state={choice ?? 'pending'} title={person.name}>
        <PhoneContactFace person={person}/><span className="project-voter-name">{person.name}</span>
        <b aria-label={label}>{choice==='abstain' ? '○' : choice ? label : '?'}</b>
      </li>)}</ul>;
  }

  function side(choice:'yes'|'no',label:string,badge:string) {
    return <section data-choice={choice} aria-label={label} className="project-ballot-group">
      <div className="project-ballot-count"><span>{label}</span><strong><i aria-hidden="true">{badge}</i>{count(choice)}</strong></div>
      {portraits(choice)}
    </section>;
  }

  const self = billVoters.find(person=>person.id===ownId);
  const clock = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  return <section className="project-ballot" aria-label="Votação de projeto">
    <button className="project-ballot-handle" type="button" aria-expanded={expanded} aria-controls="project-ballot-body"
      aria-label={expanded?'Recolher votação':'Expandir votação'} onClick={()=>{ setExpanded(!expanded); onExpansion?.(!expanded); }}>
      <span aria-hidden="true">{expanded?'⌄':'⌃'}</span>
      {!expanded && <><strong>{bill.name}{proposer && <small> · {proposer}</small>}</strong><time>{clock}</time></>}
    </button>
    <div className="project-ballot-body" id="project-ballot-body" hidden={!expanded}>
      <header className="project-ballot-banner" data-project={index}>
        <div className="project-ballot-art" aria-hidden="true">
          {art ? <img data-banner={index===0 ? '' : undefined} src={import.meta.env.BASE_URL+'assets/'+art} alt=""/> : <HudIcon name="wifi"/>}
        </div>
        <div className="project-ballot-title"><small>Projeto {String(index+1).padStart(2,'0')}</small><h2>{bill.name}</h2>{proposer && <small>Protocolado por {proposer}</small>}<p>{bill.description}</p></div>
        <ProjectImpact impact={yes} budget={budget} approved detail={bill.effect?.kind==='allowance' ? 'Pagamento único por mandato' :
          bill.effect?.kind==='treasury-reputation' ? `Até +${bill.effect.bonus} popularidade por entrega · ${bill.effect.duration/1000} s` :
          bill.effect?.kind==='pinga-distribution' ? pingaProgram.detail : bill.effect?.kind==='policy' ? bill.effect.detail : bill.effect?.kind==='fire-safety' ? 'Mais tempo entre incêndios até o fim da partida' : undefined}/>
        <ProjectImpact impact={no} budget={budget} approved={false}/>
      </header>
      <div className="project-ballot-timer">
        <HudIcon name="ballot"/><strong>Votação em andamento</strong>
        <progress className="animated-progress" aria-label="Tempo restante" value={remaining} max={BALLOT_MS/1000}
          style={{'--meter-ratio':remaining/(BALLOT_MS/1000)} as CSSProperties}/>
        <time><HudIcon name="clock"/>{clock}</time>
      </div>
      <div className="project-ballot-score">
        {side('yes','SIM','✓')}
        <div className="project-ballot-group project-ballot-neutral" data-choice="pending">
          <div className="project-ballot-neutral-lists">
            <section aria-label="Pendentes">
              <div className="project-ballot-count">Pendentes <strong>{count()}</strong></div>
              {portraits()}
            </section>
            {count('abstain')>0 && <section aria-label="Abstenções" data-choice="abstain">
              <div className="project-ballot-count">Abstenções <strong>{count('abstain')}</strong></div>
              {portraits('abstain')}
            </section>}
          </div>
        </div>
        {side('no','NÃO','×')}
      </div>
      <div className="project-ballot-summary">
        {choices.map(({vote:choice,label})=><span key={choice} data-choice={choice}>{label} <strong>{count(choice)}</strong></span>)}
        <span data-choice="pending">Pendentes <strong>{count(undefined)}</strong></span>
        <span>Total <strong>{billVoters.length}</strong></span><span>{billQuorum} para aprovar</span>
      </div>
      <footer className="project-ballot-footer">
        <div className="project-ballot-self">{self && <PhoneContactFace person={self}/>}
          <div>Seu voto<strong role="status">{vote ? vote==='abstain'?'Abstenção':vote==='yes'?'SIM':'NÃO' : eligible?'Aguardando…':'Sem direito a voto'}</strong></div>
        </div>
        {choices.map(choice=><button key={choice.vote} type="button" className="project-vote-button" data-choice={choice.vote}
          data-vote={choice.vote} aria-keyshortcuts={choice.key} aria-pressed={vote===choice.vote} disabled={!eligible}
          onClick={()=>cast(choice.vote)}><b aria-hidden="true">{choice.symbol}</b>{choice.action}<kbd className="action-key" aria-hidden="true">{choice.key}</kbd></button>)}
      </footer>
    </div>
  </section>;
}
