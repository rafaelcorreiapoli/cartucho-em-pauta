import {useEffect, useState, type CSSProperties} from 'react';
import {createRoot} from 'react-dom/client';

const apps = [
  {id:'open-equipment',label:'Equipamentos',icon:'inventory'},
  {id:'open-attributes',label:'Personagem',icon:'chart',key:'I'},
  {id:'open-phone',label:'Celular',icon:'phone'},
  {id:'open-surveillance',label:'Vigilância',icon:'camera',key:'G'},
  {id:'voice-toggle',label:'Microfone',icon:'mic',key:'V'},
  {id:'room-settings',label:'Configurações',icon:'settings'},
] as const;

type AppId = typeof apps[number]['id'];
type AppStatus = Partial<Record<AppId,{hidden:boolean; badge?:string}>>;

function Icon({name}:{name:string}) {
  return <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+name}/></svg>;
}

export function AppLauncher({status,launch}:{status:AppStatus;launch:(id:AppId)=>void}) {
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
      {apps.filter(app=>!status[app.id]?.hidden).map((app,index)=><button key={app.id} tabIndex={-1} type="button"
        className="congress-app-toggle congress-app" aria-label={app.label} title={app.label}
        style={{'--app-index':index} as CSSProperties}
        onClick={()=>{setOpen(false);launch(app.id);}}>
        <Icon name={app.icon}/><span className="congress-app-label">{app.label}</span>
        {status[app.id]?.badge && <strong className="congress-app-badge">{status[app.id]?.badge}</strong>}
      </button>)}
    </section>}
    <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Mochila" title="Mochila"
      onClick={()=>{setOpen(false);document.getElementById('open-bag')?.click();}}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M8 7V5a4 4 0 0 1 8 0v2M6 7h12l2 4v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9zM4 13h16M9 12v5h6v-5"/>
      </svg>
    </button>
    <button type="button" tabIndex={-1} className="congress-app-toggle" aria-label="Aplicativos" aria-expanded={open}
      aria-controls={open ? 'congress-app-panel' : undefined} onClick={()=>setOpen(value=>!value)}>
      <svg className="hud-glyph" viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">
        {[4,13].flatMap(x=>[4,13].map(y=><rect key={x+':'+y} x={x} y={y} width="7" height="7" rx="1.6"/>))}
      </svg>
    </button>
  </>;
}

export function mountAppLauncher() {
  const root = createRoot(document.getElementById('congress-apps')!);
  const controls = apps.map(app=>({id:app.id,button:document.getElementById(app.id)!}));
  let previous = '';
  return {
    render() {
      const status:AppStatus = {};
      for (const {id,button} of controls) {
        const badge = id!=='voice-toggle' && id!=='room-settings' ? button.querySelector('span:not([hidden]):not(.sr-only)')?.textContent?.trim() : undefined;
        status[id] = {hidden:button.hidden,badge};
      }
      const key = JSON.stringify(status);
      if (key===previous) return;
      previous = key;
      root.render(<AppLauncher status={status} launch={id=>{
        if (id==='room-settings') document.querySelector<HTMLElement>('#room-settings > summary')?.click();
        else document.getElementById(id)?.click();
      }}/>);
    },
    destroy() { root.unmount(); },
  };
}
