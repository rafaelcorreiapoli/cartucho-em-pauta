import {gameModes,type GameMode} from '../game-modes';
import {useRef,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MIN_PLAYERS,type PlenaryView} from '../plenary';
import {npcRules} from '../visitors';

export function lobbyControlsState(view:PlenaryView,id:string,assetsReady:boolean) {
  const running = view.phase==='negotiation' || view.phase==='ballot' || view.phase==='hearing';
  return {
    initialWallet:view.initialWallet ?? 20, grantsEnabled:view.grantsEnabled!==false, initialBudget:view.initialBudget ?? 0, matchMinutes:view.matchMinutes ?? 12,
    automaticProjectsEnabled:view.automaticProjectsEnabled!==false, gameMode:view.gameMode ?? 'classic', portraitsAndVipEnabled:view.portraitsAndVipEnabled!==false, decorationsEnabled:view.decorationsEnabled!==false, surveillanceEnabled:view.surveillanceEnabled!==false, photosEnabled:view.photosEnabled!==false, electionsEnabled:view.electionsEnabled!==false, projectVotingEnabled:view.projectVotingEnabled!==false, phoneGamesEnabled:view.phoneGamesEnabled!==false, tutorial:!!view.tutorial, running, host:view.host===id, players:view.players, minimum:view.minimumPlayers ?? MIN_PLAYERS,
    botsToFill:view.botsToFill ?? 0, canStartAsInfiltrator:!!view.canStartAsInfiltrator, npcCount:view.lobbyNpcCount ?? npcRules.count, rematch:view.phase==='finished', assetsReady,
  };
}

type LobbyControlsState = ReturnType<typeof lobbyControlsState>;
type LobbyCommands = {
  changeInitialWallet?:(value:number)=>void;
  changeGrants?:(enabled:boolean)=>void;
  changeInitialBudget?:(value:number)=>void;
  changeMatchMinutes?:(value:number)=>void;
  changeAutomaticProjects?:(enabled:boolean)=>void;
  changeGameMode?:(mode:GameMode)=>void;
  changePortraitsAndVip?:(enabled:boolean)=>void;
  changeDecorations?:(enabled:boolean)=>void;
  changeSurveillance?:(enabled:boolean)=>void;
  changePhotos?:(enabled:boolean)=>void;
  changeElections?:(enabled:boolean)=>void;
  changeProjectVoting?:(enabled:boolean)=>void;
  changePhoneGames?:(enabled:boolean)=>void;
  changeNpcCount:(count:number)=>void;
  start:(infiltrators:number,asInfiltrator?:boolean)=>void;
  back:()=>void;
};

export function LobbyControls({state,commands}:{state:LobbyControlsState;commands:LobbyCommands}) {
  const settings = useRef<HTMLDialogElement>(null);
  const [infiltrators,setInfiltrators] = useState(2);
  const {tutorial,running,host,players,minimum,npcCount,rematch,assetsReady,canStartAsInfiltrator,botsToFill} = state;
  const showInfiltrators = !tutorial && host && players+botsToFill>=MIN_PLAYERS;
  const canStart = host && players>=minimum && assetsReady;
  const botHint = botsToFill===0 ? '' : botsToFill===1 ?
    'Entrará 1 bot para completar a sala.' : `Entrarão ${botsToFill} bots para completar a sala.`;
  const hint = tutorial ? 'Treino no mapa original com bots guiados.' : players<minimum ? `${players}/${minimum} jogadores para iniciar` :
    host ? botHint : 'Aguardando quem criou a sala iniciar a sessão.';
  if (running) return null;
  return <>
    {!tutorial && <div className="lobby-settings-entry"><div><strong>Configurações da partida</strong><p>{state.gameMode==='classic' ? 'Clássico' : 'Calote'} · {state.matchMinutes} min · {npcCount} visitantes</p></div><button type="button" className="hud-button hud-button--secondary" onClick={()=>settings.current?.showModal()}>Configurar partida</button></div>}
    <dialog ref={settings} className="match-settings" aria-labelledby="match-settings-title">
      <header><div><h2 id="match-settings-title">Configurações da partida</h2><p>{host ? 'Ajuste as regras antes de iniciar a sessão.' : 'Confira as regras escolhidas por quem criou a sala.'}</p></div><button type="button" className="hud-button hud-button--secondary" onClick={()=>settings.current?.close()} aria-label="Fechar configurações da partida">Fechar</button></header>
    <div className="lobby-options" hidden={tutorial}>
      <h3>Regras e economia</h3>
      <div className="lobby-count" role="group" aria-label="Modo de jogo">
        <span>Modo de jogo</span>
        <div>{Object.entries(gameModes).map(([mode,{label,description}])=><button key={mode} type="button"
          aria-pressed={state.gameMode===mode} disabled={!host} title={description}
          onClick={()=>commands.changeGameMode?.(mode as GameMode)}>{label}</button>)}</div>
        <small>{gameModes[state.gameMode].description}</small>
      </div>
      <label className="lobby-count"><input type="checkbox" checked={state.grantsEnabled} disabled={!host}
        onChange={event=>commands.changeGrants?.(event.currentTarget.checked)}/> Aplicar verba</label>
      <div className="lobby-count" role="group" aria-label="Orçamento inicial">
        <span>Orçamento inicial</span>
        <div>{[-50,0,50].map(value=><button key={value} type="button" disabled={!host}
          aria-pressed={state.initialBudget===value} onClick={()=>commands.changeInitialBudget?.(value)}>{value>0 ? `+${value}` : value}</button>)}</div>
      </div>
      <div className="lobby-count" role="group" aria-label="Patrimônio inicial">
        <span>Patrimônio inicial por jogador</span>
        <div>{[0,20,50].map(value=><button key={value} type="button" disabled={!host}
          aria-pressed={state.initialWallet===value} onClick={()=>commands.changeInitialWallet?.(value)}>{value}</button>)}</div>
      </div>
      <div className="lobby-count" role="group" aria-label="Tempo de jogo">
        <span>Tempo de jogo</span>
        <div>{[12,15,20].map(value=><button key={value} type="button" disabled={!host}
          aria-pressed={state.matchMinutes===value} onClick={()=>commands.changeMatchMinutes?.(value)}>{value} min</button>)}</div>
      </div>
      <h3>Recursos da partida</h3>
      {state.gameMode==='calote' && <label className="lobby-count"><input type="checkbox" checked={state.automaticProjectsEnabled} disabled={!host}
        onChange={event=>commands.changeAutomaticProjects?.(event.currentTarget.checked)}/> Projetos automáticos</label>}
      <label className="lobby-count"><input type="checkbox" checked={state.portraitsAndVipEnabled} disabled={!host}
        onChange={event=>commands.changePortraitsAndVip?.(event.currentTarget.checked)}/> Retratos e área VIP</label>
      <label className="lobby-count"><input type="checkbox" checked={state.decorationsEnabled} disabled={!host}
        onChange={event=>commands.changeDecorations?.(event.currentTarget.checked)}/> Decoração</label>
      <label className="lobby-count"><input type="checkbox" checked={state.surveillanceEnabled} disabled={!host}
        onChange={event=>commands.changeSurveillance?.(event.currentTarget.checked)}/> Vigilância</label>
      <label className="lobby-count"><input type="checkbox" checked={state.photosEnabled} disabled={!host}
        onChange={event=>commands.changePhotos?.(event.currentTarget.checked)}/> Câmera e fotos</label>
      <label className="lobby-count"><input type="checkbox" checked={state.electionsEnabled} disabled={!host}
        onChange={event=>commands.changeElections?.(event.currentTarget.checked)}/> Eleição para eliminação</label>
      <label className="lobby-count"><input type="checkbox" checked={state.projectVotingEnabled} disabled={!host}
        onChange={event=>commands.changeProjectVoting?.(event.currentTarget.checked)}/> Votações de projetos</label>
      <label className="lobby-count"><input type="checkbox" checked={state.phoneGamesEnabled} disabled={!host}
        onChange={event=>commands.changePhoneGames?.(event.currentTarget.checked)}/> Joguinhos de celular</label>
      <h3>Participantes</h3>
      {showInfiltrators ? <div id="infiltrator-setup" className="lobby-count" role="group" aria-labelledby="infiltrator-label">
        <span id="infiltrator-label"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-bug"/></svg> Infiltrados</span>
        <div id="infiltrator-count">
          {[1,2].map(count=><button key={count} type="button" data-count={count} aria-pressed={infiltrators===count}
            onClick={()=>setInfiltrators(count)}>{count}</button>)}
        </div>
      </div> : null}
      <div id="parliamentarian-setup" className="lobby-count" role="group" aria-labelledby="parliamentarian-label">
        <span id="parliamentarian-label"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-wallet"/></svg> Visitantes</span>
        <div id="parliamentarian-count">
          {[0,1,2,3,npcRules.maxCount].map(count=><button key={count} type="button" data-count={count} aria-pressed={npcCount===count}
            aria-label={count===0 ? 'Nenhum visitante' : undefined} disabled={!host}
            onClick={()=>commands.changeNpcCount(count)}>{count}</button>)}
        </div>
      </div>
      {host && canStartAsInfiltrator && <button className="hud-button hud-button--secondary" type="button" disabled={!canStart}
        onClick={()=>commands.start(showInfiltrators ? infiltrators : 1,true)}>Iniciar como infiltrado</button>}
    </div>
    <footer><span>As alterações são aplicadas à sala.</span><button type="button" className="hud-button" onClick={()=>settings.current?.close()}>Voltar ao lobby</button></footer>
    </dialog>
    <footer className="lobby-footer">
      <button className="hud-button hud-button--secondary" id="lobby-back" type="button" onClick={commands.back}>‹ Voltar</button>
      <p id="start-hint" role="status">{hint}</p>
      {host ? <button className="hud-button" id="start-match" type="button" disabled={!canStart}
        onClick={()=>commands.start(showInfiltrators ? infiltrators : 1)}>
        {tutorial ? 'Iniciar tutorial' : rematch ? 'Jogar de novo' : 'Iniciar sessão'} <span aria-hidden="true">›</span>
      </button> : null}
    </footer>
  </>;
}

export function mountLobbyControls(element:HTMLElement,id:string,commands:LobbyCommands) {
  const root = createRoot(element);
  let current = '';
  return {
    render(view:PlenaryView,assetsReady:boolean) {
      const state = lobbyControlsState(view,id,assetsReady);
      const key = JSON.stringify(state);
      if (key===current) return;
      current = key;
      root.render(<LobbyControls state={state} commands={commands}/>);
    },
    destroy:()=>root.unmount(),
  };
}
