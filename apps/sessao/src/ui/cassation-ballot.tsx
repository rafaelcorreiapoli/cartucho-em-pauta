import {HudHelp} from './hud-help';
import type {CassationView} from '../plenary';
import {cassationChoices} from './ballot-shortcuts';
import {HudIcon} from './hud-icon';
import {PhoneContactFace} from './phone-call';
import './cassation-ballot.css';

type Person = CassationView['candidates'][number];

function VoterPortraits({voters,label}:{voters:readonly Person[];label:string}) {
  if (!voters.length) return null;
  return <ul className="cassation-voters" aria-label={label}>
    {voters.map(person=><li key={person.id} title={person.name}>
      <PhoneContactFace person={person}/><span className="sr-only">{person.name}</span>
    </li>)}
  </ul>;
}

export function CassationBallot({state,ownId,remaining,cast}:{
  state:CassationView; ownId:string; remaining?:number; cast:(candidate:string|null)=>void;
}) {
  const {candidates,skipKey} = cassationChoices(state,ownId);
  const keys = new Map(candidates.map(({person,key})=>[person.id,key]));
  const people = new Map(state.candidates.map(person=>[person.id,person]));
  const votes = new Map<string|null,Person[]>();
  for (const {voter,candidate} of state.votes ?? []) {
    const person = people.get(voter);
    if (!person) continue;
    const group = votes.get(candidate);
    if (group) group.push(person);
    else votes.set(candidate,[person]);
  }
  const skipped = votes.get(null) ?? [];
  const seconds = remaining ?? 0;
  const clock = `${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  return <section className="cassation-ballot" aria-labelledby="cassation-title">
    <header className="cassation-header">
      <div>
        <h2 id="cassation-title">Votação de cassação</h2>
        <p>Quem você suspeita ser infiltrado?</p>
      </div>
      {remaining!==undefined && <div className="cassation-clock" data-urgent={seconds<=10}>
        <span>Tempo restante</span>
        <time><HudIcon name="clock"/>{clock}</time>
      </div>}
    </header>
    <div className="cassation-summary">
      {state.caller && <div className="cassation-caller">
        <PhoneContactFace person={state.caller}/>
        <div><span>Convocada por</span><strong>{state.caller.name}</strong></div>
      </div>}
      <div className="cassation-participation">
        <p><strong>{state.voted}/{state.electorate}</strong> votaram · {state.quorum} votos para cassar</p>
        <progress aria-label="Participação na cassação" value={state.voted} max={Math.max(1,state.electorate)}/>
      </div>
    </div>
    <ul className="cassation-candidates" aria-label="Candidatos à cassação">
      {state.candidates.map(person=>{
        const key = state.eligible ? keys.get(person.id) : undefined;
        const own = ownId===person.id;
        const voters = votes.get(person.id) ?? [];
        return <li key={person.id} className="cassation-candidate" data-selected={state.choice===person.id}>
          <HudHelp className="cassation-choice" help={own ? "Este é o seu personagem." : `Vote para cassar o mandato de ${person.name}.`} disabled={!state.eligible || own}
            aria-label={person.name} aria-keyshortcuts={key} aria-pressed={state.choice===person.id} onClick={()=>cast(person.id)}>
            <PhoneContactFace person={person}/>
            <span><strong>{person.name}</strong>{own && <small>Você</small>}</span>
            {key && <kbd aria-hidden="true">{key}</kbd>}
          </HudHelp>
          <div className="cassation-candidate-votes">
            <span>{voters.length} {voters.length===1 ? 'voto' : 'votos'}</span>
            <VoterPortraits voters={voters} label={`Votos em ${person.name}`}/>
          </div>
        </li>;
      })}
    </ul>
    <footer className="cassation-footer">
      <p role="status">{!state.eligible ? 'Você está acompanhando a votação.' : state.choice===null
        ? 'Seu voto: abstenção' : state.choice ? `Seu voto: ${people.get(state.choice)?.name ?? ''}` : 'Escolha um suspeito ou pule o voto.'}</p>
      <div className="cassation-abstentions">
        <VoterPortraits voters={skipped} label="Quem pulou o voto"/>
        <HudHelp className="hud-button hud-button--secondary" help="Registre uma abstenção nesta votação." disabled={!state.eligible}
          aria-keyshortcuts={state.eligible ? skipKey : undefined} aria-pressed={state.choice===null} onClick={()=>cast(null)}>
          Pular voto {state.eligible && <kbd aria-hidden="true">{skipKey}</kbd>}
        </HudHelp>
      </div>
    </footer>
  </section>;
}
