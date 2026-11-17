import {useState,type CSSProperties} from 'react';
import {agendaProject,bills,BALLOT_MS,pingaProgram,type BillVote,type Impact,type PlenaryView} from '../plenary';
import {PhoneContactFace} from './phone-call';
import './project-ballot.css';

const choices = [
  {vote:'yes',label:'SIM',action:'Votar SIM',key:'Y',symbol:'✓'},
  {vote:'no',label:'NÃO',action:'Votar NÃO',key:'R',symbol:'×'},
  {vote:'abstain',label:'Abstenções',action:'Abster-se',key:'N',symbol:'○'},
] as const;


function Glyph({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

function ImpactValue({value,currency=false}:{value:number;currency?:boolean}) {
  const effect = value>0 ? 'gain' : value<0 ? 'loss' : 'neutral';
  const sign = value>0 ? '+' : value<0 ? '−' : '';
  const amount = currency ? `R$ ${Math.round(Math.abs(value)*10)} mil` : Math.abs(value);
  return <b className="project-impact-value" data-effect={effect}>{sign}{amount}</b>;
}

export function ProjectImpact({impact,approved,detail}:{impact:Impact;approved:boolean;detail?:string}) {
  return <div className="project-ballot-impact" data-choice={approved?'yes':'no'}>
    <strong><Glyph name={approved?'check':'cross'}/>{approved?'Se aprovado':'Se rejeitado'}</strong>
    <span><Glyph name="shield"/><ImpactValue value={impact.stability}/> Estabilidade</span>
    <span><Glyph name="wallet"/><ImpactValue value={impact.budget} currency/> do orçamento</span>
    {detail && <small>{detail}</small>}
  </div>;
}

type Props = Pick<PlenaryView,'round'|'project'|'proposer'|'remaining'|'yes'|'no'|'billQuorum'|'billVoters'|'vote'> & {
  ownId:string; eligible:boolean; cast:(choice:BillVote)=>void;
};

export function ProjectBallot({round,project,proposer,remaining,yes,no,billQuorum,billVoters=[],vote,ownId,eligible,cast}:Props) {
  const [expanded,setExpanded] = useState(true);
  const bill = agendaProject({round,project});
  const index = project ?? round%bills.length;
  const art = bill.banner;
  const groups = [
    {key:'yes',label:'SIM',badge:'✓'},
    {key:'pending',label:'Pendentes',badge:'?'},
    {key:'no',label:'NÃO',badge:'×'},
  ] as const;
  const count = (choice:BillVote|undefined) => billVoters.filter(person=>person.vote===choice).length;
  const self = billVoters.find(person=>person.id===ownId);
  const clock = `${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  return <section className="project-ballot" aria-label="Votação de projeto">
    <button className="project-ballot-handle" type="button" aria-expanded={expanded} aria-controls="project-ballot-body"
      aria-label={expanded?'Recolher votação':'Expandir votação'} onClick={()=>setExpanded(!expanded)}>
      <span aria-hidden="true">{expanded?'⌄':'⌃'}</span>
      {!expanded && <><strong>{bill.name}{proposer && <small> · {proposer}</small>}</strong><time>{clock}</time></>}
    </button>
    <div className="project-ballot-body" id="project-ballot-body" hidden={!expanded}>
      <header className="project-ballot-banner" data-project={index}>
        <div className="project-ballot-art" aria-hidden="true">
          {art ? <img data-banner={index===0 ? '' : undefined} src={import.meta.env.BASE_URL+'assets/'+art} alt=""/> : <Glyph name="wifi"/>}
        </div>
        <div className="project-ballot-title"><small>Projeto {String(index+1).padStart(2,'0')}</small><h2>{bill.name}</h2>{proposer && <small>Protocolado por {proposer}</small>}<p>{bill.description}</p></div>
        <ProjectImpact impact={yes} approved detail={bill.effect?.kind==='allowance' ? 'Pagamento único por mandato' :
          bill.effect?.kind==='treasury-reputation' ? `Até +${bill.effect.bonus} popularidade por entrega · ${bill.effect.duration/1000} s` :
          bill.effect?.kind==='pinga-distribution' ? pingaProgram.detail : bill.effect?.kind==='policy' ? bill.effect.detail : bill.effect?.kind==='fire-safety' ? 'Mais tempo entre incêndios até o fim da partida' : undefined}/>
        <ProjectImpact impact={no} approved={false}/>
      </header>
      <div className="project-ballot-timer">
        <Glyph name="ballot"/><strong>Votação em andamento</strong>
        <progress className="animated-progress" aria-label="Tempo restante" value={remaining} max={BALLOT_MS/1000}
          style={{'--meter-ratio':remaining/(BALLOT_MS/1000)} as CSSProperties}/>
        <time><Glyph name="clock"/>{clock}</time>
      </div>
      <div className="project-ballot-score">
        {groups.map(({key,label,badge})=><section key={key} data-choice={key} aria-label={label} className="project-ballot-group">
          <div className="project-ballot-count"><span>{label}</span><strong>{key!=='pending' && <i aria-hidden="true">{badge}</i>}{count(key==='pending'?undefined:key)}</strong></div>
          <ul>{billVoters.filter(person=>key==='pending' ? !person.vote || person.vote==='abstain' : person.vote===key).map(person=>
            <li key={person.id} data-vote-state={person.vote ?? 'pending'} title={person.name}>
              <PhoneContactFace person={person}/><span className="project-voter-name">{person.name}</span>
              <b aria-label={person.vote==='abstain'?'Abstenção':label}>{person.vote==='abstain'?'○':key==='pending'?badge:label}</b>
            </li>)}</ul>
        </section>)}
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
