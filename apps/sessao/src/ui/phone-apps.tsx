import type {ReactNode} from 'react';

const apps = {
  'Telefone':['app-call','1'],
  'Joguinhos':['app-games','2'],
  'Câmera':['app-camera','3'],
  'Álbum':['app-photos','4'],
  'Projetos':['ballot','5'],
  'Correio':['document','8'],
  'Pix':['wallet','9'],
} as const;

export type PhoneApp = keyof typeof apps;

export function PhoneAppButton({name,icon,shortcut,pressed,onClick,children}:{
  name:string; icon:string; shortcut:string; pressed?:boolean; onClick:()=>void; children?:ReactNode;
}) {
  return <button type="button" className="phone-app" data-app={icon}
    aria-pressed={pressed} aria-keyshortcuts={shortcut} onClick={onClick}>
    <span className="phone-app-icon" aria-hidden="true">
      {children ?? <svg className="hud-glyph"><use href={'#icon-'+icon}/></svg>}
      <kbd className="action-key">{shortcut}</kbd>
    </span>
    {name}
  </button>;
}

export function PhoneApps({active,select}:{active?:PhoneApp;select:(app:PhoneApp)=>void}) {
  return (Object.keys(apps) as PhoneApp[]).map(app=>{
    const [icon,shortcut] = apps[app];
    return <PhoneAppButton key={app} name={app} icon={icon} shortcut={shortcut}
      pressed={app===active} onClick={()=>select(app)}/>;
  });
}
