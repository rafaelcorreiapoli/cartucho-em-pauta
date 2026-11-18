import {createRoot} from 'react-dom/client';
import {tutorialSteps,type TutorialView} from '../tutorial';

export function TutorialPanel({view,send}:{view:TutorialView;send:(action:string)=>void}) {
  const step = tutorialSteps[view.step];
  return <aside className="tutorial-panel hud-panel" aria-label="Tutorial">
    {view.complete ? <>
      <h2>Treino concluído</h2>
      <p>Você percorreu as dinâmicas deste treino. Pode continuar explorando ou voltar para o início.</p>
      <button className="hud-button" onClick={()=>send('restart')}>Recomeçar treino</button>
    </> : <>
      <small>{step.chapter} · {view.step+1}/{tutorialSteps.length}</small>
      <h2>{step.title}</h2>
      <p role="status">{step.text.replaceAll('Bot 1',view.guide ?? 'o guia')}</p>
      <details><summary>Ver dica</summary><p>{step.hint}</p></details>
      {view.target && <p>Siga o marcador dourado no mapa. Use Tab para consultar a planta.</p>}
      <div className="tutorial-controls">
        {step.manual && <button className="hud-button" onClick={()=>send('next')}>Continuar</button>}
        <button className="hud-button hud-button--secondary" onClick={()=>send('skip')}>Pular etapa</button>
      </div>
      <label>Treinar outra dinâmica <select value={view.step} onChange={event=>send('step:'+event.target.value)}>
        {tutorialSteps.map((entry,index)=><option key={index} value={index}>{entry.chapter} · {entry.title}</option>)}
      </select></label>
    </>}
    <button className="hud-button hud-button--secondary" onClick={()=>send('exit')}>Sair do treino</button>
  </aside>;
}
export function mountTutorial(send:(action:string)=>void) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  return {
    render(view?:TutorialView) { root.render(view ? <TutorialPanel view={view} send={send}/> : null); },
    destroy() {root.unmount();host.remove();},
  };
}
