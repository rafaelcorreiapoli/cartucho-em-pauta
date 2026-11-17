import {HudIcon} from './hud-icon';
import {useEffect, type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';

import {apps, type HudAppStatus, type LaunchHudApp} from '../hud-apps';

function AppLauncher({status,launch,open,toggle,close}:{status:HudAppStatus;launch:LaunchHudApp;
  open:boolean;toggle:()=>boolean;close:()=>void}) {
  useEffect(()=>{
    if (!open) return;
    const escape = (event:KeyboardEvent) => {
      if (event.key==='Escape' && !document.querySelector('dialog:modal')) close();
    };
    const outside = (event:PointerEvent) => {
      if (event.target instanceof Element && !event.target.closest('#congress-apps')) close();
    };
    document.addEventListener('keydown',escape);
    document.addEventListener('pointerdown',outside);
    return ()=>{
      document.removeEventListener('keydown',escape);
      document.removeEventListener('pointerdown',outside);
    };
  },[open,close]);
  return <>
    {open && <section id="congress-app-panel" className="congress-app-panel" aria-label="Aplicativos do parlamentar">
      {apps.filter(app=>status[app.id]).map((app,index)=><button key={app.id} tabIndex={-1} type="button"
        className="congress-app-toggle congress-app" aria-label={app.label} title={app.label} aria-keyshortcuts={app.key}
        style={{'--app-index':index} as CSSProperties}
        onClick={()=>launch(app.id)}>
        <HudIcon name={app.icon}/><span className="congress-app-label">{app.label}</span><kbd className="action-key" aria-hidden="true">{app.key}</kbd>
        {status[app.id]?.badge && <strong className="congress-app-badge">{status[app.id]?.badge}</strong>}
      </button>)}
    </section>}
    {status.bag && <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Mochila" title="Mochila (O)" aria-keyshortcuts="O"
      onClick={()=>launch('bag')}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7V5a4 4 0 0 1 8 0v2M6 7h12l2 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9zM4 13h16M9 12v5h6v-5"/>
      </svg>
      <kbd className="slot-key" aria-hidden="true">O</kbd>
    </button>}
    <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Aplicativos" title="Aplicativos (U)" aria-keyshortcuts="U" aria-expanded={open}
      aria-controls={open ? 'congress-app-panel' : undefined} onClick={toggle}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        {[4,13].flatMap(x=>[4,13].map(y=><rect key={x+':'+y} x={x} y={y} width="7" height="7" rx="1.6"/>))}
      </svg>
      <kbd className="slot-key" aria-hidden="true">U</kbd>
    </button>
  </>;
}

export function mountAppLauncher(launch:LaunchHudApp) {
  const host = document.getElementById('congress-apps')!;
  const root = createRoot(host);
  let previous = '';
  let status:HudAppStatus = {};
  let open = false;
  function render() {
    root.render(<AppLauncher status={status} launch={activate} open={open} toggle={toggle} close={close}/>);
  }
  function close() {
    if (!open) return;
    open = false;
    render();
  }
  function toggle() {
    if (!status.settings || !host.checkVisibility({visibilityProperty:true,opacityProperty:true})) return false;
    open = !open;
    render();
    return true;
  }
  const activate:LaunchHudApp = app=>{
    if (!launch(app)) return false;
    close();
    return true;
  };
  return {
    activate,toggle,close,
    render(next:HudAppStatus) {
      const key = JSON.stringify(next);
      if (key===previous) return;
      previous = key;
      status = next;
      render();
    },
    destroy() { root.unmount(); },
  };
}
