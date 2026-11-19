import {useLayoutEffect,useRef,useState,type PointerEvent} from 'react';
import {ChevronUp,ChevronDown,ChevronLeft,ChevronRight,GripVertical,LogOut,type IconNode} from 'lucide';
import {TutorialSpotlight} from './tutorial-spotlight';
import {createRoot} from 'react-dom/client';
import {tutorialSteps,type TutorialView} from '../tutorial';

function TutorialIcon({icon}:{icon:IconNode}) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    {icon.map(([tag,attributes],index)=>{
      const Tag = tag as 'path'|'rect'|'line'|'circle'|'polyline';
      return <Tag key={index} {...attributes}/>;
    })}
  </svg>;
}

export function TutorialText({children}:{children:string}) {
  return <>{children.split(/(\*\*[^*]+\*\*)/g).map((part,index)=>
    part.startsWith('**') ? <strong key={index}>{part.slice(2,-2)}</strong> : part)}</>;
}

export function TutorialPanel({view,send,binocularActive=false}:{view:TutorialView;send:(action:string)=>void;binocularActive?:boolean}) {
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
    const resetForViewport = ()=>setPosition(undefined);
    window.addEventListener('resize',resetForViewport);
    return ()=>{observer.disconnect();window.removeEventListener('resize',resetForViewport);};
  },[]);
  function startDrag(event:PointerEvent<HTMLButtonElement>) {
    if (event.button!==0) return;
    const bounds = panel.current!.getBoundingClientRect();
    drag.current = {x:event.clientX-bounds.x,y:event.clientY-bounds.y};
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  return <>
    {!collapsed && !binocularActive && !view.complete && step.highlight && <TutorialSpotlight key={step.highlight} highlight={step.highlight}/>}
    <aside ref={panel} style={position ? {left:position.x,top:position.y,right:'auto',bottom:'auto'} : undefined} className="tutorial-panel hud-panel" aria-label="Tutorial" data-highlight={view.complete ? undefined : step.highlight}>
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
        }}><TutorialIcon icon={GripVertical}/><span>Tutorial</span></button>
      <button type="button" className="tutorial-icon-button" aria-label={collapsed ? 'Expandir tutorial' : 'Recolher tutorial'} title={collapsed ? 'Expandir tutorial' : 'Recolher tutorial'} aria-expanded={!collapsed} aria-controls="tutorial-content"
        onClick={()=>setCollapsed(!collapsed)}><TutorialIcon icon={collapsed ? ChevronDown : ChevronUp}/></button>
    </header>
    <div id="tutorial-content" className="tutorial-content" hidden={collapsed}>
      {view.complete ? <>
        <div className="tutorial-copy">
          <small className="tutorial-chapter">Todos os passos concluídos</small>
          <h2>Treino concluído</h2>
          <p>Você percorreu as dinâmicas deste treino. Pode continuar explorando ou voltar para o início.</p>
        </div>
        <button className="hud-button" onClick={()=>send('restart')}>Recomeçar treino</button>
      </> : <>
        <div className="tutorial-copy">
          <small className="tutorial-chapter">{step.chapter}</small>
          <h2>{step.title}</h2>
          <p role="status"><TutorialText>{step.text.replaceAll('Bot 1',view.guide ?? 'o guia')}</TutorialText></p>
        </div>
        <details className="tutorial-hint" key={view.step}>
          <summary>Ver dica</summary>
          <p><TutorialText>{step.hint.replaceAll('Bot 1',view.guide ?? 'o guia')}</TutorialText>{view.target && <> Siga o <strong>marcador</strong> no mapa.</>}</p>
        </details>
        <nav className="tutorial-navigation" aria-label="Etapas do tutorial">
          <button type="button" className="tutorial-icon-button" aria-label="Etapa anterior" title="Etapa anterior"
            disabled={view.step===0} onClick={()=>send('step:'+(view.step-1))}><TutorialIcon icon={ChevronLeft}/></button>
          <span className="tutorial-progress" aria-live="polite">{view.step+1}<span> / {tutorialSteps.length}</span></span>
          <button type="button" className="tutorial-icon-button" aria-label="Próxima etapa" title="Próxima etapa"
            onClick={()=>send(step.manual ? 'next' : 'skip')}><TutorialIcon icon={ChevronRight}/></button>
        </nav>
      </>}
      <button className="tutorial-exit" onClick={()=>send('exit')}><TutorialIcon icon={LogOut}/>Sair do treino</button>
    </div>
  </aside></>;
}
export function mountTutorial(send:(action:string)=>void) {
  const host = document.createElement('div');
  document.body.append(host);
  const root = createRoot(host);
  return {
    render(view?:TutorialView,binocularActive=false) { root.render(view ? <TutorialPanel view={view} send={send} binocularActive={binocularActive}/> : null); },
    destroy() {root.unmount();host.remove();},
  };
}
