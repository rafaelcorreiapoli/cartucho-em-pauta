import type {Station} from '../plenary';

export function ContextActionButton({station,label,icon,detail,action,id,blocked,disabled,activate}:{
  station?:Station;label:string;icon:string;detail?:string;action?:string;id?:string;blocked?:string;disabled?:boolean;activate:()=>void;
}) {
  return <button id={id} className="hud-button hud-button--secondary" type="button"
    disabled={disabled || !!blocked} data-action={action} data-station={station} onClick={activate}>
    <svg className="hud-glyph" aria-hidden="true"><use href={`#icon-${icon}`}/></svg>
    <span>{label}{blocked ? <small> · {blocked}</small> : detail && <small>{detail}</small>}</span>
  </button>;
}
