import { createRoot } from 'react-dom/client';
import { hudConsumesKeys } from '../game-keys';
import { HEIGHT, WIDTH, rooms, walls, type Rect } from '../map';
import './floor-plan.css';

const region = ([x,y,width,height]:Rect) => ({
  left: x/WIDTH*100+'%', top: y/HEIGHT*100+'%',
  width: width/WIDTH*100+'%', height: height/HEIGHT*100+'%',
});

export function FloorPlan() {
  return <section className="floor-plan-panel" aria-label="Planta do Congresso">
    <header><h2>Planta do Congresso</h2><span>Solte <kbd>Tab</kbd> para voltar</span></header>
    <div className="floor-plan-drawing">
      {rooms.map(({name,bounds})=><div className="floor-plan-room" style={region(bounds)} key={name}>{name}</div>)}
      {walls.map((wall,index)=><div className="floor-plan-wall" style={region(wall)} key={index} aria-hidden="true"/>)}
    </div>
  </section>;
}

export function bindFloorPlan(session:HTMLElement, signal:AbortSignal) {
  const host = session.querySelector<HTMLElement>('#floor-plan')!;
  const root = createRoot(host);
  root.render(<FloorPlan/>);
  const hide = ()=>{host.hidden = true;};
  window.addEventListener('keydown',event=>{
    if (event.code!=='Tab' || session.hidden || session.dataset.phase==='lobby' ||
        session.dataset.phase==='finished' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        hudConsumesKeys(event.target)) return;
    event.preventDefault();
    if (!event.repeat) host.hidden = false;
  },{signal});
  window.addEventListener('keyup',event=>{
    if (event.code==='Tab' && !host.hidden) {
      event.preventDefault();
      hide();
    }
  },{signal});
  window.addEventListener('blur',hide,{signal});
  document.addEventListener('visibilitychange',hide,{signal});
  signal.addEventListener('abort',()=>{hide();root.unmount();},{once:true});
}
