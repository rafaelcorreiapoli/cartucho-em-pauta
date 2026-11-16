import {useEffect, useState, type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';

import {apps, type HudAppStatus, type LaunchHudApp} from '../hud-apps';

function Icon({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

export function AppLauncher({status,launch}:{status:HudAppStatus;launch:LaunchHudApp}) {
  const [open,setOpen] = useState(false);
  useEffect(()=>{
    if (!open) return;
    const close = (event:KeyboardEvent) => {
      if (event.key==='Escape' && !document.querySelector('dialog:modal')) setOpen(false);
    };
    const outside = (event:PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('#congress-apps')) setOpen(false);
    };
    document.addEventListener('keydown',close);
    document.addEventListener('pointerdown',outside);
    return ()=>{
      document.removeEventListener('keydown',close);
      document.removeEventListener('pointerdown',outside);
    };
  },[open]);
  return <>
    {open && <section id="congress-app-panel" className="congress-app-panel" aria-label="Aplicativos do parlamentar">
      {apps.filter(app=>status[app.id]).map((app,index)=><button key={app.id} tabIndex={-1} type="button"
        className="congress-app-toggle congress-app" aria-label={app.label} title={app.label} aria-keyshortcuts={app.key}
        style={{'--app-index':index} as CSSProperties}
        onClick={()=>{setOpen(false);launch(app.id);}}>
        <Icon name={app.icon}/><span className="congress-app-label">{app.label} <kbd>{app.key}</kbd></span>
        {status[app.id]?.badge && <strong className="congress-app-badge">{status[app.id]?.badge}</strong>}
      </button>)}
    </section>}
    {status.bag && <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Mochila" title="Mochila (O)" aria-keyshortcuts="O"
      onClick={()=>{setOpen(false);launch('bag');}}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7V5a4 4 0 0 1 8 0v2M6 7h12l2 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9zM4 13h16M9 12v5h6v-5"/>
      </svg>
      <kbd className="slot-key" aria-hidden="true">O</kbd>
    </button>}
    <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Aplicativos" title="Aplicativos (U)" aria-keyshortcuts="U" aria-expanded={open}
      aria-controls={open ? 'congress-app-panel' : undefined} onClick={()=>setOpen(value=>!value)}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        {[4,13].flatMap(x=>[4,13].map(y=><rect key={x+':'+y} x={x} y={y} width="7" height="7" rx="1.6"/>))}
      </svg>
      <kbd className="slot-key" aria-hidden="true">U</kbd>
    </button>
  </>;
}

export function mountAppLauncher(launch:LaunchHudApp) {
  const root = createRoot(document.getElementById('congress-apps')!);
  let previous = '';
  return {
    render(status:HudAppStatus) {
      const key = JSON.stringify(status);
      if (key===previous) return;
      previous = key;
      root.render(<AppLauncher status={status} launch={launch}/>);
    },
    destroy() { root.unmount(); },
  };
}
