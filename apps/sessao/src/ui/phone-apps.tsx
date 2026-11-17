import type {ReactNode} from 'react';

const apps = {
  'Telefone':'app-call',
  'Joguinhos':'app-games',
  'Câmera':'app-camera',
  'Álbum':'app-photos',
  'Projetos':'ballot',
  'Correio':'document',
  'Pix':'wallet',
} as const;

export type PhoneApp = keyof typeof apps;
const appOrder = Object.keys(apps) as PhoneApp[];

export function phoneAppForKey(key:string) {
  if (/^[1-9]$/.test(key)) return appOrder[Number(key)-1];
}

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
  return appOrder.map((app,index)=><PhoneAppButton key={app} name={app} icon={apps[app]} shortcut={String(index+1)}
    pressed={app===active} onClick={()=>select(app)}/>);
}
