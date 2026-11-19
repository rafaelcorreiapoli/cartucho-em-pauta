import type {ReactNode,Ref} from 'react';
import {useDialogKeys} from './use-dialog-keys';

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

export function PhoneAppButton({name,icon,shortcut,pressed,onClick,children,buttonRef}:{
  name:string; icon:string; shortcut:string; pressed?:boolean; onClick:()=>void; children?:ReactNode; buttonRef?:Ref<HTMLButtonElement>;
}) {
  return <button ref={buttonRef} type="button" className="phone-app" data-app={icon}
    aria-pressed={pressed} aria-keyshortcuts={shortcut} onClick={onClick}>
    <span className="phone-app-icon" aria-hidden="true">
      {children ?? <svg className="hud-glyph"><use href={'#icon-'+icon}/></svg>}
      <kbd className="action-key">{shortcut}</kbd>
    </span>
    {name}
  </button>;
}

export function PhoneApps({active,select,close,gamesEnabled=true,projectsEnabled=true,photosEnabled=true}:{photosEnabled?:boolean;projectsEnabled?:boolean;gamesEnabled?:boolean;active?:PhoneApp;select:(app:PhoneApp)=>void;close?:()=>void}) {
  const options = appOrder.filter(app=>(gamesEnabled || app!=='Joguinhos') && (projectsEnabled || app!=='Projetos') && (photosEnabled || app!=='Câmera' && app!=='Álbum')).map((app,index)=>({name:app,shortcut:String(index+1),activate:()=>select(app)}));
  const entries = close ? [{name:'Fechar',activate:close},...options] : options;
  const first = useDialogKeys<HTMLButtonElement>(key=>options.find(option=>option.shortcut===key)?.activate,entries);
  return options.map(({name,shortcut,activate},index)=><PhoneAppButton key={name} name={name} icon={apps[name]} shortcut={shortcut}
    buttonRef={index===0 ? first : undefined} pressed={name===active} onClick={activate}/>);
}
