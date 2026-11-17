import {DialogHeader} from './ui/dialog-header';
import {useDialogKeys} from './ui/use-dialog-keys';
import { DialogDismiss } from './ui/dialog-dismiss';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';
import type { CSSProperties, ReactNode } from 'react';
import type { ElectionView } from './elections';
import type { PlenaryView } from './plenary';

export function ElectionResult({result}:{result:NonNullable<ElectionView['result']>}) {
  return <section className="grid gap-2">
    <h3>Renovação de Mandato {result.cycle}</h3>
    {result.offices.map((person,index)=>{
      const lost = person.id===result.eliminated;
      const portrait = {'--portrait-column':person.character%2,'--portrait-row':Math.floor(person.character/2)} as CSSProperties;
      return <div className="result-winner" key={person.id} data-effect={lost ? 'loss' : 'neutral'}>
        <span className="portrait" aria-hidden="true" style={portrait}/>
        <span>{index+1}º · {person.name}{lost && <small>Mandato perdido</small>}</span>
        <strong className="tabular-nums">{person.percentage}%</strong>
      </div>;
    })}
  </section>;
}

const finaleParticles = Array.from({length:44},(_,index)=>({
  '--particle-x':`${(index*37)%100}%`,
  '--particle-delay':`${-(index%13)*.49}s`,
  '--particle-duration':`${3+(index%7)*.6}s`,
}) as CSSProperties);

export function SessionResult({winner,reason,stability,congressDestroyed,finalRoster=[]}:Pick<PlenaryView,'winner'|'reason'|'stability'|'congressDestroyed'|'finalRoster'>) {
  const outcome = winner==='Parlamentar' ? 'saved' : winner==='Infiltrado' || congressDestroyed || stability===0 ? 'destroyed' : 'ended';
  const headline = outcome==='saved' ? 'O Congresso foi salvo!' :
    outcome==='destroyed' ? 'O Congresso foi destruído!' : 'Sessão encerrada';
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

export function ResultsContent({children}:{children:ReactNode}) {
  const dismiss = ():void=>{content.current?.closest('dialog')?.close();};
  const content = useDialogKeys<HTMLDivElement>(()=>undefined,[
    {name:'Fechar resultados',activate:dismiss},
    {name:'Continuar',activate:dismiss},
  ]);
  return <>
    <DialogHeader id="result-title" title="Resultados" dismissLabel="Fechar resultados"/>
    <div ref={content} id="result-content">{children}</div>
    <DialogDismiss className="hud-button">Continuar</DialogDismiss>
  </>;
}

export function CassationResult({text}:{text:string}) {
  return <section><h3>Resultado da cassação</h3><p>{text}</p></section>;
}

export function mountResults(closeGameplay:()=>void) {
  const dialog = document.querySelector<HTMLDialogElement>('#result-dialog')!;
  const finale = document.querySelector<HTMLDialogElement>('#session-finale')!;
  const finaleRoot = createRoot(finale);
  const root = createRoot(dialog);
  return {
    render(view:PlenaryView, previous:PlenaryView | undefined) {
      const election = view.election?.result;
      const electionChanged = election && election.cycle!==previous?.election?.result?.cycle;
      const project = view.outcome;
      const projectChanged = project && project.round!==previous?.outcome?.round;
      const cassation = previous?.cassation && !view.cassation && view.cassationResult;
      const finished = view.phase==='finished' && previous?.phase!=='finished';
      if (finished) {
        for (const overlay of document.querySelectorAll<HTMLDialogElement>('dialog:modal')) overlay.close();
        flushSync(()=>finaleRoot.render(<SessionResult {...view}/>));
        finale.showModal();
      } else if (cassation) {
        flushSync(()=>root.render(<ResultsContent><CassationResult text={cassation.text}/></ResultsContent>));
        if (!dialog.open) dialog.showModal();
      } else if (electionChanged) {
        flushSync(()=>root.render(<ResultsContent><ElectionResult result={election}/></ResultsContent>));
        closeGameplay();
        if (!dialog.open) dialog.showModal();
      }
      return projectChanged ? project.passed ? 'approved' : 'rejected' : electionChanged || cassation ? 'election' : undefined;
    },
    destroy() { dialog.close(); finale.close(); root.unmount(); finaleRoot.unmount(); },
  };
}
