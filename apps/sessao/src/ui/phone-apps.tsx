const apps = {
  'Telefone':'app-call',
  'Joguinhos':'app-games',
  'Câmera':'app-camera',
  'Álbum':'app-photos',
} as const;

export type PhoneApp = keyof typeof apps;

export function PhoneApps({active,select}:{active:PhoneApp;select:(app:PhoneApp)=>void}) {
  return (Object.keys(apps) as PhoneApp[]).map((app,index)=>{
    const shortcut = String(index+1);
    return <button key={app} type="button" className="phone-app" data-app={apps[app]}
      aria-pressed={app===active} aria-keyshortcuts={shortcut} onClick={()=>select(app)}>
      <span className="phone-app-icon">
        <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+apps[app]}/></svg>
        <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>
      </span>
      {app}
    </button>;
  });
}
