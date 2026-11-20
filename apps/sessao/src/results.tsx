import './ui/cassation-ballot.css';
import './cassation-result.css';
import {CharacterPortrait} from './ui/character-portrait';
import {sessionVerdict} from './session-verdict';
import {DialogHeader} from './ui/dialog-header';
import {useDialogKeys} from './ui/use-dialog-keys';
import { DialogDismiss } from './ui/dialog-dismiss';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { CSSProperties, ReactNode } from 'react';
import type { ElectionView } from './elections';
import {ElectionCandidateCard} from './ui/election-candidate-card';
import type { CassationResultView, PlenaryView, Role } from './plenary';

export function ElectionResult({result}:{result:NonNullable<ElectionView['result']>}) {
  return <ol className="election-candidates" role="list" aria-label="Classificação final">
    {result.offices.map((person,index)=><li key={person.id}>
      <ElectionCandidateCard character={person.character} rank={index+1} name={person.name}
        percentage={person.percentage} lost={person.id===result.eliminated}/>
    </li>)}
  </ol>;
}

const finaleParticles = Array.from({length:44},(_,index)=>({
  '--particle-x':`${(index*37)%100}%`,
  '--particle-delay':`${-(index%13)*.49}s`,
  '--particle-duration':`${3+(index%7)*.6}s`,
}) as CSSProperties);

export function SessionResult({gameMode,winner,role,reason,stability,congressDestroyed,finalRoster=[]}:Pick<PlenaryView,'gameMode'|'winner'|'role'|'reason'|'stability'|'congressDestroyed'|'finalRoster'>) {
  const verdict = sessionVerdict({winner,role,congressDestroyed});
  const outcome = winner==='Parlamentar' ? 'saved' : winner==='Infiltrado' || congressDestroyed || gameMode!=='calote' && stability===0 ? 'destroyed' : 'ended';
  const headline = outcome==='saved' ? 'O Congresso foi salvo!' :
    outcome==='destroyed' ? gameMode==='calote' ? 'O Congresso deu calote!' : 'O Congresso foi destruído!' : 'Sessão encerrada';
  const factions = [
    {role:'Parlamentar',name:'Parlamentares'},
    {role:'Infiltrado',name:'Infiltrados'},
  ] as const;
  const teams = factions.map(({role,name})=>({
    name,
    people:finalRoster.filter(person=>person.role===role),
    result:winner===role ? 'won' : winner || outcome==='destroyed' ? 'lost' : 'neutral',
  })).sort((a,b)=>Number(b.result==='won')-Number(a.result==='won'));

  const panel = useDialogKeys<HTMLElement>(()=>undefined,[
    {name:'Continuar',activate:():void=>{panel.current?.closest('dialog')?.close();}},
  ]);
  return <section ref={panel} className="session-finale" data-outcome={outcome}>
    {outcome!=='ended' && <div className="finale-particles" aria-hidden="true">
      {finaleParticles.map((style,index)=><i key={index} style={style}/>)}
    </div>}
    <div className="finale-content">
      <h2 id="session-finale-title">{headline}</h2>
      {verdict && <p className="finale-personal-verdict" data-result={verdict}>
        {verdict==='victory' ? 'Você venceu!' : 'Você perdeu!'}
      </p>}
      {reason && <p className="finale-reason">{reason}</p>}
      {!winner && <p className="finale-no-winner">Sem vencedores</p>}
      <div className="finale-teams">
        {teams.filter(team=>team.people.length).map(team=><section key={team.name} className="finale-team" aria-label={team.name} data-result={team.result}>
          <h3>{team.name}</h3>
          {team.result!=='neutral' && <strong className="finale-verdict">{team.result==='won' ? 'Vitória' : 'Derrota'}</strong>}
          <ul>{team.people.map(person=><li key={person.id}>
            <span className="portrait" aria-hidden="true" style={{
              '--portrait-column':person.character%2,'--portrait-row':Math.floor(person.character/2),
            } as CSSProperties}/>
            <strong>{person.name}</strong>
          </li>)}</ul>
        </section>)}
      </div>
      <DialogDismiss className="hud-button">Continuar</DialogDismiss>
    </div>
  </section>;
}

export function ResultsContent({children,title="Resultados"}:{children:ReactNode;title?:string}) {
  const dismiss = ():void=>{content.current?.closest('dialog')?.close();};
  const content = useDialogKeys<HTMLDivElement>(()=>undefined,[
    {name:'Fechar resultados',activate:dismiss},
    {name:'Continuar',activate:dismiss},
  ]);
  return <>
    <DialogHeader id="result-title" title={title} dismissLabel="Fechar resultados"/>
    <div ref={content} id="result-content">{children}</div>
    <DialogDismiss className="hud-button">Continuar</DialogDismiss>
  </>;
}

export function CassationResult({text,eliminated}:CassationResultView) {
  const panel = useDialogKeys<HTMLElement>(()=>undefined,[
    {name:'Continuar',activate:():void=>{panel.current?.closest('dialog')?.close();}},
  ]);
  if (!eliminated) return <section ref={panel} className="cassation-reveal"><h2 id="cassation-reveal-name">Resultado da cassação</h2><p>{text}</p><DialogDismiss className="hud-button">Continuar</DialogDismiss></section>;
  const infiltrator = eliminated.role==='Infiltrado';
  return <section ref={panel} className="cassation-reveal" data-verdict={infiltrator ? 'caught' : 'mistake'}>
    <p className="cassation-reveal-kicker">O Congresso decidiu</p>
    <div className="cassation-reveal-stage">
      <div className="cassation-reveal-face"><CharacterPortrait character={eliminated.character}/></div>
      <div className="cassation-reveal-caption">
        <p className="cassation-reveal-label">Mandato cassado</p>
        <h2 id="cassation-reveal-name">{eliminated.name}</h2>
        <p className="cassation-reveal-role">{infiltrator ? 'Era infiltrado.' : 'Não era infiltrado.'}</p>
        <p className="cassation-reveal-detail">{text}</p>
      </div>
    </div>
    <DialogDismiss className="hud-button">Continuar</DialogDismiss>
  </section>;
}

export function mountResults(closeGameplay:()=>void,onReveal:(role:Role|undefined)=>void=()=>{}) {
  const dialog = document.querySelector<HTMLDialogElement>('#result-dialog')!;
  const finale = document.querySelector<HTMLDialogElement>('#session-finale')!;
  const reveal = document.querySelector<HTMLDialogElement>('#cassation-reveal-dialog')!;
  const revealContent = document.createElement('div');
  revealContent.className = 'cassation-result-layer';
  reveal.append(revealContent);
  const revealRoot = createRoot(revealContent);
  let ballotSnapshot:HTMLElement|undefined;
  let ballotHeight = 0;
  let ballotScroll = 0;
  const clearSnapshot = ()=>{ ballotSnapshot?.remove(); ballotSnapshot = undefined; };
  const finaleRoot = createRoot(finale);
  const root = createRoot(dialog);
  let pendingFinale:PlenaryView|undefined;
  const showFinale = (view:PlenaryView)=>{
    for (const overlay of document.querySelectorAll<HTMLDialogElement>('dialog:modal')) overlay.close();
    flushSync(()=>finaleRoot.render(<SessionResult {...view}/>));
    finale.showModal();
  };
  const afterReveal = ()=>{
    clearSnapshot();
    onReveal(undefined);
    const view = pendingFinale;
    pendingFinale = undefined;
    if (view) showFinale(view);
  };
  reveal.addEventListener('close',afterReveal);
  return {
    // Capture before the HUD replaces the ballot with the next game state.
    captureBallot(view:PlenaryView,previous:PlenaryView|undefined) {
      if (!previous?.cassation || view.cassation || !view.cassationResult) return;
      clearSnapshot();
      ballotHeight = 0;
      const ballot = document.querySelector<HTMLElement>('#legislative-dock .cassation-ballot');
      if (!ballot) return;
      ballotHeight = ballot.getBoundingClientRect().height;
      const style = getComputedStyle(ballot);
      reveal.style.setProperty('--hud-edge',style.getPropertyValue('--hud-edge'));
      reveal.style.setProperty('--party-display',style.getPropertyValue('--party-display'));
      reveal.style.font = style.font;
      ballotSnapshot = ballot.cloneNode(true) as HTMLElement;
      ballotSnapshot.className = 'cassation-ballot cassation-ballot-snapshot';
      ballotSnapshot.inert = true;
      ballotSnapshot.setAttribute('aria-hidden','true');
      for (const node of ballotSnapshot.querySelectorAll('[id]')) node.removeAttribute('id');
      ballotSnapshot.removeAttribute('aria-labelledby');
      ballotScroll = ballot.scrollTop;
    },
    render(view:PlenaryView, previous:PlenaryView | undefined) {
      const election = view.election?.result;
      const electionChanged = election && election.cycle!==previous?.election?.result?.cycle;
      const project = view.outcome;
      const projectChanged = project && project.round!==previous?.outcome?.round;
      const cassation = previous?.cassation && !view.cassation ? view.cassationResult : undefined;
      const finished = view.phase==='finished' && previous?.phase!=='finished';
      if (view.phase==='lobby') { pendingFinale = undefined; if (reveal.open) reveal.close(); }
      if (cassation) {
        if (finished) pendingFinale = view;
        closeGameplay();
        for (const overlay of document.querySelectorAll<HTMLDialogElement>('dialog:modal')) overlay.close();
        reveal.classList.add('cassation-ballot');
        reveal.style.height = `${ballotHeight || 360}px`;
        reveal.dataset.transition = String(!!ballotSnapshot);
        if (ballotSnapshot) reveal.prepend(ballotSnapshot);
        flushSync(()=>revealRoot.render(<CassationResult key={previous?.cassation?.calledAt} {...cassation}/>));
        onReveal(cassation.eliminated?.role);
        reveal.showModal();
        if (ballotSnapshot) ballotSnapshot.scrollTop = ballotScroll;
      } else if (finished) {
        if (reveal.open) pendingFinale = view;
        else showFinale(view);
      } else if (electionChanged && !reveal.open) {
        flushSync(()=>root.render(<ResultsContent title="Resultados da Eleição"><ElectionResult result={election}/></ResultsContent>));
        closeGameplay();
        if (!dialog.open) dialog.showModal();
      }
      return projectChanged ? project.passed ? 'approved' : 'rejected' : cassation?.eliminated ? undefined : electionChanged || cassation ? 'election' : undefined;
    },
    destroy() { pendingFinale = undefined; reveal.removeEventListener('close',afterReveal); reveal.close(); onReveal(undefined); dialog.close(); finale.close(); revealRoot.unmount(); revealContent.remove(); clearSnapshot(); root.unmount(); finaleRoot.unmount(); },
  };
}
