import {useState,type CSSProperties} from 'react';
import {agendaProject,BALLOT_MS,type BillVote,type Impact,type PlenaryView} from '../plenary';
import {PhoneContactFace} from './phone-call';
import './project-ballot.css';

const choices = [
  {vote:'yes',label:'SIM',action:'Votar SIM',key:'Y',symbol:'✓'},
  {vote:'no',label:'NÃO',action:'Votar NÃO',key:'R',symbol:'×'},
  {vote:'abstain',label:'Abstenções',action:'Abster-se',key:'N',symbol:'○'},
] as const;
const banners = ['retrato-picanha.webp',null,'retrato-cafezinho.webp'];

function Glyph({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

function ProjectImpact({impact,approved}:{impact:Impact;approved:boolean}) {
  return <div className="project-ballot-impact" data-choice={approved?'yes':'no'}>
    <strong><Glyph name={approved?'check':'cross'}/>{approved?'Se aprovado':'Se rejeitado'}</strong>
    <span><Glyph name="shield"/>{impact.stability>0?'+':''}{impact.stability} Estabilidade</span>
    <span><Glyph name="wallet"/>{impact.budget>0?'+':impact.budget<0?'−':''}R$ {Math.abs(impact.budget)*10} mil</span>
  </div>;
}

type Props = Pick<PlenaryView,'round'|'project'|'remaining'|'yes'|'no'|'billQuorum'|'billVoters'|'vote'> & {
  ownId:string; eligible:boolean; cast:(choice:BillVote)=>void;
};

export function ProjectBallot({round,project,remaining,yes,no,billQuorum,billVoters=[],vote,ownId,eligible,cast}:Props) {
  const [expanded,setExpanded] = useState(true);
  const bill = agendaProject({round,project});
  const index = project ?? round%banners.length;
  const art = banners[index];
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
      {!expanded && <><strong>{bill.name}</strong><time>{clock}</time></>}
    </button>
    <div className="project-ballot-body" id="project-ballot-body" hidden={!expanded}>
      <header className="project-ballot-banner" data-project={index}>
        <div className="project-ballot-art" aria-hidden="true">
          {art ? <img src={import.meta.env.BASE_URL+'assets/'+art} alt=""/> : <Glyph name="wifi"/>}
        </div>
        <div className="project-ballot-title"><small>Projeto {String(index+1).padStart(2,'0')}</small><h2>{bill.name}</h2><p>{bill.description}</p></div>
        <ProjectImpact impact={yes} approved/>
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
          <div className="project-ballot-count"><span>{label}</span><strong>{count(key==='pending'?undefined:key)}</strong></div>
          <ul>{billVoters.filter(person=>key==='pending' ? !person.vote || person.vote==='abstain' : person.vote===key).map(person=>
            <li key={person.id} data-vote-state={person.vote ?? 'pending'} title={person.name}>
              <PhoneContactFace person={person}/><span title={person.name}>{person.name}</span>
              <b aria-label={person.vote==='abstain'?'Abstenção':label}>{person.vote==='abstain'?'○':badge}</b>
            </li>)}</ul>
        </section>)}
      </div>
      <div className="project-ballot-summary">
        {choices.map(({vote:choice,label})=><span key={choice} data-choice={choice}>{label} <strong>{count(choice)}</strong></span>)}
        <span>Total <strong>{billVoters.length}</strong></span><span>{billQuorum} para aprovar</span>
      </div>
      <footer className="project-ballot-footer">
        <div className="project-ballot-self">{self && <PhoneContactFace person={self}/>}
          <div>Seu voto<strong role="status">{vote ? vote==='abstain'?'Abstenção':vote==='yes'?'SIM':'NÃO' : eligible?'Aguardando…':'Sem direito a voto'}</strong></div>
        </div>
        {choices.map(choice=><button key={choice.vote} type="button" className="project-vote-button" data-choice={choice.vote}
          data-vote={choice.vote} aria-keyshortcuts={choice.key} aria-pressed={vote===choice.vote} disabled={!eligible}
          onClick={()=>cast(choice.vote)}><b aria-hidden="true">{choice.symbol}</b>{choice.action}<kbd>{choice.key}</kbd></button>)}
      </footer>
    </div>
  </section>;
}
