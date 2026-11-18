import {useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {createRoot} from 'react-dom/client';
import {tutorialSteps,type TutorialView} from '../tutorial';

export function TutorialPanel({view,send}:{view:TutorialView;send:(action:string)=>void}) {
  const step = tutorialSteps[view.step];
  const panel = useRef<HTMLElement>(null);
  const drag = useRef<{x:number;y:number}|undefined>(undefined);
  const [collapsed,setCollapsed] = useState(false);
  const [position,setPosition] = useState<{x:number;y:number}>();
  function clamp(x:number,y:number) {
    const bounds = panel.current!.getBoundingClientRect();
    return {x:Math.max(12,Math.min(x,window.innerWidth-bounds.width-12)),
      y:Math.max(12,Math.min(y,window.innerHeight-bounds.height-12))};
  }
  useLayoutEffect(()=>{
    const keepVisible = ()=>setPosition(previous=>{
      if (!previous) return previous;
      const next = clamp(previous.x,previous.y);
      return next.x===previous.x && next.y===previous.y ? previous : next;
    });
    const observer = new ResizeObserver(keepVisible);
    observer.observe(panel.current!);
    window.addEventListener('resize',keepVisible);
    return ()=>{observer.disconnect();window.removeEventListener('resize',keepVisible);};
  },[]);
  function startDrag(event:PointerEvent<HTMLButtonElement>) {
    if (event.button!==0) return;
    const bounds = panel.current!.getBoundingClientRect();
    drag.current = {x:event.clientX-bounds.x,y:event.clientY-bounds.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  return <aside ref={panel} style={position ? {left:position.x,top:position.y,right:'auto',bottom:'auto'} : undefined} className="tutorial-panel hud-panel" aria-label="Tutorial" data-highlight={view.complete ? undefined : step.highlight}>
    <header className="tutorial-toolbar">
      <button type="button" className="tutorial-drag" aria-label="Mover tutorial" title="Arraste para mover; use as setas para reposicionar"
        onPointerDown={startDrag} onPointerMove={event=>{
          if (drag.current) setPosition(clamp(event.clientX-drag.current.x,event.clientY-drag.current.y));
        }} onPointerUp={()=>{drag.current=undefined;}} onLostPointerCapture={()=>{drag.current=undefined;}}
        onKeyDown={event=>{
          const delta = {ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[event.key];
          if (!delta) return;
          event.preventDefault();
          const bounds = panel.current!.getBoundingClientRect();
          setPosition(clamp(bounds.x+delta[0],bounds.y+delta[1]));
        }}>⠿ Tutorial</button>
      <button type="button" className="hud-button hud-button--secondary" aria-expanded={!collapsed} aria-controls="tutorial-content"
        onClick={()=>setCollapsed(!collapsed)}>{collapsed ? 'Expandir' : 'Recolher'}</button>
    </header>
    <div id="tutorial-content" className="tutorial-content" hidden={collapsed}>
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
    </div>
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
