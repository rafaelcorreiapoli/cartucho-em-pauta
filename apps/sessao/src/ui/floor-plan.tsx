import { memo } from 'react';
import { createRoot } from 'react-dom/client';
import { hudConsumesKeys } from '../game-keys';
import { setCharacterPortrait } from '../character-art';
import { HEIGHT, WIDTH, rooms, walls, type Player, type Rect } from '../map';
import type { GameplayView } from '../gameplay';
import './floor-plan.css';

const region = ([x,y,width,height]:Rect) => ({
  left: x/WIDTH*100+'%', top: y/HEIGHT*100+'%',
  width: width/WIDTH*100+'%', height: height/HEIGHT*100+'%',
});

type BriefcaseTracking = GameplayView['briefcaseTracking'];

const FloorPlanLayout = memo(function FloorPlanLayout() {
  return <>
    {rooms.map(({name,bounds})=><div className="floor-plan-room" style={region(bounds)} key={name}>{name}</div>)}
    {walls.map((wall,index)=><div className="floor-plan-wall" style={region(wall)} key={index} aria-hidden="true"/>)}
  </>;
});

export function FloorPlan({marker,tracking}:{marker:(element:HTMLDivElement|null)=>void; tracking?:BriefcaseTracking}) {
  return <section className="floor-plan-panel" aria-label="Planta do Congresso">
    <header>
      <h2>Planta do Congresso</h2>
      {tracking && <span>Rastreador de maletas · {tracking.seconds} s</span>}
      <span>Solte <kbd>Tab</kbd> para voltar</span>
    </header>
    <div className="floor-plan-drawing" style={{aspectRatio:WIDTH/HEIGHT}}>
      <FloorPlanLayout/>
      {tracking?.markers.map(({id,x,y})=><img key={id} className="floor-plan-briefcase"
        src={import.meta.env.BASE_URL+'assets/maleta-social.png'} alt="Maleta de dinheiro"
        style={{left:x/WIDTH*100+'%',top:y/HEIGHT*100+'%'}}/>)}
      <div ref={marker} className="floor-plan-marker" role="img" aria-label="Sua posição" hidden>
        <span className="portrait" aria-hidden="true"/>
      </div>
    </div>
  </section>;
}

export function bindFloorPlan(session:HTMLElement, signal:AbortSignal) {
  const host = session.querySelector<HTMLElement>('#floor-plan')!;
  const root = createRoot(host);
  let player:Pick<Player,'x'|'y'|'character'>|undefined;
  let pin:HTMLDivElement|null = null;
  const updatePin = () => {
    if (!pin || !player || host.hidden) return;
    pin.style.left = player.x/WIDTH*100+'%';
    pin.style.top = player.y/HEIGHT*100+'%';
    setCharacterPortrait(pin.querySelector<HTMLElement>('.portrait')!,player.character);
    pin.hidden = false;
  };
  let tracking:BriefcaseTracking;
  const bindMarker = (element:HTMLDivElement|null) => { pin = element; updatePin(); };
  const render = () => root.render(<FloorPlan marker={bindMarker} tracking={tracking}/>);
  render();
  const hide = ()=>{host.hidden = true;};
  window.addEventListener('keydown',event=>{
    if (event.code!=='Tab' || session.hidden || session.dataset.phase==='lobby' ||
        session.dataset.phase==='finished' || event.ctrlKey || event.altKey || event.metaKey || event.shiftKey ||
        hudConsumesKeys(event.target)) return;
    event.preventDefault();
    if (!event.repeat) {
      host.hidden = false;
      render();
      updatePin();
    }
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
  return {
    player(own:Pick<Player,'x'|'y'|'character'>) {
      player = own;
      updatePin();
    },
    track(next:BriefcaseTracking) {
      if (!tracking && !next) return;
      tracking = next;
      if (!host.hidden) render();
    },
  };
}
