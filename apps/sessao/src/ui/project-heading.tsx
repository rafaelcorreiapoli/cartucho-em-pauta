import {createRoot} from 'react-dom/client';
import {agendaProject,type PlenaryView} from '../plenary';

export function projectHeading(view:PlenaryView) {
  const hearing = view.hearing;
  const queued = view.queuedProjects?.length ?? 0;
  const negotiating = view.phase==='negotiation';
  return {
    title:view.cassation ? 'Quem é o infiltrado?' : hearing?.target ?? agendaProject(view).name,
    round:view.cassation ? 'Votação de cassação' : hearing ? 'Votação de afastamento' : `Projeto ${view.round+1}${queued ? ` · +${queued} na pauta` : ''}`,
    phase:negotiating ? 'Articulação' : view.cassation ? 'Cassação' : hearing ? 'Afastamento' : 'Votação',
    clockLabel:view.isolationSeconds ? 'Isolamento' : negotiating ? 'Votação em' : 'Tempo de voto',
    seconds:view.isolationSeconds || view.remaining,
  };
}

export function ProjectHeading({title,round,phase,clockLabel,seconds}:ReturnType<typeof projectHeading>) {
  return <>
    <div className="bill-heading">
      <div className="deck-project-meta"><span id="bill-round">{round}</span><span>Fase <strong id="phase">{phase}</strong></span></div>
      <h2 id="bill">{title}</h2>
    </div>
    <div className="clock-chip" data-urgent={seconds<=10}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-clock"/></svg>
      <span><small id="clock-label">{clockLabel}</small><strong id="clock">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></span>
    </div>
  </>;
}

export function mountProjectHeading(host:HTMLElement) {
  const root = createRoot(host);
  let key = '';
  return {
    render(view:PlenaryView) {
      const heading = projectHeading(view);
      const next = JSON.stringify(heading);
      if (next===key) return;
      key = next;
      root.render(<ProjectHeading {...heading}/>);
    },
    destroy() { root.unmount(); },
  };
}
