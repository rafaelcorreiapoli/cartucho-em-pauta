const apps = {
  'Telefone':['app-call','1'],
  'Joguinhos':['app-games','2'],
  'Câmera':['app-camera','3'],
  'Álbum':['app-photos','4'],
  'Correio':['document','8'],
  'Pix':['wallet','9'],
} as const;

export type PhoneApp = keyof typeof apps;

export function PhoneApps({active,select}:{active:PhoneApp;select:(app:PhoneApp)=>void}) {
  return (Object.keys(apps) as PhoneApp[]).map(app=>{
    const [icon,shortcut] = apps[app];
    return <button key={app} type="button" className="phone-app" data-app={icon}
      aria-pressed={app===active} aria-keyshortcuts={shortcut} onClick={()=>select(app)}>
      <span className="phone-app-icon">
        <svg className="hud-glyph" aria-hidden="true"><use href={'#icon-'+icon}/></svg>
        <kbd className="action-key" aria-hidden="true">{shortcut}</kbd>
      </span>
      {app}
    </button>;
  });
}
