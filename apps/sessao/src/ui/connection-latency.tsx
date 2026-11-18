import {HudHelp} from './hud-help';
import {createRoot} from 'react-dom/client';

export function ConnectionLatency({milliseconds}:{milliseconds?:number}) {
  return milliseconds===undefined ? null : <HudHelp as="span" id="connection-latency" help="Tempo de resposta do servidor do jogo.">
    {milliseconds} ms
  </HudHelp>;
}

export function observeLatency(ping:(reply:(milliseconds:number)=>void)=>void,update:(milliseconds?:number)=>void) {
  let connected = true;
  let generation = 0;
  let last:number|undefined;
  function publish(next?:number) {
    if (last===next) return;
    last = next;
    update(next);
  }
  function sample() {
    if (!connected) return;
    const request = generation;
    ping(milliseconds=>{
      if (request!==generation || !Number.isFinite(milliseconds) || milliseconds<0) return;
      publish(Math.round(milliseconds));
    });
  }
  return {
    sample,
    pause() {
      connected = false;
      generation++;
      publish();
    },
    resume() {
      connected = true;
      sample();
    },
  };
}

export function mountConnectionLatency(element:HTMLElement,room:{
  ping:(reply:(milliseconds:number)=>void)=>void;
  onDrop:(listener:()=>void)=>unknown;
  onReconnect:(listener:()=>void)=>unknown;
},signal:AbortSignal) {
  const root = createRoot(element);
  const latency = observeLatency(reply=>room.ping(reply),milliseconds=>root.render(<ConnectionLatency milliseconds={milliseconds}/>));
  latency.sample();
  const timer = window.setInterval(latency.sample,3_000);
  room.onDrop(latency.pause);
  room.onReconnect(()=>{ if (!signal.aborted) latency.resume(); });
  signal.addEventListener('abort',()=>{
    clearInterval(timer);
    latency.pause();
    root.unmount();
  },{once:true});
}
