import {agendaProject,projectRules,type PlenaryView} from '../plenary';

export function projectHeading(view:PlenaryView) {
  const hearing = view.hearing;
  const waiting = view.project===undefined && !view.cassation && !hearing;
  const negotiating = view.phase==='negotiation';
  return {
    title:view.cassation ? 'Quem é o infiltrado?' : hearing?.target ?? (waiting ? 'Nenhum projeto em pauta' : agendaProject(view).name),
    round:view.cassation ? 'Votação de cassação' : hearing ? 'Votação de afastamento' : `${view.outcomes.length}/${projectRules.requiredVotes} projetos votados`,
    phase:negotiating ? waiting || view.projectVoteExpired ? 'Jogo livre' : 'Articulação' : view.cassation ? 'Cassação' : hearing ? 'Afastamento' : 'Votação',
    clockLabel:view.isolationSeconds ? 'Isolamento' : negotiating ? view.cassationIn ? 'Cassação em' : waiting || view.projectVoteExpired ? 'Fim da sessão' : 'Votação em' : 'Tempo de voto',
    hint:view.projectVoteExpired ? 'Sem votação nesta sessão.' : waiting ? view.projectFilingClosed ? 'Protocolo de projetos encerrado.' : view.protocolCooldown ? `Protocolo reabre em ${view.protocolCooldown} s` : 'Consulte Projetos no celular.' : view.proposer && negotiating ? `Protocolado por ${view.proposer}` : undefined,
    seconds:view.isolationSeconds || view.cassationIn || view.remaining,
  };
}

export function ProjectHeading({title,round,phase,clockLabel,seconds,hint}:ReturnType<typeof projectHeading>) {
  return <>
    <div className="bill-heading">
      <div className="deck-project-meta"><span id="bill-round">{round}</span><span>Fase <strong id="phase">{phase}</strong></span></div>
      <h2 id="bill">{title}</h2>
      {hint && <p>{hint}</p>}
    </div>
    <div className="clock-chip" data-urgent={seconds<=10}>
      <svg className="hud-glyph" aria-hidden="true"><use href="#icon-clock"/></svg>
      <span><small id="clock-label">{clockLabel}</small><strong id="clock">{Math.floor(seconds/60)}:{String(seconds%60).padStart(2,'0')}</strong></span>
    </div>
  </>;
}
