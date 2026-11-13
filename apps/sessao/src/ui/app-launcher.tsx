import {useEffect, useState} from 'react';
import {createRoot} from 'react-dom/client';

const apps = [
  {id:'open-equipment',label:'Equipamentos',icon:'inventory'},
  {id:'open-attributes',label:'Personagem',icon:'chart',key:'I'},
  {id:'open-phone',label:'Celular',icon:'phone'},
  {id:'open-mail',label:'Correio Interno',icon:'document',key:'U'},
  {id:'open-surveillance',label:'Vigilância',icon:'camera',key:'G'},
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
    {open && <section id="congress-app-panel" className="congress-app-panel rounded-hud p-3" aria-label="Aplicativos do parlamentar">
      <header className="mb-3 flex items-center justify-between gap-4">
        <strong>Aplicativos do parlamentar</strong>
        <button type="button" tabIndex={-1} aria-label="Fechar aplicativos" onClick={()=>setOpen(false)}><Icon name="cross"/></button>
      </header>
      <div className="grid grid-cols-2 gap-2">
        {apps.filter(app=>!status[app.id]?.hidden).map(app=><button key={app.id} tabIndex={-1} type="button"
          className="congress-app flex items-center gap-2 rounded-hud p-2 text-left"
          onClick={()=>{setOpen(false);launch(app.id);}}>
          <Icon name={app.icon}/><span className="flex-1">{app.label}</span>
          {status[app.id]?.badge && <strong>{status[app.id]?.badge}</strong>}
          {'key' in app && <kbd>{app.key}</kbd>}
        </button>)}
      </div>
    </section>}
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
  const controls = apps.map(app=>({id:app.id,button:document.getElementById(app.id) as HTMLButtonElement}));
  let previous = '';
  return {
    render() {
      const status:AppStatus = {};
      for (const {id,button} of controls) {
        const badge = button.querySelector('span:not([hidden]):not(.sr-only)')?.textContent?.trim();
        status[id] = {hidden:button.hidden,badge};
      }
      const key = JSON.stringify(status);
      if (key===previous) return;
      previous = key;
      root.render(<AppLauncher status={status} launch={id=>document.getElementById(id)?.click()}/>);
    },
    destroy() { root.unmount(); },
  };
}
