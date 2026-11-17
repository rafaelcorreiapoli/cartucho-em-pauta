import {createRoot} from 'react-dom/client';

type LoadingState = {progress:number;failed?:boolean};

export function mountAssetLoading(host:HTMLElement,goBack:()=>void) {
  const root = createRoot(host);
  return (state?:LoadingState) => root.render(state ? <div id="asset-loading">
    <div className="hud-panel lobby-card">
      <div className="lobby-brand"><img src={import.meta.env.BASE_URL+'assets/logo-infiltrados.webp'} alt="Infiltrados no Congresso"/></div>
      <p role="status">{state.failed ? 'Falha ao carregar o cenário. Volte e tente novamente.' : 'Carregando o Congresso…'}</p>
      <progress max={1} value={state.progress} aria-label="Progresso do carregamento"/>
      {state.failed && <button className="hud-button hud-button--secondary" type="button" onClick={goBack}>Voltar</button>}
    </div>
  </div> : <div id="asset-loading" hidden/>);
}
