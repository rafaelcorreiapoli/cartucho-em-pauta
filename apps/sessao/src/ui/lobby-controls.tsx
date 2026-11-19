import {useState} from 'react';
import {createRoot} from 'react-dom/client';
import {MIN_PLAYERS,type PlenaryView} from '../plenary';
import {npcRules} from '../parliamentarians';

export function lobbyControlsState(view:PlenaryView,id:string,assetsReady:boolean) {
  const running = view.phase==='negotiation' || view.phase==='ballot' || view.phase==='hearing';
  return {
    surveillanceEnabled:view.surveillanceEnabled!==false, photosEnabled:view.photosEnabled!==false, electionsEnabled:view.electionsEnabled!==false, projectVotingEnabled:view.projectVotingEnabled!==false, phoneGamesEnabled:view.phoneGamesEnabled!==false, tutorial:!!view.tutorial, running, host:view.host===id, players:view.players, minimum:view.minimumPlayers ?? MIN_PLAYERS,
    botsToFill:view.botsToFill ?? 0, canStartAsInfiltrator:!!view.canStartAsInfiltrator, npcCount:view.lobbyNpcCount ?? npcRules.count, rematch:view.phase==='finished', assetsReady,
  };
}

type LobbyControlsState = ReturnType<typeof lobbyControlsState>;
type LobbyCommands = {
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
  const [infiltrators,setInfiltrators] = useState(1);
  const {tutorial,running,host,players,minimum,npcCount,rematch,assetsReady,canStartAsInfiltrator,botsToFill} = state;
  const showInfiltrators = !tutorial && host && players+botsToFill>=MIN_PLAYERS;
  const canStart = host && players>=minimum && assetsReady;
  const botHint = botsToFill===0 ? '' : botsToFill===1 ?
    'Entrará 1 bot para completar a sala.' : `Entrarão ${botsToFill} bots para completar a sala.`;
  const hint = tutorial ? 'Treino no mapa original com bots guiados.' : players<minimum ? `${players}/${minimum} jogadores para iniciar` :
    host ? botHint : 'Aguardando quem criou a sala iniciar a sessão.';
  if (running) return null;
  return <>
    <div className="lobby-options" hidden={tutorial}>
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
      {showInfiltrators ? <div id="infiltrator-setup" className="lobby-count" role="group" aria-labelledby="infiltrator-label">
        <span id="infiltrator-label"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-bug"/></svg> Infiltrados</span>
        <div id="infiltrator-count">
          {[1,2].map(count=><button key={count} type="button" data-count={count} aria-pressed={infiltrators===count}
            onClick={()=>setInfiltrators(count)}>{count}</button>)}
        </div>
      </div> : null}
      <div id="parliamentarian-setup" className="lobby-count" role="group" aria-labelledby="parliamentarian-label">
        <span id="parliamentarian-label"><svg className="hud-glyph" aria-hidden="true"><use href="#icon-ballot"/></svg> Parlamentares NPC</span>
        <div id="parliamentarian-count">
          {[0,1,2,3,npcRules.maxCount].map(count=><button key={count} type="button" data-count={count} aria-pressed={npcCount===count}
            aria-label={count===0 ? 'Nenhum parlamentar NPC' : undefined} disabled={!host}
            onClick={()=>commands.changeNpcCount(count)}>{count}</button>)}
        </div>
      </div>
      {host && canStartAsInfiltrator && <button className="hud-button hud-button--secondary" type="button" disabled={!canStart}
        onClick={()=>commands.start(showInfiltrators ? infiltrators : 1,true)}>Iniciar como infiltrado</button>}
    </div>
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
